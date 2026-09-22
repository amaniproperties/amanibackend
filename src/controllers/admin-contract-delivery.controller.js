import { supabaseAdmin } from '../db/supabase-admin.js';
import { processPendingContractDeliveries } from '../services/contract-delivery-worker.service.js';
import { ok, fail } from '../utils/http.js';

function limitParam(value, fallback = 100) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 500) : fallback;
}

function applyEq(query, filters) {
  let result = query;
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') result = result.eq(key, value);
  }
  return result;
}

export async function listContractDeliverySummary(_req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('contract_delivery_queue')
      .select('channel,queue_status,attempts');
    if (error) throw error;

    const grouped = new Map();
    for (const row of data || []) {
      const key = `${row.channel || 'unspecified'}|${row.queue_status || 'unspecified'}`;
      const current = grouped.get(key) || {
        channel: row.channel || 'unspecified',
        queue_status: row.queue_status || 'unspecified',
        total_items: 0,
        total_attempts: 0
      };
      current.total_items += 1;
      current.total_attempts += Number(row.attempts || 0);
      grouped.set(key, current);
    }

    return ok(res, [...grouped.values()].sort((a, b) => b.total_items - a.total_items));
  } catch (error) {
    return fail(res, 500, 'Failed to load contract delivery summary', error.message);
  }
}

export async function listContractDeliveryQueue(req, res) {
  try {
    let query = supabaseAdmin
      .from('contract_delivery_queue')
      .select(`
        *,
        tenancy_contracts (id,contract_number,contract_status,email_sent,whatsapp_sent,pdf_file_path),
        clients (id,full_name,id_number,phone_primary,email,whatsapp_number)
      `);

    query = applyEq(query, {
      contract_id: req.query.contract_id,
      tenancy_id: req.query.tenancy_id,
      client_id: req.query.client_id,
      queue_status: req.query.queue_status,
      channel: req.query.channel
    });

    query = query
      .order(req.query.orderBy || 'created_at', { ascending: req.query.ascending === 'true' })
      .limit(limitParam(req.query.limit, 100));

    const { data, error } = await query;
    if (error) throw error;
    return ok(res, data || []);
  } catch (error) {
    return fail(res, 500, 'Failed to load contract delivery queue', error.message);
  }
}

export async function listContractDeliveryLog(req, res) {
  try {
    let query = supabaseAdmin
      .from('tenancy_contract_delivery_log')
      .select(`
        *,
        tenancy_contracts (id,contract_number,contract_status,tenancy_id,unit_id,primary_client_id)
      `);

    query = applyEq(query, {
      contract_id: req.query.contract_id,
      delivery_status: req.query.delivery_status,
      delivery_channel: req.query.delivery_channel
    });

    query = query
      .order(req.query.orderBy || 'created_at', { ascending: req.query.ascending === 'true' })
      .limit(limitParam(req.query.limit, 100));

    const { data, error } = await query;
    if (error) throw error;

    let rows = data || [];
    if (req.query.client_id) {
      rows = rows.filter((row) => String(row.tenancy_contracts?.primary_client_id || '') === String(req.query.client_id));
    }

    return ok(res, rows);
  } catch (error) {
    return fail(res, 500, 'Failed to load contract delivery log', error.message);
  }
}

export async function processContractDelivery(req, res) {
  try {
    const result = await processPendingContractDeliveries({
      limit: limitParam(req.body?.limit ?? req.query.limit, 10)
    });
    return ok(res, result);
  } catch (error) {
    return fail(res, 500, 'Failed to process contract delivery queue', error.message);
  }
}
