#!/usr/bin/env node
/**
 * Smoke hors CI : construit 2 jobs séance offerte (prospect + ami sans naissance)
 * et les envoie au bot si BOXPLUS_BOT_URL est défini.
 *
 *   node scripts/smoke-deciplus.js
 */
import { buildDeciplusJobs, validateInscription } from '../lib/inscription.js';
import { forwardJobs } from '../lib/bot.js';

const stamp = Date.now();
const parsed = validateInscription({
  prenom: 'TestOfferte',
  nom: `Solo${String(stamp).slice(-6)}`,
  email: `testofferte.${stamp}@example.com`,
  tel: `06${String(stamp).slice(-8)}`,
  naissance: '1994-05-12',
  sexe: 'F',
  adresse: '18 rue des Lilas',
  code_postal: '31000',
  ville: 'Toulouse',
  salle: 'minimes',
  jour: 'samedi',
  rgpd: true,
  src: 'smoke',
  ami: {
    prenom: 'TestOfferte',
    nom: `Ami${String(stamp).slice(-6)}`,
    email: `testofferte.ami.${stamp}@example.com`,
    tel: `07${String(stamp).slice(-8)}`,
    sexe: 'H',
  },
});

if (!parsed.ok) {
  console.error('Payload invalide', parsed.errors);
  process.exit(1);
}

const { orderId, jobs } = buildDeciplusJobs(parsed.data, { orderId: `TEST-OFFERTE-${stamp}` });
console.log('order_id', orderId);
console.log(
  'jobs',
  jobs.map((j) => ({
    order_id: j.order_id,
    friend: j.is_friend_referral,
    birthdate: j.customer.birthdate,
    address: `${j.customer.address}, ${j.customer.postal_code} ${j.customer.city}`,
    sale_type: j.sale_type,
    create_sale: j.create_sale,
    info_compta: j.info_compta,
  }))
);

if (!process.env.BOXPLUS_BOT_URL) {
  console.log('BOXPLUS_BOT_URL manquant — jobs non envoyés. Nettoyage : BOXPLUS npm run cleanup:test');
  process.exit(0);
}

const results = await forwardJobs(jobs);
console.log('bot', results);
console.log('Attendu dans Deciplus : 2 fiches, mention SEANCE D ESSAI GRATUITE WEB, 0 vente.');
console.log('Nettoyage : cd ../BOXPLUS && npm run cleanup:test');
