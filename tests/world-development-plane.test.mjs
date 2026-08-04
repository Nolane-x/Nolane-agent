import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DecisionPlane } from '../src/decision/decision-plane.mjs';

const sha = (c) => c.repeat(64);

test('world development plane remains lazy and exposes bounded lifecycle through Decision Plane', async () => {
  const plane = new DecisionPlane();
  const before = plane.snapshot();
  assert.equal(before.lifecycle.worldDevelopmentLoaded, false);
  assert.equal(before.worldDevelopment, null);
  plane.registerWorldModel({ id: 'repo', domain: 'repository', version: '1', reliability: 0.8, cost: { tokens: 100 }, adapter: { async rollout() { return { reliability: 0.8, effects: {}, blastRadius: 0, rollbackFeasibility: 1, provenance: [{ sourceHash: sha('1'), kind: 'test' }] }; } } });
  const after = plane.snapshot();
  assert.equal(after.lifecycle.worldDevelopmentLoaded, true);
  assert.equal(after.worldDevelopment.lifecycle.registryLoaded, true);
  assert.equal(after.worldDevelopment.lifecycle.selfModelLoaded, false);
  assert.equal(after.worldDevelopment.claims.rawPayloadStored, false);
  assert.equal(JSON.stringify(after).includes('async rollout'), false);
  const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.equal(/world-development-plane|world-model-registry|verified-self-model/.test(app), false);
  const closed = plane.close();
  assert.equal(closed.lifecycle.closed, true);
  assert.equal(closed.worldDevelopment.lifecycle.closed, true);
});
