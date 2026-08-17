import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { handleInscrire } from '../api/inscrire.js';
import { resetMemoryLeads } from '../lib/leads.js';

process.env.LEADS_BACKEND = 'memory';
process.env.DRY_RUN = '1';
delete process.env.BOXPLUS_BOT_URL;
delete process.env.BREVO_API_KEY;

function mockRes() {
  const res = {
    statusCode: 0,
    headers: {},
    body: null,
    headersSent: false,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    end(raw) {
      this.headersSent = true;
      this.body = JSON.parse(raw);
    },
  };
  return res;
}

function mockReq(body, { method = 'POST', url = '/api/inscrire?test=1' } = {}) {
  return {
    method,
    url,
    headers: { host: 'localhost', 'x-dry-run': '1' },
    body,
    async *[Symbol.asyncIterator]() {},
  };
}

const valid = {
  prenom: 'Camille',
  nom: 'Durand',
  email: 'camille@example.com',
  tel: '0612345678',
  naissance: '1994-05-12',
  sexe: 'F',
  adresse: '18 rue des Lilas',
  code_postal: '31000',
  ville: 'Toulouse',
  salle: 'minimes',
  jour: 'mardi',
  rgpd: true,
  src: 'flyer',
};

describe('POST /api/inscrire', () => {
  before(() => {
    process.env.LEADS_BACKEND = 'memory';
    resetMemoryLeads();
  });
  after(() => resetMemoryLeads());

  it('400 si formulaire incomplet — aucun job', async () => {
    const res = mockRes();
    await handleInscrire(mockReq({ prenom: 'Camille' }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.ok, false);
    assert.ok(Array.isArray(res.body.errors));
  });

  it('200 dry-run : 1 fiche, adresse prospect, photo, pas de vente', async () => {
    const res = mockRes();
    await handleInscrire(mockReq(valid), res);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(res.body.ok, true);
    assert.equal(res.body.dry_run, true);
    assert.equal(res.body.fiches, 1);
    assert.equal(res.body.jobs[0].sale_type, 'none');
    assert.equal(res.body.jobs[0].create_sale, false);
    assert.equal(res.body.jobs[0].address, '18 rue des Lilas');
    assert.equal(res.body.jobs[0].postal_code, '31000');
    assert.equal(res.body.jobs[0].city, 'Toulouse');
    assert.equal(res.body.jobs[0].info_compta, 'SEANCE D ESSAI GRATUITE WEB');
    assert.equal(res.body.jobs[0].has_photo, true);
    assert.equal(res.body.emails.deferred, true);
  });

  it('200 dry-run + ami sans naissance : 2 fiches, Grand Ramier, 01/01/2000', async () => {
    const res = mockRes();
    await handleInscrire(
      mockReq({
        ...valid,
        ami: {
          prenom: 'Alex',
          nom: 'Martin',
          email: 'alex@example.com',
          tel: '0698765432',
          sexe: 'H',
        },
      }),
      res
    );
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(res.body.fiches, 2);
    const ami = res.body.jobs[1];
    assert.equal(ami.is_friend_referral, true);
    assert.equal(ami.birthdate, '2000-01-01');
    assert.equal(ami.address, '10 Avenue du Grand Ramier');
    assert.equal(ami.postal_code, '31400');
    assert.equal(ami.city, 'Toulouse');
    assert.equal(ami.sale_type, 'none');
    assert.equal(ami.has_photo, true);
  });

  it('phase ami : 2e fiche après le prospect, adresse ami si fournie', async () => {
    const first = mockRes();
    await handleInscrire(mockReq(valid), first);
    assert.equal(first.statusCode, 200, JSON.stringify(first.body));
    const orderId = first.body.order_id;
    const second = mockRes();
    await handleInscrire(
      mockReq({
        order_id: orderId,
        phase: 'ami',
        ami: {
          prenom: 'Alex',
          nom: 'Martin',
          email: 'alex@example.com',
          tel: '0698765432',
          sexe: 'H',
          address: '7 allée des Tests',
          postal_code: '31200',
          city: 'Toulouse',
        },
      }),
      second
    );
    assert.equal(second.statusCode, 200, JSON.stringify(second.body));
    assert.equal(second.body.phase, 'ami');
    assert.equal(second.body.jobs[0].is_friend_referral, true);
    assert.equal(second.body.jobs[0].address, '7 allée des Tests');
    assert.equal(second.body.jobs[0].postal_code, '31200');
    assert.equal(second.body.jobs[0].has_photo, true);
  });

  it('phase terminer : pas de 2e fiche, mail prospect seul', async () => {
    const first = mockRes();
    await handleInscrire(mockReq(valid), first);
    assert.equal(first.body.emails.deferred, true);
    const second = mockRes();
    await handleInscrire(mockReq({ order_id: first.body.order_id, phase: 'terminer' }), second);
    assert.equal(second.statusCode, 200, JSON.stringify(second.body));
    assert.equal(second.body.phase, 'terminer');
    assert.equal(second.body.emails.reason, 'dry_run');
    assert.ok(!String(second.body.emails.preview || '').includes('et Alex'));
  });
});
