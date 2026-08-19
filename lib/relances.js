import { MANAGERS } from './constants.js';
import { managerWhatsAppText, relanceProspectText, sendRelanceEmail } from './email.js';
import { listLeads, updateLead } from './leads.js';
import { addDays, parseIsoDate } from './visit-date.js';
import { sendWhatsAppMessage } from './whatsapp.js';
import { forwardJobToBot, publicBaseUrl } from './bot.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function getManager(salle) {
  return MANAGERS[salle] || null;
}

/**
 * Décide l'action de relance pour un lead (horloge injectable).
 * - prospect : 72h après visit_date, aucune vente
 * - manager : 72h après la relance prospect, aucune vente
 */
export function classifyRelance(lead, now = new Date()) {
  if (!lead || lead.dry_run) return { action: 'skip', reason: 'dry_run_or_empty' };
  if (lead.has_sale) return { action: 'skip', reason: 'has_sale' };
  if (lead.status === 'converted' || lead.status === 'closed') {
    return { action: 'skip', reason: lead.status };
  }

  const visit = parseIsoDate(lead.visit_date);
  if (!visit) return { action: 'skip', reason: 'no_visit_date' };

  const t = now.getTime();
  const prospectDue = addDays(visit, 3).getTime();

  if (!lead.prospect_relance_at) {
    if (t < prospectDue) return { action: 'wait', reason: 'before_h72' };
    return { action: 'prospect', reason: 'h72_no_sale' };
  }

  if (lead.manager_relance_at) return { action: 'skip', reason: 'manager_already' };

  const managerDue = new Date(lead.prospect_relance_at).getTime() + 3 * DAY_MS;
  if (t < managerDue) return { action: 'wait', reason: 'before_72h' };

  const manager = getManager(lead.salle);
  if (!manager) return { action: 'error', reason: 'manager_unknown', salle: lead.salle };
  return { action: 'manager', reason: 'h72_no_sale', manager };
}

export function buildCheckSaleJob(lead) {
  return {
    order_id: `${lead.id}#check-sale`,
    action: 'check_sale',
    product_id: 'seance-essai-offerte',
    product_name: 'SEANCE D ESSAI GRATUITE WEB',
    sale_type: 'none',
    gym: lead.salle,
    deciplus_member_id: lead.deciplus_member_id || null,
    customer: {
      first_name: lead.prenom,
      last_name: lead.nom,
      email: lead.email,
      phone: lead.tel,
      birthdate: lead.naissance,
    },
    source: 'seance-offerte-relance',
    status_callback_base: publicBaseUrl(),
  };
}

export async function applyRelance(lead, decision, { dryRun = false, fetchImpl = fetch, sendWa = sendWhatsAppMessage } = {}) {
  if (decision.action === 'prospect') {
    const text = relanceProspectText({ prenom: lead.prenom });
    const wa = await sendWa(lead.tel, text, { fetchImpl, dryRun }).catch((err) => ({
      sent: false,
      error: err.message,
    }));
    const mail = await sendRelanceEmail(lead, { fetchImpl, dryRun }).catch((err) => ({
      sent: false,
      error: err.message,
    }));
    const patch = {
      prospect_relance_at: new Date().toISOString(),
      prospect_relance_wa: wa,
      prospect_relance_email: mail,
      status: 'prospect_relance',
    };
    await updateLead(lead.id, patch);
    return { ok: true, action: 'prospect', wa, mail };
  }

  if (decision.action === 'manager') {
    const manager = decision.manager || getManager(lead.salle);
    if (!manager) {
      await updateLead(lead.id, {
        status: 'error',
        last_error: 'manager_unknown',
      });
      return { ok: false, action: 'error', reason: 'manager_unknown' };
    }
    const text = managerWhatsAppText({ manager, lead });
    const wa = await sendWa(manager.telephone, text, { fetchImpl, dryRun }).catch((err) => ({
      sent: false,
      error: err.message,
    }));
    await updateLead(lead.id, {
      manager_relance_at: new Date().toISOString(),
      manager_relance_wa: wa,
      status: 'manager_notified',
    });
    return { ok: true, action: 'manager', wa };
  }

  if (decision.action === 'error') {
    await updateLead(lead.id, { status: 'error', last_error: decision.reason });
  }
  return { ok: true, action: decision.action, reason: decision.reason };
}

export async function runRelances({ now = new Date(), dryRun = false, fetchImpl = fetch, enqueueCheck = true } = {}) {
  const leads = await listLeads();
  const results = [];
  for (const lead of leads) {
    const decision = classifyRelance(lead, now);
    if (decision.action === 'prospect' || decision.action === 'manager') {
      if (enqueueCheck && lead.deciplus_member_id && !dryRun) {
        await forwardJobToBot(buildCheckSaleJob(lead), { fetchImpl }).catch(() => null);
      }
      results.push(await applyRelance(lead, decision, { dryRun, fetchImpl }));
    } else {
      results.push({ id: lead.id, ...decision });
    }
  }
  return results;
}
