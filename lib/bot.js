const RAPHAEL_LIVE = 'http://172.81.128.14:22189';

function normalizeBase(url) {
  return String(url || '')
    .trim()
    .replace(/\/$/, '');
}

/** prem-eu1:20311 n’existe plus (DNS mort) — Raphaël est sur 172.81.128.14:22189. */
function rewriteDeadBotUrl(url) {
  const base = normalizeBase(url);
  if (!base) return '';
  if (/prem-eu1\.bot-hosting\.net:20311/i.test(base)) return RAPHAEL_LIVE;
  return base;
}

export function botCandidates() {
  const seen = new Set();
  const out = [];
  for (const raw of [
    process.env.BOXPLUS_BOT_URL,
    process.env.BOXPLUS_BOT_URL_SALES_2,
    process.env.BOXPLUS_BOT_URL_OPS,
  ]) {
    const base = rewriteDeadBotUrl(raw);
    if (!base || seen.has(base)) continue;
    seen.add(base);
    out.push(base);
  }
  if (!out.length) out.push(RAPHAEL_LIVE);
  return out;
}

function botBase() {
  return botCandidates()[0] || '';
}

function secret() {
  return String(process.env.SYNC_SECRET || process.env.BRIDGE_SECRET || '').trim();
}

function isNetworkError(err) {
  const msg = String(err?.message || err || '');
  const cause = String(err?.cause?.code || err?.code || '');
  return /fetch failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|UND_ERR|network/i.test(`${msg} ${cause}`);
}

export function publicBaseUrl() {
  const explicit = String(process.env.PUBLIC_URL || process.env.SEANCE_OFFERTE_URL || '').replace(/\/$/, '');
  if (explicit) return explicit;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:5610';
}

export async function forwardJobToBot(order, { fetchImpl = fetch } = {}) {
  const candidates = botCandidates();
  if (!candidates.length) {
    return { forwarded: false, reason: 'no_bot_url' };
  }

  const payload = {
    ...order,
    status_callback_base: order.status_callback_base || publicBaseUrl(),
  };
  let lastErr = null;

  for (const base of candidates) {
    try {
      const res = await fetchImpl(`${base}/api/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sync-secret': secret(),
        },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || `Bot ingest HTTP ${res.status}`);
      }
      if (base !== candidates[0]) {
        console.warn('[seance-offerte] bot fallback', { from: candidates[0], to: base });
      }
      return { forwarded: true, bot_url: base, ...body };
    } catch (err) {
      lastErr = err;
      if (!isNetworkError(err)) throw err;
      console.warn('[seance-offerte] bot unreachable', { base, error: err.message });
    }
  }

  throw lastErr || new Error('fetch failed');
}

export async function forwardJobs(jobs, opts = {}) {
  const results = [];
  for (const job of jobs) {
    results.push(await forwardJobToBot(job, opts));
  }
  return results;
}
