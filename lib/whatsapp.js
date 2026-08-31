import './load-env.js';

const DEFAULT_SMS_GATEWAY_URL = 'http://prem-eu2.bot-hosting.net:21724';

function smsGatewayUrl() {
  const raw = process.env.SMS_GATEWAY_URL || DEFAULT_SMS_GATEWAY_URL;
  let url = String(raw || '').trim().replace(/\/$/, '');
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  return url;
}

function smsSecret() {
  return String(process.env.SMS_GATEWAY_SECRET || process.env.OUTBOUND_API_SECRET || '').trim();
}

export function toWhatsAppPhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0') && digits.length === 10) digits = `33${digits.slice(1)}`;
  if (digits.startsWith('330') && digits.length === 12) digits = `33${digits.slice(3)}`;
  return digits.length >= 10 ? digits : null;
}

function toE164(raw) {
  const digits = toWhatsAppPhone(raw);
  if (!digits) return null;
  return digits.startsWith('+') ? digits : `+${digits}`;
}

export async function sendWhatsAppMessage(phone, message, { fetchImpl = fetch, dryRun = false } = {}) {
  if (dryRun) return { sent: false, reason: 'dry_run' };
  const to = toE164(phone);
  if (!to) throw new Error('Numéro invalide');
  const base = smsGatewayUrl();
  if (!base) return { sent: false, reason: 'sms_not_configured' };
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  const secret = smsSecret();
  if (secret) headers['x-api-secret'] = secret;
  const res = await fetchImpl(`${base}/api/messages/send`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ telephone: to, message, source: 'seance-offerte' }),
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text.slice(0, 180) || `HTTP ${res.status}`);
  }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return { sent: true, via: 'sms', ...data };
}
