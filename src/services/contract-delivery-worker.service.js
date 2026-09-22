import { supabaseAdmin } from '../db/supabase-admin.js';
import { env } from '../config/env.js';
import { sendContractEmail } from './contract-email.service.js';
import { sendContractWhatsapp } from './contract-whatsapp.service.js';

function nowIso() {
  return new Date().toISOString();
}

async function loadContractContext(contractId) {
  const { data, error } = await supabaseAdmin
    .from('tenancy_contracts')
    .select(`
      *,
      unit_tenancies (
        *,
        clients:primary_client_id (*)
      ),
      property_units (
        *,
        properties (*)
      ),
      clients:primary_client_id (*)
    `)
    .eq('id', contractId)
    .single();

  if (error) {
    throw error;
  }

  const tenancy = data.unit_tenancies || null;
  const unit = data.property_units || null;
  const property = unit?.properties || null;
  const client = data.clients || tenancy?.clients || null;

  return {
    contract: data,
    tenancy,
    unit,
    property,
    client
  };
}

async function markQueueProcessing(queueItem) {
  const { data, error } = await supabaseAdmin
    .from('contract_delivery_queue')
    .update({
      queue_status: 'processing',
      attempts: Number(queueItem.attempts || 0) + 1,
      last_attempt_at: nowIso(),
      updated_at: nowIso()
    })
    .eq('id', queueItem.id)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function markQueueSent(queueItem) {
  const { error } = await supabaseAdmin
    .from('contract_delivery_queue')
    .update({
      queue_status: 'sent',
      processed_at: nowIso(),
      error_message: null,
      updated_at: nowIso()
    })
    .eq('id', queueItem.id);

  if (error) {
    throw error;
  }
}

async function markQueueFailed(queueItem, errorMessage) {
  const { error } = await supabaseAdmin
    .from('contract_delivery_queue')
    .update({
      queue_status: 'failed',
      error_message: errorMessage,
      updated_at: nowIso()
    })
    .eq('id', queueItem.id);

  if (error) {
    throw error;
  }
}

async function insertDeliveryLog({
  contractId,
  channel,
  recipient,
  status,
  providerName,
  providerMessageId,
  errorMessage,
  metadata
}) {
  const { error } = await supabaseAdmin
    .from('tenancy_contract_delivery_log')
    .insert({
      contract_id: contractId,
      delivery_channel: channel,
      recipient_value: recipient,
      delivery_status: status,
      delivered_at: status === 'sent' ? nowIso() : null,
      provider_name: providerName || null,
      provider_message_id: providerMessageId || null,
      error_message: errorMessage || null,
      metadata_json: metadata || {}
    });

  if (error) {
    throw error;
  }
}

async function markContractChannelSent(contractId, channel) {
  const updateData = {
    updated_at: nowIso()
  };

  if (channel === 'email') {
    updateData.email_sent = true;
    updateData.email_sent_at = nowIso();
  }

  if (channel === 'whatsapp') {
    updateData.whatsapp_sent = true;
    updateData.whatsapp_sent_at = nowIso();
  }

  const { error } = await supabaseAdmin
    .from('tenancy_contracts')
    .update(updateData)
    .eq('id', contractId);

  if (error) {
    throw error;
  }
}

async function insertContractSentEvent({ context, channel }) {
  const { contract, tenancy, unit, client } = context;

  const { error } = await supabaseAdmin
    .from('tenancy_events')
    .insert({
      tenancy_id: contract.tenancy_id,
      unit_id: contract.unit_id,
      client_id: contract.primary_client_id || client?.id || tenancy?.primary_client_id || null,
      event_type: 'contract_sent',
      title: `Contract sent by ${channel}`,
      description: `Contract ${contract.contract_number || contract.id} sent by ${channel}`,
      severity: 'info',
      metadata_json: {
        contract_id: contract.id,
        channel,
        unit_code: unit?.unit_code || null
      }
    });

  if (error) {
    console.warn('Failed to insert contract sent event:', error);
  }
}

async function processOneQueueItem(queueItem) {
  const processingItem = await markQueueProcessing(queueItem);
  const context = await loadContractContext(processingItem.contract_id);

  let sendResult;

  if (processingItem.channel === 'email') {
    sendResult = await sendContractEmail({
      to: processingItem.recipient_value,
      ...context
    });
  } else if (processingItem.channel === 'whatsapp') {
    sendResult = await sendContractWhatsapp({
      to: processingItem.recipient_value,
      ...context
    });
  } else {
    throw new Error(`Unsupported contract delivery channel: ${processingItem.channel}`);
  }

  await markQueueSent(processingItem);
  await markContractChannelSent(processingItem.contract_id, processingItem.channel);

  await insertDeliveryLog({
    contractId: processingItem.contract_id,
    channel: processingItem.channel,
    recipient: processingItem.recipient_value,
    status: 'sent',
    providerName: sendResult.provider,
    providerMessageId: sendResult.messageId,
    metadata: {
      queue_id: processingItem.id,
      response: sendResult.response || null
    }
  });

  await insertContractSentEvent({
    context,
    channel: processingItem.channel
  });

  return {
    queueId: processingItem.id,
    contractId: processingItem.contract_id,
    channel: processingItem.channel,
    status: 'sent',
    provider: sendResult.provider,
    messageId: sendResult.messageId
  };
}

export async function processPendingContractDeliveries(options = {}) {
  const limit = Number(options.limit || env.contractDeliveryLimit || 10);
  const maxAttempts = Number(options.maxAttempts || env.contractDeliveryMaxAttempts || 3);

  const { data: queueItems, error } = await supabaseAdmin
    .from('contract_delivery_queue')
    .select('*')
    .in('queue_status', ['pending', 'failed'])
    .lt('attempts', maxAttempts)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  const results = [];

  for (const queueItem of queueItems || []) {
    try {
      const result = await processOneQueueItem(queueItem);
      results.push(result);
    } catch (error) {
      const errorMessage = error?.message || 'Unknown contract delivery error';

      await markQueueFailed(queueItem, errorMessage).catch(updateError => {
        console.error('Failed to mark queue item as failed:', updateError);
      });

      await insertDeliveryLog({
        contractId: queueItem.contract_id,
        channel: queueItem.channel,
        recipient: queueItem.recipient_value,
        status: 'failed',
        providerName: queueItem.channel === 'whatsapp' ? 'twilio' : 'smtp',
        providerMessageId: '',
        errorMessage,
        metadata: {
          queue_id: queueItem.id
        }
      }).catch(logError => {
        console.error('Failed to insert failed delivery log:', logError);
      });

      results.push({
        queueId: queueItem.id,
        contractId: queueItem.contract_id,
        channel: queueItem.channel,
        status: 'failed',
        error: errorMessage
      });
    }
  }

  return {
    processed: results.length,
    results
  };
}

export async function getPendingContractDeliveryQueue(options = {}) {
  const limit = Number(options.limit || 50);

  const { data, error } = await supabaseAdmin
    .from('contract_delivery_queue')
    .select(`
      *,
      tenancy_contracts (
        id,
        contract_number,
        contract_status,
        email_sent,
        whatsapp_sent,
        pdf_file_path
      ),
      clients (
        id,
        full_name,
        id_number,
        phone_primary,
        email,
        whatsapp_number
      )
    `)
    .in('queue_status', ['pending', 'processing', 'failed'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data || [];
}
