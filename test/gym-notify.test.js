import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  backfillGymEssaiWhatsApp,
  getGymEssaiTarget,
  gymEssaiWhatsAppText,
  gymNotifyAlreadySent,
  isSeanceOfferteLead,
  notifyGymOfEssai,
} from '../lib/gym-notify.js';
import { resetMemoryLeads, saveLead } from '../lib/leads.js';

process.env.LEADS_BACKEND = 'memory';

const lead = {
  id: 'SO-1',
  prenom: 'Camille',
  nom: 'Durand',
  tel: '0612345678',
  email: 'camille@example.com',
  salle: 'minimes',
  salle_label: 'Boxing Center Minimes',
  jour_nom: 'Mardi',
  visit_date: '2026-09-01',
  src: 'seance-offerte-web',
  product_id: 'seance-essai-offerte',
};

describe('WhatsApp essai gratuit salle', () => {
  before(() => {
    process.env.LEADS_BACKEND = 'memory';
    resetMemoryLeads();
  });
  after(() => resetMemoryLeads());

  it('Minimes et États-Unis partagent le même numéro, Portet et St-Cyprien ont le leur', () => {
    assert.equal(getGymEssaiTarget('minimes').telephone, '+33767919166');
    assert.equal(getGymEssaiTarget('etats-unis').telephone, '+33767919166');
    assert.equal(getGymEssaiTarget('portet').telephone, '+33687900216');
    assert.equal(getGymEssaiTarget('st-cyprien').telephone, '+33625745369');
    assert.equal(getGymEssaiTarget('minimes').telephone, getGymEssaiTarget('etats-unis').telephone);
    assert.equal(getGymEssaiTarget('Boxing Center Minimes').telephone, '+33767919166');
    assert.equal(getGymEssaiTarget('États-Unis').telephone, '+33767919166');
    assert.equal(getGymEssaiTarget('Saint-Cyprien').telephone, '+33625745369');
  });

  it('rédige le message salle avec nom, tel et jour', () => {
    const text = gymEssaiWhatsAppText(lead);
    assert.match(text, /Séance d’essai gratuite web/);
    assert.match(text, /Boxing Center Minimes/);
    assert.match(text, /Camille Durand/);
    assert.match(text, /0612345678/);
    assert.match(text, /Mardi \(01\/09\/2026\)/);
  });

  it('ignore les leads boutique payants et les dry-run', () => {
    assert.equal(isSeanceOfferteLead({ id: 'BC-1', product_id: 'seance-essai', source: 'boxplus-inscription' }), false);
    assert.equal(isSeanceOfferteLead({ ...lead, dry_run: true }), false);
    assert.equal(isSeanceOfferteLead(lead), true);
  });

  it('envoie une fois puis skip', async () => {
    await saveLead(lead);
    const sent = [];
    const sendWa = async (phone, message) => {
      sent.push({ phone, message });
      return { sent: true };
    };
    const first = await notifyGymOfEssai(lead, { sendWa });
    assert.equal(first.sent, true);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].phone, '+33767919166');
    const again = await notifyGymOfEssai({ ...lead, gym_notify_wa: first }, { sendWa });
    assert.equal(again.already, true);
    assert.equal(sent.length, 1);
  });

  it('rattrape les leads sans WhatsApp', async () => {
    resetMemoryLeads();
    await saveLead(lead);
    await saveLead({
      ...lead,
      id: 'SO-2',
      salle: 'portet',
      salle_label: 'Boxing Center Portet',
      gym_notify_wa: { sent: true, to: '+33687900216' },
    });
    const sent = [];
    const results = await backfillGymEssaiWhatsApp({
      sleepMs: 0,
      sendWa: async (phone) => {
        sent.push(phone);
        return { sent: true };
      },
    });
    assert.equal(sent.length, 1);
    assert.equal(sent[0], '+33767919166');
    assert.equal(results.filter((r) => r.sent).length, 1);
    assert.equal(results.filter((r) => r.skipped).length, 1);
  });

  it('gymNotifyAlreadySent lit le flag', () => {
    assert.equal(gymNotifyAlreadySent({ gym_notify_wa: { sent: true } }), true);
    assert.equal(gymNotifyAlreadySent({ gym_notify_ami_wa: { sent: true } }, { ami: true }), true);
    assert.equal(gymNotifyAlreadySent({}), false);
  });
});
