import assert from 'node:assert/strict';
import test from 'node:test';
import { DeterministicJourneyReplayer } from '../src/browser/deterministic-journey-replayer.mjs';

function adapter({ divergent = false } = {}) {
  let run = 0; let step = 0; const resets = [];
  return {
    resets,
    async reset(input) { resets.push(input); run += 1; step = 0; },
    async execute(action) {
      step += 1;
      const suffix = divergent && run === 2 && step === 2 ? '-changed' : '';
      return {
        url: action.url ?? 'https://app.local/dashboard',
        dom: `<main data-step="${step}${suffix}">ok</main>`,
        accessibility: { roles: ['main', 'button'] }, console: [], network: [], assertions: [{ id: `a${step}`, passed: true }],
        screenshot: action.type === 'screenshot' ? Buffer.from(`shot-${step}${suffix}`) : null,
      };
    },
  };
}

const script = {
  scriptId: 'login-flow', version: 1, seed: 'seed-1',
  actions: [
    { type: 'navigate', url: 'https://app.local/login', expectedState: 'login' },
    { type: 'click', target: '#login', expectedState: 'dashboard' },
    { type: 'screenshot', filename: 'dashboard.png', expectedState: 'dashboard' },
  ],
};

test('deterministic replayer resets browser state and produces stable receipts', async () => {
  const fake = adapter();
  const replay = await new DeterministicJourneyReplayer().replay({ script, adapter: fake, repeat: 2, allowedOrigins: ['https://app.local'] });
  assert.equal(fake.resets.length, 2);
  assert.ok(fake.resets.every((item) => item.cookies && item.storage && item.serviceWorkers));
  assert.equal(replay.flaky, false);
  assert.equal(replay.runs[0].finalFingerprint, replay.runs[1].finalFingerprint);
  assert.match(replay.runs[0].artifacts[0].sha256, /^[a-f0-9]{64}$/);
  assert.equal(replay.claims.visualCorrectnessProven, false);
});

test('deterministic replayer reports divergence and flaky journeys', async () => {
  const replay = await new DeterministicJourneyReplayer().replay({ script, adapter: adapter({ divergent: true }), repeat: 2, allowedOrigins: ['https://app.local'] });
  assert.equal(replay.flaky, true);
  assert.ok(replay.divergences.length > 0);
});

test('deterministic replayer enforces network allowlist and bounded action types', async () => {
  const replayer = new DeterministicJourneyReplayer();
  await assert.rejects(() => replayer.replay({ script: { ...script, actions: [{ type: 'navigate', url: 'https://evil.test' }] }, adapter: adapter(), allowedOrigins: ['https://app.local'] }), /origin is not allowed/i);
  await assert.rejects(() => replayer.replay({ script: { ...script, actions: [{ type: 'execute-download' }] }, adapter: adapter() }), /unsupported journey action/i);
});
