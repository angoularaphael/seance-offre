import './load-env.js';

export const FLYER_CAMPAIGN = 'rentree_2026';

export function isFlyerHit({ src, medium, campaign } = {}) {
  const s = String(src || '').toLowerCase();
  const m = String(medium || '').toLowerCase();
  const c = String(campaign || '').toLowerCase();
  if (s === 'flyer' || s === 'affiche') return true;
  if (s === 'qr' && (m === 'poster' || c === FLYER_CAMPAIGN || c === 'rentree-2026')) return true;
  return false;
}

export function flyerSourceLabel({ src, medium, campaign } = {}) {
  if (isFlyerHit({ src, medium, campaign })) return 'flyer';
  const s = String(src || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
  return s || 'direct';
}

function supabaseHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  };
}

function supabaseUrl(pathname, query = '') {
  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  return `${base}/rest/v1/${pathname}${query}`;
}

export async function recordVisit(input = {}) {
  if (!process.env.SUPABASE_URL) return { ok: false, error: 'no_supabase' };
  const src = flyerSourceLabel(input);
  const row = {
    id: `pv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: 'pageview',
    src,
    visit_date: new Date().toISOString().slice(0, 10),
    salle: String(input.medium || '').slice(0, 40) || null,
    jour: String(input.campaign || '').slice(0, 40) || null,
    jobs: {
      type: 'pageview',
      event: input.event || 'page_vue',
      utm_source: input.src || null,
      utm_medium: input.medium || null,
      utm_campaign: input.campaign || null,
      path: String(input.path || '/').slice(0, 200),
    },
  };
  const res = await fetch(supabaseUrl('seance_offerte_leads'), {
    method: 'POST',
    headers: supabaseHeaders(),
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, error: `http_${res.status}`, detail: String(text).slice(0, 180) };
  }
  return { ok: true, src };
}

export async function summarizeVisits(days = 14) {
  if (!process.env.SUPABASE_URL) return { days: [], total: 0, flyer: 0, other: 0 };
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const res = await fetch(
    supabaseUrl(
      'seance_offerte_leads',
      `?status=eq.pageview&created_at=gte.${encodeURIComponent(since)}&select=src,created_at,salle,jour`
    ),
    { headers: { ...supabaseHeaders(), Prefer: 'return=representation' } }
  );
  const rows = res.ok ? await res.json().catch(() => []) : [];
  const byDay = {};
  let flyer = 0;
  let other = 0;
  for (const r of Array.isArray(rows) ? rows : []) {
    const day = String(r.created_at || '').slice(0, 10);
    if (!day) continue;
    if (!byDay[day]) byDay[day] = { day, total: 0, flyer: 0, other: 0 };
    byDay[day].total += 1;
    if (r.src === 'flyer') {
      byDay[day].flyer += 1;
      flyer += 1;
    } else {
      byDay[day].other += 1;
      other += 1;
    }
  }
  const daily = Object.values(byDay).sort((a, b) => a.day.localeCompare(b.day));
  return { days: daily, total: flyer + other, flyer, other };
}
