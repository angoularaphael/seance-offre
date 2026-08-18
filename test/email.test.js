import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  confirmationHtml,
  confirmationPayloadFromData,
  confirmationSubject,
  confirmationText,
  sendConfirmationEmails,
} from '../lib/email.js';

const data = {
  prenom: 'Yavol',
  nom: 'Test',
  email: 'yavol@example.com',
  gym: { label: 'Boxing Center Ramonville', nom: 'Ramonville' },
  jour_nom: 'Lundi',
  visit_date: '2026-08-17',
  ami: { prenom: 'Gojipe', nom: 'Ami', email: 'gojipe@example.com' },
};

describe('mail de confirmation', () => {
  it('HTML duo : les deux prénoms, 0 €, salle et jour', () => {
    const payload = confirmationPayloadFromData(data);
    const html = confirmationHtml(payload);
    assert.match(html, /À lundi, Yavol et Gojipe/);
    assert.match(html, /avec Gojipe|et celle de Gojipe/);
    assert.match(html, /0 €/);
    assert.match(html, /Boxing Center Ramonville/);
    assert.match(html, /Lundi \(17\/08\/2026\)/);
    assert.match(html, /tenue de sport/i);
    assert.match(html, />Confirmation</);
    assert.doesNotMatch(html, /Invitation/);
    assert.equal(confirmationSubject(payload), 'Ta séance d’essai est confirmée — avec Gojipe');
  });

  it('HTML ami : invitation distincte, pas le mail du prospect', () => {
    const host = confirmationPayloadFromData(data);
    const payload = confirmationPayloadFromData(data, { asFriend: true });
    const html = confirmationHtml(payload);
    assert.match(html, /Yavol t’a inscrit/);
    assert.match(html, /offrir une séance d’essai/);
    assert.match(html, /pas obligés de venir le même jour/);
    assert.match(html, /Invitation — séance offerte/);
    assert.match(html, /Inscrit\(e\) par/);
    assert.doesNotMatch(html, />Accompagné</);
    assert.doesNotMatch(html, /ta séance d’essai est confirmée/);
    assert.notEqual(confirmationSubject(payload), confirmationSubject(host));
    assert.notEqual(confirmationHtml(payload), confirmationHtml(host));
    assert.match(confirmationSubject(payload), /Yavol t’a inscrit/);
    assert.match(confirmationText(payload), /t’offrir une séance/);
  });

  it('HTML solo : un seul prénom', () => {
    const payload = confirmationPayloadFromData({ ...data, ami: null });
    const html = confirmationHtml(payload);
    assert.match(html, /À lundi, Yavol\./);
    assert.doesNotMatch(html, /Gojipe/);
    assert.match(html, />Non</);
  });

  it('envoie deux mails distincts au prospect et à l’ami', async () => {
    const prev = process.env.BREVO_API_KEY;
    process.env.BREVO_API_KEY = 'xkeysib-test-key';
    const sent = [];
    const fetchImpl = async (_url, opts) => {
      sent.push(JSON.parse(opts.body));
      return { ok: true, text: async () => '{}' };
    };
    try {
      await sendConfirmationEmails(data, { fetchImpl });
    } finally {
      if (prev == null) delete process.env.BREVO_API_KEY;
      else process.env.BREVO_API_KEY = prev;
    }
    assert.equal(sent.length, 2);
    assert.equal(sent[0].to[0].email, 'yavol@example.com');
    assert.equal(sent[1].to[0].email, 'gojipe@example.com');
    assert.notEqual(sent[0].subject, sent[1].subject);
    assert.match(sent[0].subject, /avec Gojipe/);
    assert.match(sent[1].subject, /Yavol t’a inscrit/);
    assert.match(sent[0].htmlContent, /Confirmation/);
    assert.match(sent[1].htmlContent, /Invitation/);
    assert.doesNotMatch(sent[1].htmlContent, /ta séance d’essai est confirmée/);
  });

  it('n’envoie pas le mail ami si c’est la même adresse', async () => {
    const prev = process.env.BREVO_API_KEY;
    process.env.BREVO_API_KEY = 'xkeysib-test-key';
    const sent = [];
    const fetchImpl = async (_url, opts) => {
      sent.push(JSON.parse(opts.body));
      return { ok: true, text: async () => '{}' };
    };
    try {
      const results = await sendConfirmationEmails(
        { ...data, ami: { ...data.ami, email: data.email } },
        { fetchImpl }
      );
      assert.equal(sent.length, 1);
      assert.equal(results[1].reason, 'same_email_as_host');
    } finally {
      if (prev == null) delete process.env.BREVO_API_KEY;
      else process.env.BREVO_API_KEY = prev;
    }
  });
});
