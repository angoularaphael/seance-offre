import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { botCandidates, forwardJobToBot } from '../lib/bot.js';
import { getGym } from '../lib/gyms.js';

describe('getGym', () => {
  it('résout id, label et nom', () => {
    assert.equal(getGym('minimes').id, 'minimes');
    assert.equal(getGym('Boxing Center Minimes').id, 'minimes');
    assert.equal(getGym('Portet').id, 'portet');
    assert.equal(getGym('Boxing Center États-Unis').id, 'etats-unis');
  });
});

describe('forwardJobToBot fallback', () => {
  const prev = {};
  before(() => {
    for (const key of ['BOXPLUS_BOT_URL', 'BOXPLUS_BOT_URL_SALES_2', 'BOXPLUS_BOT_URL_OPS', 'SYNC_SECRET']) {
      prev[key] = process.env[key];
    }
  });
  after(() => {
    for (const [key, value] of Object.entries(prev)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('liste les URLs sans doublon', () => {
    process.env.BOXPLUS_BOT_URL = 'http://dead.example:1';
    process.env.BOXPLUS_BOT_URL_SALES_2 = 'http://eddy.example:2';
    process.env.BOXPLUS_BOT_URL_OPS = 'http://eddy.example:2';
    assert.deepEqual(botCandidates(), ['http://dead.example:1', 'http://eddy.example:2']);
  });

  it('remplace l’ancienne URL prem-eu1:20311 par Raphaël', () => {
    process.env.BOXPLUS_BOT_URL = 'http://prem-eu1.bot-hosting.net:20311';
    delete process.env.BOXPLUS_BOT_URL_SALES_2;
    delete process.env.BOXPLUS_BOT_URL_OPS;
    assert.deepEqual(botCandidates(), ['http://172.81.128.14:22189']);
  });

  it('passe au bot suivant si le premier est injoignable', async () => {
    process.env.BOXPLUS_BOT_URL = 'http://dead.example:1';
    process.env.BOXPLUS_BOT_URL_SALES_2 = 'http://eddy.example:2';
    process.env.SYNC_SECRET = 'secret';
    const calls = [];
    const fetchImpl = async (url) => {
      calls.push(url);
      if (String(url).includes('dead.example')) {
        const err = new Error('fetch failed');
        err.cause = { code: 'ENOTFOUND' };
        throw err;
      }
      return {
        ok: true,
        json: async () => ({ queued: true, job_id: '1' }),
      };
    };
    const out = await forwardJobToBot({ order_id: 'SO-test' }, { fetchImpl });
    assert.equal(out.forwarded, true);
    assert.equal(out.bot_url, 'http://eddy.example:2');
    assert.equal(calls.length, 2);
  });
});
