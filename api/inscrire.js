import '../lib/load-env.js';
import {
  buildDeciplusJobs,
  buildFriendJob,
  errorMessage,
  isDryRunRequest,
  jobPublicView,
  validateAmiOnly,
  validateInscription,
} from '../lib/inscription.js';
import { forwardJobs } from '../lib/bot.js';
import { sendConfirmationEmails, sendInternalNotification } from '../lib/email.js';
import { notifyGymOfEssai } from '../lib/gym-notify.js';
import { getGym } from '../lib/gyms.js';
import { getLead, saveLead } from '../lib/leads.js';

function queryFromUrl(req) {
  try {
    const host = req.headers?.host || 'localhost';
    const url = new URL(req.url || '/', `http://${host}`);
    return Object.fromEntries(url.searchParams.entries());
  } catch {
    return {};
  }
}

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
}

function emailDataFromLead(lead, { ami = null, ami_pending = false } = {}) {
  const gym = getGym(lead.salle);
  return {
    orderId: lead.id,
    prenom: lead.prenom,
    nom: lead.nom,
    email: lead.email,
    tel: lead.tel,
    naissance: lead.naissance,
    sexe: lead.sexe,
    adresse: lead.adresse,
    code_postal: lead.code_postal,
    ville: lead.ville,
    salle: lead.salle,
    gym,
    salle_label: lead.salle_label || gym?.label,
    jour: lead.jour,
    jour_nom: lead.jour_nom,
    visit_date: lead.visit_date,
    src: lead.src,
    ami,
    ami_pending,
  };
}

async function handleFinishPhase(res, body, dryRun) {
  const orderId = String(body.order_id || '').trim();
  const lead = await getLead(orderId);
  if (!lead) {
    json(res, 404, { ok: false, error: 'Inscription introuvable. Repars du début du formulaire.' });
    return;
  }

  const data = emailDataFromLead(lead, { ami: null, ami_pending: false });
  const emails = await sendConfirmationEmails(data, { dryRun }).catch((err) => [
    { sent: false, error: err.message },
  ]);
  const mailFailed = !dryRun && emails.some((e) => e && e.sent === false && e.reason !== 'no_recipient');
  if (mailFailed) {
    json(res, 502, {
      ok: false,
      error: 'Inscription enregistrée, mais la facture n’a pas pu être envoyée. Réessaie dans un instant.',
      order_id: orderId,
      emails,
    });
    return;
  }
  lead.status = dryRun ? 'dry_run' : 'confirmed';
  lead.ami = null;
  await saveLead(lead);
  if (!dryRun) {
    await notifyGymOfEssai(lead, { dryRun }).catch(() => null);
  }

  json(res, 200, {
    ok: true,
    order_id: orderId,
    dry_run: dryRun,
    phase: 'terminer',
    emails,
  });
}

async function handleAmiPhase(res, body, dryRun) {
  const orderId = String(body.order_id || '').trim();
  const lead = await getLead(orderId);
  if (!lead) {
    json(res, 404, { ok: false, error: 'Inscription introuvable. Repars du début du formulaire.' });
    return;
  }

  const parsedAmi = validateAmiOnly(body.ami);
  if (!parsedAmi.ok) {
    json(res, 400, {
      ok: false,
      error: errorMessage(parsedAmi.errors) || 'Infos de l’ami(e) incomplètes.',
      errors: parsedAmi.errors,
    });
    return;
  }

  const data = emailDataFromLead(lead, { ami: parsedAmi.friend });
  const friendJob = buildFriendJob(data, { orderId });
  const already = Array.isArray(lead.jobs) && lead.jobs.includes(friendJob.order_id);
  let botResults = [];

  if (!already && !dryRun) {
    try {
      botResults = await forwardJobs([friendJob]);
    } catch (err) {
      lead.status = 'error';
      lead.last_error = err.message;
      await saveLead(lead).catch(() => {});
      await sendInternalNotification(data, { orderId, error: err.message }).catch(() => {});
      json(res, 502, {
        ok: false,
        error: 'Échec création fiche ami(e) Deciplus. L’équipe a été prévenue.',
        order_id: orderId,
      });
      return;
    }
  }

  lead.ami = parsedAmi.friend;
  lead.jobs = [...new Set([...(lead.jobs || []), friendJob.order_id])];
  lead.status = dryRun ? 'dry_run' : 'queued';
  lead.last_error = null;
  await saveLead(lead);

  const emails = already
    ? [{ sent: false, reason: 'already_created' }]
    : await sendConfirmationEmails(data, { dryRun }).catch((err) => [
        { sent: false, error: err.message },
      ]);
  if (!already) {
    await sendInternalNotification(data, { orderId, dryRun }).catch(() => {});
    if (!dryRun) {
      await notifyGymOfEssai({ ...lead, ami: parsedAmi.friend }, { ami: true, dryRun }).catch(() => null);
    }
  }

  console.info('[seance-offerte] ami', {
    order_id: orderId,
    dry_run: dryRun,
    already,
  });

  json(res, 200, {
    ok: true,
    order_id: orderId,
    dry_run: dryRun,
    phase: 'ami',
    fiches: lead.jobs.length,
    jobs: [jobPublicView(friendJob)],
    visit_date: lead.visit_date,
    bot: botResults,
    emails,
  });
}

export async function handleInscrire(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    json(res, 405, { ok: false, error: 'Méthode non autorisée' });
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    json(res, 400, { ok: false, error: 'JSON invalide' });
    return;
  }

  const dryRun = isDryRunRequest({
    headers: req.headers || {},
    query: queryFromUrl(req),
    body,
  });

  if (body.order_id && body.phase === 'terminer') {
    await handleFinishPhase(res, body, dryRun);
    return;
  }
  if (body.order_id && (body.phase === 'ami' || body.ami)) {
    await handleAmiPhase(res, body, dryRun);
    return;
  }

  const parsed = validateInscription(body);
  if (!parsed.ok) {
    json(res, 400, {
      ok: false,
      error: errorMessage(parsed.errors) || 'Formulaire incomplet',
      errors: parsed.errors,
    });
    return;
  }

  const { orderId, jobs } = buildDeciplusJobs(parsed.data);
  const lead = {
    id: orderId,
    prenom: parsed.data.prenom,
    nom: parsed.data.nom,
    email: parsed.data.email,
    tel: parsed.data.tel,
    naissance: parsed.data.naissance,
    sexe: parsed.data.sexe,
    adresse: parsed.data.adresse,
    code_postal: parsed.data.code_postal,
    ville: parsed.data.ville,
    salle: parsed.data.salle,
    salle_label: parsed.data.gym.label,
    jour: parsed.data.jour,
    jour_nom: parsed.data.jour_nom,
    visit_date: parsed.data.visit_date,
    src: parsed.data.src,
    ami: parsed.data.ami,
    jobs: jobs.map((j) => j.order_id),
    dry_run: dryRun,
    has_sale: false,
    status: dryRun ? 'dry_run' : 'queued',
  };

  try {
    await saveLead(lead);
  } catch (err) {
    json(res, 500, { ok: false, error: `Enregistrement impossible : ${err.message}` });
    return;
  }

  let botResults = [];
  let botError = null;
  if (!dryRun) {
    try {
      botResults = await forwardJobs(jobs);
    } catch (err) {
      botError = err.message;
      lead.status = 'error';
      lead.last_error = botError;
      await saveLead(lead).catch(() => {});
      await sendInternalNotification(parsed.data, { orderId, error: botError }).catch(() => {});
      json(res, 502, {
        ok: false,
        error: 'Échec création fiche Deciplus. L’équipe a été prévenue.',
        order_id: orderId,
      });
      return;
    }
  }

  const emails = { deferred: true };
  const internal = await sendInternalNotification(
    { ...parsed.data, ami_pending: true },
    { orderId, dryRun }
  ).catch((err) => ({
    sent: false,
    error: err.message,
  }));
  const gymWa = dryRun
    ? { sent: false, reason: 'dry_run' }
    : await notifyGymOfEssai(lead, { dryRun }).catch((err) => ({
        sent: false,
        error: err.message,
      }));

  console.info('[seance-offerte] inscription', {
    order_id: orderId,
    dry_run: dryRun,
    fiches: jobs.length,
    salle: parsed.data.salle,
    visit_date: parsed.data.visit_date,
    gym_wa: gymWa?.sent || false,
  });

  json(res, 200, {
    ok: true,
    order_id: orderId,
    dry_run: dryRun,
    fiches: jobs.length,
    jobs: jobs.map(jobPublicView),
    visit_date: parsed.data.visit_date,
    bot: botResults,
    emails,
    internal,
  });
}

export default async function handler(req, res) {
  try {
    await handleInscrire(req, res);
  } catch (err) {
    if (!res.headersSent) {
      json(res, 500, { ok: false, error: err.message || 'Erreur serveur' });
    }
  }
}
