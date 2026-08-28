import { GYM_ESSAI_WHATSAPP } from './constants.js';
import { listLeads, updateLead } from './leads.js';
import { sendWhatsAppMessage } from './whatsapp.js';

function gymKey(salle) {
  const raw = String(salle || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!raw) return '';
  if (GYM_ESSAI_WHATSAPP[raw]) return raw;
  if (raw.includes('cyprien')) return 'st-cyprien';
  if (raw.includes('etats') || raw.includes('etats-unis')) return 'etats-unis';
  if (raw.includes('portet')) return 'portet';
  if (raw.includes('ramonville')) return 'ramonville';
  if (raw.includes('minimes')) return 'minimes';
  return raw;
}

export function getGymEssaiTarget(salle) {
  return GYM_ESSAI_WHATSAPP[gymKey(salle)] || null;
}

export function isSeanceOfferteLead(lead) {
  if (!lead || lead.dry_run) return false;
  const src = String(lead.src || lead.source || '');
  const pid = String(lead.product_id || '');
  if (pid === 'seance-essai-offerte') return true;
  if (/seance-offerte/i.test(src)) return true;
  return /^SO-/i.test(String(lead.id || ''));
}

export function gymNotifyAlreadySent(lead, { ami = false } = {}) {
  const key = ami ? 'gym_notify_ami_wa' : 'gym_notify_wa';
  return Boolean(lead?.[key]?.sent);
}

function formatVisit(iso, jourNom) {
  const s = String(iso || '').slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = m ? `${m[3]}/${m[2]}/${m[1]}` : s;
  const jour = String(jourNom || '').trim();
  if (jour && date) return `${jour} (${date})`;
  return jour || date || 'non renseigné';
}

export function gymEssaiWhatsAppText(lead, { ami = false } = {}) {
  const person = ami && lead.ami ? lead.ami : lead;
  const salle = lead.salle_label || lead.gym?.label || lead.salle || '';
  const lines = [
    ami ? 'Séance d’essai gratuite web — accompagnateur' : 'Séance d’essai gratuite web',
    '',
    `Salle : ${salle}`,
    `Nom : ${person.prenom || ''} ${person.nom || ''}`.replace(/\s+/g, ' ').trim(),
    `Tél : ${person.tel || person.telephone || ''}`,
    `Email : ${person.email || 'non renseigné'}`,
    `Jour de venue prévu : ${formatVisit(lead.visit_date, lead.jour_nom || lead.jour)}`,
  ];
  if (ami && (lead.prenom || lead.nom)) {
    lines.splice(3, 0, `Inscrit(e) par : ${lead.prenom || ''} ${lead.nom || ''}`.replace(/\s+/g, ' ').trim());
  } else if (!ami && lead.ami?.prenom) {
    lines.push(`Ami(e) : ${lead.ami.prenom} ${lead.ami.nom || ''}`.trim());
  }
  lines.push('', 'Message automatique Boxing Center');
  return lines.join('\n');
}

export async function notifyGymOfEssai(lead, { ami = false, dryRun = false, fetchImpl = fetch, sendWa = sendWhatsAppMessage } = {}) {
  if (!lead || lead.dry_run) return { sent: false, reason: 'dry_run' };
  if (gymNotifyAlreadySent(lead, { ami })) return { sent: false, reason: 'already', already: true };
  if (ami && !lead.ami) return { sent: false, reason: 'no_ami' };

  const target = getGymEssaiTarget(lead.salle);
  if (!target) return { sent: false, reason: 'gym_unknown', salle: lead.salle };
  if (dryRun) return { sent: false, reason: 'dry_run', would_send: true, to: target.telephone, salle: lead.salle };

  const text = gymEssaiWhatsAppText(lead, { ami });
  const wa = await sendWa(target.telephone, text, { fetchImpl, dryRun }).catch((err) => ({
    sent: false,
    error: err.message,
  }));
  const patchKey = ami ? 'gym_notify_ami_wa' : 'gym_notify_wa';
  const stored = {
    sent: Boolean(wa?.sent),
    to: target.telephone,
    salle: lead.salle,
    at: new Date().toISOString(),
    ...(wa?.error ? { error: wa.error } : {}),
    ...(wa?.reason ? { reason: wa.reason } : {}),
  };
  if (lead.id) {
    await updateLead(lead.id, { [patchKey]: stored });
  }
  return { ...stored, wa };
}

export async function backfillGymEssaiWhatsApp({
  dryRun = false,
  fetchImpl = fetch,
  sendWa = sendWhatsAppMessage,
  sleepMs = 1200,
  now = Date.now,
} = {}) {
  const leads = (await listLeads()).filter(isSeanceOfferteLead);
  const results = [];
  for (const lead of leads) {
    const jobs = [];
    if (!gymNotifyAlreadySent(lead, { ami: false })) jobs.push({ ami: false });
    if (lead.ami && !gymNotifyAlreadySent(lead, { ami: true })) jobs.push({ ami: true });
    if (!jobs.length) {
      results.push({ id: lead.id, skipped: true, reason: 'already' });
      continue;
    }
    for (const job of jobs) {
      const out = await notifyGymOfEssai(lead, { ami: job.ami, dryRun, fetchImpl, sendWa });
      results.push({ id: lead.id, ami: job.ami, ...out });
      if (!dryRun && out.sent && sleepMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, sleepMs));
      }
    }
  }
  void now;
  return results;
}
