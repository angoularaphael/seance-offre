const DEFAULT_WHATSAPP_BOT_URL = 'http://us3.bot-hosting.net:21819';

function whatsappBotUrl() {
  const raw = process.env.WHATSAPP_BOT_URL || process.env.WHATSAPP_REFERRAL_BOT_URL || DEFAULT_WHATSAPP_BOT_URL;
  let url = String(raw || '').trim().replace(/\/$/, '');
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  return url;
}

function botSecret() {
  return String(process.env.WHATSAPP_BOT_SECRET || process.env.WHATSAPP_REFERRAL_BOT_SECRET || '').trim();
}

export function toWhatsAppPhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0') && digits.length === 10) digits = `33${digits.slice(1)}`;
  if (digits.startsWith('330') && digits.length === 12) digits = `33${digits.slice(3)}`;
  return digits.length >= 10 ? digits : null;
}

export async function sendWhatsAppMessage(phone, message, { fetchImpl = fetch, dryRun = false } = {}) {
  if (dryRun) return { sent: false, reason: 'dry_run' };
  const to = toWhatsAppPhone(phone);
  if (!to) throw new Error('Numéro WhatsApp invalide');
  const base = whatsappBotUrl();
  if (!base) return { sent: false, reason: 'whatsapp_not_configured' };
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  const secret = botSecret();
  if (secret) headers['x-api-secret'] = secret;
  const res = await fetchImpl(`${base}/api/send-message`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ phone: to, message }),
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text.slice(0, 180) || `HTTP ${res.status}`);
  }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return { sent: true, ...data };
}
