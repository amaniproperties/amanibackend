import { env } from '../config/env.js';

function assertWhatsappConfigured() {
  const missing = [];

  if (!env.twilioAccountSid) missing.push('TWILIO_ACCOUNT_SID');
  if (!env.twilioAuthToken) missing.push('TWILIO_AUTH_TOKEN');
  if (!env.twilioWhatsappFrom) missing.push('TWILIO_WHATSAPP_FROM');

  if (missing.length) {
    throw new Error(`WhatsApp is not configured. Missing: ${missing.join(', ')}`);
  }
}

function normalizeWhatsappNumber(value) {
  const raw = String(value || '').trim();

  if (!raw) {
    return '';
  }

  if (raw.startsWith('whatsapp:')) {
    return raw;
  }

  if (raw.startsWith('+')) {
    return `whatsapp:${raw}`;
  }

  if (raw.startsWith('0')) {
    return `whatsapp:+254${raw.slice(1)}`;
  }

  if (raw.startsWith('254')) {
    return `whatsapp:+${raw}`;
  }

  return `whatsapp:${raw}`;
}

function buildContractUrl(contract) {
  if (!contract?.pdf_file_path) {
    return '';
  }

  if (/^https?:\/\//i.test(contract.pdf_file_path)) {
    return contract.pdf_file_path;
  }

  return `${env.appPublicBaseUrl.replace(/\/$/, '')}/${String(contract.pdf_file_path).replace(/^\//, '')}`;
}

function buildWhatsappBody({ contract, tenancy, client, unit, property }) {
  const tenantName =
    client?.full_name ||
    tenancy?.tenant_name ||
    'Tenant';

  const propertyTitle =
    property?.title ||
    'your rental property';

  const unitCode =
    unit?.unit_code ||
    unit?.unit_title ||
    unit?.unit_name ||
    'your unit';

  const contractNumber =
    contract?.contract_number ||
    contract?.id ||
    '';

  const contractUrl = buildContractUrl(contract);

  return [
    `Hello ${tenantName},`,
    `Your tenancy contract${contractNumber ? ` (${contractNumber})` : ''} for ${propertyTitle}, unit ${unitCode}, is ready.`,
    contract?.start_date ? `Start: ${contract.start_date}` : '',
    contract?.end_date ? `End: ${contract.end_date}` : '',
    contractUrl ? `Open contract: ${contractUrl}` : 'Please contact the office for the contract copy.',
    'Amani Blue Sky Agency'
  ]
    .filter(Boolean)
    .join('\n');
}

export async function sendContractWhatsapp({ to, contract, tenancy, client, unit, property }) {
  assertWhatsappConfigured();

  const normalizedTo = normalizeWhatsappNumber(to);

  if (!normalizedTo) {
    throw new Error('Missing WhatsApp recipient');
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(env.twilioAccountSid)}/Messages.json`;

  const params = new URLSearchParams();
  params.set('From', env.twilioWhatsappFrom);
  params.set('To', normalizedTo);
  params.set(
    'Body',
    buildWhatsappBody({
      contract,
      tenancy,
      client,
      unit,
      property
    })
  );

  const auth = Buffer.from(`${env.twilioAccountSid}:${env.twilioAuthToken}`).toString('base64');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.message || `Twilio WhatsApp failed with status ${response.status}`);
  }

  return {
    provider: 'twilio',
    messageId: payload.sid || '',
    response: payload
  };
}
