import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

function requireEmailConfig() {
  const missing = [];
  if (!env.smtpHost) missing.push('SMTP_HOST');
  if (!env.smtpUser) missing.push('SMTP_USER');
  if (!env.smtpPass) missing.push('SMTP_PASS');
  if (!env.smtpFrom) missing.push('SMTP_FROM');
  if (missing.length) throw new Error(`Email is not configured. Missing: ${missing.join(', ')}`);
}

function clean(value, max = 1000) {
  return String(value ?? '').trim().slice(0, max);
}

export async function sendPropertyVisitRequest({ to, booking, property, unit }) {
  requireEmailConfig();
  if (!to) throw new Error('Amani booking recipient email is not configured');

  const transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: { user: env.smtpUser, pass: env.smtpPass }
  });

  const propertyTitle = clean(property?.title || booking.property || 'Amani property', 250);
  const unitCode = clean(unit?.unit_code || unit?.unit_title || unit?.unit_name || booking.unit_code || '', 120);
  const visitor = clean(booking.name || 'Website visitor', 200);
  const subject = `Amani property visit request - ${propertyTitle}${unitCode ? ` / ${unitCode}` : ''}`;
  const lines = [
    'A new property visit request was submitted through the Amani website.',
    '',
    `Name: ${visitor}`,
    `Phone / WhatsApp: ${clean(booking.phone, 100)}`,
    booking.email ? `Email: ${clean(booking.email, 250)}` : '',
    booking.budget ? `Budget / Offer: KES ${clean(booking.budget, 100)}` : '',
    `Property: ${propertyTitle}`,
    unitCode ? `Unit: ${unitCode}` : '',
    booking.preferred_visit_date ? `Preferred visit date: ${clean(booking.preferred_visit_date, 30)}` : '',
    booking.preferred_visit_time ? `Preferred visit time: ${clean(booking.preferred_visit_time, 30)}` : '',
    booking.message ? `Message: ${clean(booking.message, 2000)}` : '',
    '',
    `Property ID: ${clean(property?.id || booking.property_id, 150)}`,
    `Unit ID: ${clean(unit?.id || booking.unit_id, 150)}`
  ].filter(Boolean);

  const result = await transporter.sendMail({
    from: env.smtpFrom,
    to,
    replyTo: booking.email || undefined,
    subject,
    text: lines.join('\n')
  });

  return { provider: 'smtp', messageId: result.messageId || '' };
}
