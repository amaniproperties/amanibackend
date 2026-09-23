import 'dotenv/config';

function required(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function optional(name, fallback = '') {
  return process.env[name] || fallback;
}

function bool(name, fallback = false) {
  const value = process.env[name];

  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
}

function number(name, fallback) {
  const value = Number(process.env[name]);

  if (!Number.isFinite(value)) {
    return fallback;
  }

  return value;
}

export const env = {
  port: Number(process.env.PORT || 4000),

  supabaseUrl: required('SUPABASE_URL'),
  // Supabase's current server credential is SUPABASE_SECRET_KEY (sb_secret_...).
  // Keep legacy SUPABASE_SERVICE_ROLE_KEY support for existing deployments.
  supabaseServiceRoleKey: process.env.SUPABASE_SECRET_KEY || required('SUPABASE_SERVICE_ROLE_KEY'),
  adminApiKey: optional('ADMIN_API_KEY'),

  appPublicBaseUrl: optional('APP_PUBLIC_BASE_URL', 'http://127.0.0.1:8080'),
  corsOrigins: optional('CORS_ORIGINS').split(',').map((value) => value.trim()).filter(Boolean),

  smtpHost: optional('SMTP_HOST'),
  smtpPort: number('SMTP_PORT', 587),
  smtpSecure: bool('SMTP_SECURE', false),
  smtpUser: optional('SMTP_USER'),
  smtpPass: optional('SMTP_PASS'),
  smtpFrom: optional('SMTP_FROM', optional('SMTP_USER')),

  twilioAccountSid: optional('TWILIO_ACCOUNT_SID'),
  twilioAuthToken: optional('TWILIO_AUTH_TOKEN'),
  twilioWhatsappFrom: optional('TWILIO_WHATSAPP_FROM'),

  contractDeliveryLimit: number('CONTRACT_DELIVERY_LIMIT', 10),
  contractDeliveryMaxAttempts: number('CONTRACT_DELIVERY_MAX_ATTEMPTS', 3)
};
