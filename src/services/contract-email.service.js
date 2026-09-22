import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

function assertEmailConfigured() {
  const missing = [];

  if (!env.smtpHost) missing.push('SMTP_HOST');
  if (!env.smtpUser) missing.push('SMTP_USER');
  if (!env.smtpPass) missing.push('SMTP_PASS');
  if (!env.smtpFrom) missing.push('SMTP_FROM');

  if (missing.length) {
    throw new Error(`Email is not configured. Missing: ${missing.join(', ')}`);
  }
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

function buildEmailContent({ contract, tenancy, client, unit, property }) {
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

  const subject = `Tenancy Contract ${contractNumber ? `- ${contractNumber}` : ''}`;

  const text = [
    `Hello ${tenantName},`,
    '',
    `Your tenancy contract for ${propertyTitle}, unit ${unitCode}, has been prepared.`,
    contractNumber ? `Contract Number: ${contractNumber}` : '',
    contract?.start_date ? `Start Date: ${contract.start_date}` : '',
    contract?.end_date ? `End Date: ${contract.end_date}` : '',
    contractUrl ? `Contract Link: ${contractUrl}` : '',
    '',
    'Please review the contract and contact us if you need help.',
    '',
    'Amani Blue Sky Agency'
  ]
    .filter(Boolean)
    .join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; color: #222; line-height: 1.6;">
      <p>Hello ${escapeHtml(tenantName)},</p>

      <p>
        Your tenancy contract for
        <strong>${escapeHtml(propertyTitle)}</strong>,
        unit <strong>${escapeHtml(unitCode)}</strong>,
        has been prepared.
      </p>

      <table style="border-collapse: collapse; margin: 16px 0;">
        ${contractNumber ? rowHtml('Contract Number', contractNumber) : ''}
        ${contract?.start_date ? rowHtml('Start Date', contract.start_date) : ''}
        ${contract?.end_date ? rowHtml('End Date', contract.end_date) : ''}
      </table>

      ${
        contractUrl
          ? `<p><a href="${escapeAttr(contractUrl)}" style="background:#00B98E;color:#fff;padding:10px 16px;text-decoration:none;border-radius:4px;">Open Contract</a></p>`
          : '<p>The contract file path has not been attached yet. Please contact the office for a copy.</p>'
      }

      <p>Please review the contract and contact us if you need help.</p>

      <p>Amani Blue Sky Agency</p>
    </div>
  `;

  return { subject, text, html };
}

function rowHtml(label, value) {
  return `
    <tr>
      <td style="border:1px solid #ddd;padding:8px;font-weight:bold;">${escapeHtml(label)}</td>
      <td style="border:1px solid #ddd;padding:8px;">${escapeHtml(value)}</td>
    </tr>
  `;
}

export async function sendContractEmail({ to, contract, tenancy, client, unit, property }) {
  assertEmailConfigured();

  if (!to) {
    throw new Error('Missing email recipient');
  }

  const transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass
    }
  });

  const content = buildEmailContent({
    contract,
    tenancy,
    client,
    unit,
    property
  });

  const result = await transporter.sendMail({
    from: env.smtpFrom,
    to,
    subject: content.subject,
    text: content.text,
    html: content.html
  });

  return {
    provider: 'smtp',
    messageId: result.messageId || '',
    response: result.response || ''
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('"', '&quot;');
}
