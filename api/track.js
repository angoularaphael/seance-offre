import { recordVisit, flyerSourceLabel } from '../lib/visits.js';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    json(res, 405, { ok: false, error: 'method' });
    return;
  }
  const body = await readBody(req);
  const src = flyerSourceLabel(body);
  const result = await recordVisit({
    event: body.event || 'page_vue',
    src: body.src || body.utm_source,
    medium: body.medium || body.utm_medium,
    campaign: body.campaign || body.utm_campaign,
    path: body.path || '/',
  });
  json(res, result.ok ? 200 : 502, { ok: result.ok, src, error: result.error || undefined });
}
