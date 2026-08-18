import { summarizeVisits } from '../lib/visits.js';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  const secret = String(process.env.SYNC_SECRET || process.env.ADMIN_SECRET || '');
  const header = String(req.headers['x-sync-secret'] || req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const query = new URL(req.url, 'http://local').searchParams.get('secret') || '';
  if (secret && header !== secret && query !== secret) {
    json(res, 401, { ok: false, error: 'unauthorized' });
    return;
  }
  const days = Math.min(60, Math.max(1, Number(new URL(req.url, 'http://local').searchParams.get('days') || 14)));
  const summary = await summarizeVisits(days);
  json(res, 200, { ok: true, ...summary });
}
