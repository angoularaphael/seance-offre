import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isFlyerHit, flyerSourceLabel } from '../lib/visits.js';

describe('tracker flyer QR', () => {
  it('reconnaît le lien affiche rentree_2026', () => {
    assert.equal(
      isFlyerHit({ src: 'qr', medium: 'poster', campaign: 'rentree_2026' }),
      true
    );
    assert.equal(flyerSourceLabel({ src: 'qr', medium: 'poster', campaign: 'rentree_2026' }), 'flyer');
  });

  it('laisse le trafic direct à part', () => {
    assert.equal(isFlyerHit({ src: '', medium: '', campaign: '' }), false);
    assert.equal(flyerSourceLabel({ src: '', medium: '', campaign: '' }), 'direct');
  });
});
