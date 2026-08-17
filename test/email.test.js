import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  confirmationHtml,
  confirmationPayloadFromData,
  confirmationSubject,
  confirmationText,
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
    assert.match(html, /avec Gojipe/);
    assert.match(html, /0 €/);
    assert.match(html, /Boxing Center Ramonville/);
    assert.match(html, /Lundi \(17\/08\/2026\)/);
    assert.match(html, /tenue de sport/i);
    assert.equal(confirmationSubject(payload), 'Ta séance d’essai offerte — toi et un(e) ami(e)');
  });

  it('HTML ami : Yavol t’a invité', () => {
    const payload = confirmationPayloadFromData(data, { asFriend: true });
    const html = confirmationHtml(payload);
    assert.match(html, /Yavol t’a invité/);
    assert.match(html, /Gojipe, Yavol t’a invité/);
    assert.match(confirmationSubject(payload), /Yavol t’invite/);
    assert.match(confirmationText(payload), /t’a invité/);
  });

  it('HTML solo : un seul prénom', () => {
    const payload = confirmationPayloadFromData({ ...data, ami: null });
    const html = confirmationHtml(payload);
    assert.match(html, /À lundi, Yavol\./);
    assert.doesNotMatch(html, /Gojipe/);
    assert.match(html, />Non</);
  });
});
