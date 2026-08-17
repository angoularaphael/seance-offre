import { OFFRES_URL } from './constants.js';
import { formatFrDate } from './visit-date.js';

function apiKey() {
  return String(process.env.BREVO_API_KEY || '')
    .trim()
    .replace(/^["']|["']$/g, '');
}

export function isEmailConfigured() {
  return apiKey().startsWith('xkeysib-');
}

function sender() {
  return {
    name: process.env.BREVO_SENDER_NAME || 'Boxing Center',
    email: process.env.BREVO_SENDER_EMAIL || 'suzinabot@gmail.com',
  };
}

function internalInbox() {
  return (
    process.env.SEANCE_OFFERTE_INBOX ||
    process.env.BREVO_INTERNAL_TO ||
    'seancegratuite@boxingcenter.fr'
  );
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function confirmationSubject({ amiPrenom, hostPrenom } = {}) {
  if (hostPrenom) return `${hostPrenom} t’invite à une séance d’essai offerte Boxing Center`;
  if (amiPrenom) return 'Ta séance d’essai offerte — toi et un(e) ami(e)';
  return 'Confirmation de ta séance d’essai offerte Boxing Center';
}

function confirmationHeadline({ prenom, jourNom, amiPrenom, hostPrenom }) {
  const jour = jourNom ? String(jourNom).toLowerCase() : '';
  if (hostPrenom) {
    return jour ? `${hostPrenom} t’a invité — à ${jour}.` : `${hostPrenom} t’a invité.`;
  }
  if (jour && amiPrenom) return `À ${jour}, ${prenom} et ${amiPrenom}.`;
  if (jour) return `À ${jour}, ${prenom}.`;
  if (amiPrenom) return `À très vite, ${prenom} et ${amiPrenom}.`;
  return `À très vite, ${prenom}.`;
}

function confirmationLead({ prenom, salleLabel, amiPrenom, hostPrenom }) {
  const salle = salleLabel ? ` à ${salleLabel}` : '';
  if (hostPrenom) {
    return `${prenom}, ${hostPrenom} t’a invité(e) à une séance d’essai offerte${salle}. Ta séance est offerte, comme la sienne. Présentez-vous à l’accueil ensemble.`;
  }
  if (amiPrenom) {
    return `${prenom}, ta séance d’essai est enregistrée${salle}, avec ${amiPrenom}. La séance de ${amiPrenom} est offerte aussi.`;
  }
  return `Ta séance d’essai est enregistrée${salle}.`;
}

export function confirmationPayloadFromData(data, { asFriend = false } = {}) {
  const visit = data.visit_date ? formatFrDate(data.visit_date) : '';
  const salleLabel = data.gym?.label || data.salle_label || '';
  const jourNom = data.jour_nom || '';
  const jourLabel = `${jourNom}${visit ? ` (${visit})` : ''}`.trim();
  if (asFriend && data.ami) {
    return {
      prenom: data.ami.prenom,
      salleLabel,
      jourNom,
      jourLabel,
      hostPrenom: data.prenom || '',
      amiPrenom: '',
    };
  }
  return {
    prenom: data.prenom,
    salleLabel,
    jourNom,
    jourLabel,
    amiPrenom: data.ami?.prenom || '',
    hostPrenom: '',
  };
}

export function confirmationText(input = {}) {
  const { prenom, salleLabel, jourLabel } = input;
  const lignes = [
    `Bonjour ${prenom},`,
    '',
    confirmationLead(input),
    '',
    `Salle : ${salleLabel}`,
    `Jour prévu : ${jourLabel}`,
    '',
    'À régler sur place : 0 € — au lieu de 10 €.',
    '',
    'Présente-toi à l’accueil en tenue de sport. Le matériel est prêté. Une bouteille d’eau suffit.',
    '',
    'L’équipe Boxing Center',
  ];
  return lignes.join('\n');
}

function row(label, value) {
  return `<tr>
    <td style="padding:12px 0;border-bottom:1px solid #2a3140;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#9aa3b5;font-family:Arial,Helvetica,sans-serif">${label}</td>
    <td style="padding:12px 0;border-bottom:1px solid #2a3140;font-size:16px;color:#f4f1ea;text-align:right;font-family:Arial,Helvetica,sans-serif">${value}</td>
  </tr>`;
}

export function confirmationHtml(input = {}) {
  const prenom = escapeHtml(input.prenom || '');
  const headline = escapeHtml(confirmationHeadline(input));
  const lead = escapeHtml(confirmationLead(input));
  const salle = escapeHtml(input.salleLabel || '—');
  const jour = escapeHtml(input.jourLabel || '—');
  const duo = Boolean(input.amiPrenom || input.hostPrenom);
  const accompagne = duo
    ? escapeHtml(
        input.amiPrenom
          ? `${input.prenom} et ${input.amiPrenom}`
          : `${input.hostPrenom} et ${input.prenom}`
      )
    : 'Non';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${headline}</title>
</head>
<body style="margin:0;padding:0;background:#07090d;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#07090d;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#0c1018;border:1px solid #2a3140;">
          <tr>
            <td style="height:4px;background:#e8001c;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 32px 12px;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#e8001c;">Boxing Center</p>
              <p style="margin:8px 0 0;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#9aa3b5;">Séance d'essai offerte</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 0;font-family:Georgia,Times,serif;">
              <h1 style="margin:0;font-size:32px;line-height:1.15;font-weight:400;color:#f4f1ea;">${headline}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px 8px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#c8cdd8;">
              <p style="margin:0 0 12px;color:#f4f1ea;">Bonjour ${prenom},</p>
              <p style="margin:0;">${lead}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                ${row('Salle', salle)}
                ${row('Jour prévu', jour)}
                ${row('À régler sur place', '<span style="color:#e8001c;font-weight:700;">0 €</span> <span style="color:#9aa3b5;font-size:13px;">— au lieu de 10 €</span>')}
                ${row('Accompagné', accompagne)}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#9aa3b5;">Ce que tu apportes</p>
              <p style="margin:0;font-size:15px;line-height:1.7;color:#c8cdd8;">Une tenue de sport<br/>Une bouteille d'eau<br/>Rien d'autre — le matériel est prêté</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#c8cdd8;">
              Présente-toi à l'accueil. L'équipe t'attend.
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px;border-top:1px solid #2a3140;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9aa3b5;">
              Boxing Center · Toulouse<br/>
              <a href="https://boxingcenter.fr" style="color:#e8001c;text-decoration:none;">boxingcenter.fr</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function relanceProspectText({ prenom }) {
  return [
    `Bonjour ${prenom},`,
    '',
    'Il ne vous reste que très peu de temps pour pouvoir bénéficier de nos offres promos 29 € et 259 €.',
    '',
    'Pour finaliser votre inscription, rendez-vous sur :',
    OFFRES_URL,
    '',
    'L’équipe BOXING CENTER',
  ].join('\n');
}

export function managerWhatsAppText({ manager, lead }) {
  return [
    `Bonjour ${manager.nom},`,
    '',
    'Le prospect suivant a réalisé une séance d’essai gratuite web mais aucune vente n’apparaît sur sa fiche Deciplus malgré la relance automatique.',
    '',
    'Merci d’effectuer une dernière tentative téléphonique.',
    '',
    'Informations prospect :',
    `Nom : ${lead.nom}`,
    `Prénom : ${lead.prenom}`,
    `Téléphone : ${lead.tel}`,
    `Email : ${lead.email}`,
    `Salle choisie : ${lead.salle_label || lead.salle}`,
    `Jour de venue prévu : ${lead.visit_date ? formatFrDate(lead.visit_date) : lead.jour_nom}`,
    'Offre d’intérêt : Séance d’essai gratuite web',
    '',
    'Message automatique Boxing Center',
  ].join('\n');
}

export function internalRecapHtml({ data, orderId, dryRun, error }) {
  const ami = data.ami
    ? `<p><strong>Ami(e)</strong> : ${escapeHtml(data.ami.prenom)} ${escapeHtml(data.ami.nom)} — ${escapeHtml(data.ami.email)} — ${escapeHtml(data.ami.tel)}</p>`
    : '<p>Pas d’ami(e).</p>';
  return `
    <h2>Inscription séance d’essai offerte</h2>
    <p>Référence : <code>${escapeHtml(orderId)}</code>${dryRun ? ' — DRY RUN' : ''}</p>
    ${error ? `<p style="color:#b00"><strong>Erreur :</strong> ${escapeHtml(error)}</p>` : ''}
    <p><strong>Prospect</strong> : ${escapeHtml(data.prenom)} ${escapeHtml(data.nom)}<br/>
    ${escapeHtml(data.email)} — ${escapeHtml(data.tel)}<br/>
    Né(e) le ${escapeHtml(data.naissance)} — ${escapeHtml(data.sexe)}<br/>
    ${escapeHtml(data.adresse || data.address?.address || '')}, ${escapeHtml(data.code_postal || data.address?.postal_code || '')} ${escapeHtml(data.ville || data.address?.city || '')}</p>
    <p>Salle : ${escapeHtml(data.gym?.label || data.salle)}<br/>
    Jour prévu : ${escapeHtml(data.jour_nom)} (${escapeHtml(data.visit_date)})</p>
    ${ami}
    <p>Source : ${escapeHtml(data.src)}</p>
  `;
}

export async function sendEmailViaBrevo({ to, subject, html, text, fetchImpl = fetch }) {
  if (!to) return { sent: false, reason: 'no_recipient' };
  if (!isEmailConfigured()) return { sent: false, reason: 'brevo_not_configured' };
  const res = await fetchImpl('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: sender(),
      to: [{ email: to }],
      subject,
      htmlContent: html || `<p>${escapeHtml(text || '')}</p>`,
      textContent: text || undefined,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return { sent: true, via: 'brevo', to };
}

export async function sendConfirmationEmails(data, { dryRun = false, fetchImpl = fetch, onlyAmi = false } = {}) {
  const principal = confirmationPayloadFromData(data);
  if (dryRun) {
    return { sent: false, reason: 'dry_run', preview: confirmationText(principal) };
  }
  const results = [];
  if (!onlyAmi) {
    results.push(
      await sendEmailViaBrevo({
        to: data.email,
        subject: confirmationSubject(principal),
        text: confirmationText(principal),
        html: confirmationHtml(principal),
        fetchImpl,
      })
    );
  }
  if (data.ami?.email) {
    const ami = confirmationPayloadFromData(data, { asFriend: true });
    results.push(
      await sendEmailViaBrevo({
        to: data.ami.email,
        subject: confirmationSubject(ami),
        text: confirmationText(ami),
        html: confirmationHtml(ami),
        fetchImpl,
      })
    );
  }
  return results;
}

export async function sendInternalNotification(data, { orderId, dryRun, error, fetchImpl = fetch } = {}) {
  if (dryRun) return { sent: false, reason: 'dry_run' };
  return sendEmailViaBrevo({
    to: internalInbox(),
    subject: error
      ? `[Erreur] Séance offerte ${orderId}`
      : `Séance offerte — ${data.prenom} ${data.nom} — ${data.gym?.nom || data.salle}`,
    html: internalRecapHtml({ data, orderId, dryRun, error }),
    fetchImpl,
  });
}

export async function sendRelanceEmail(lead, { fetchImpl = fetch, dryRun = false } = {}) {
  if (dryRun) return { sent: false, reason: 'dry_run' };
  if (!lead.email) return { sent: false, reason: 'no_recipient' };
  const text = relanceProspectText({ prenom: lead.prenom });
  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#07090d;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#07090d;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#0c1018;border:1px solid #2a3140;">
        <tr><td style="height:4px;background:#e8001c;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:28px 32px 8px;font-family:Arial,Helvetica,sans-serif;">
          <p style="margin:0;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#e8001c;">Boxing Center</p>
          <h1 style="margin:12px 0 0;font-family:Georgia,Times,serif;font-size:28px;font-weight:400;color:#f4f1ea;line-height:1.2;">Il reste peu de temps</h1>
        </td></tr>
        <tr><td style="padding:16px 32px 8px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#c8cdd8;">
          <p style="margin:0 0 12px;color:#f4f1ea;">Bonjour ${escapeHtml(lead.prenom)},</p>
          <p style="margin:0;">Il ne te reste que très peu de temps pour bénéficier de nos offres promos 29 € et 259 €.</p>
        </td></tr>
        <tr><td style="padding:20px 32px 32px;text-align:center;">
          <a href="${OFFRES_URL}" style="display:inline-block;background:#e8001c;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 26px;font-family:Arial,Helvetica,sans-serif;">Voir les offres</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  return sendEmailViaBrevo({
    to: lead.email,
    subject: 'Boxing Center — il reste peu de temps pour nos offres 29 € et 259 €',
    text,
    html,
    fetchImpl,
  });
}
