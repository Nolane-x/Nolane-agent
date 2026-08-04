import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { NolaneSessionStore } from '../src/nolane-native/session-store.mjs';
import { CrossSessionMemory } from '../src/nolane-native/cross-session-memory.mjs';
import { NolaneSkillRegistry } from '../src/nolane-native/skill-registry.mjs';
import { SessionMemoryLearningFabric } from '../src/native-core/session-memory-learning-fabric.mjs';

async function setup(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-state-learning-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const skillRoot = path.join(root, 'skills');
  await mkdir(path.join(skillRoot, 'repair'), { recursive: true });
  await writeFile(path.join(skillRoot, 'repair', 'skill.json'), JSON.stringify({ schema: 'nolane.agent.skill.v1', id: 'repair', title: 'Repair', entrypoint: 'SKILL.md', capabilities: ['project:read'] }));
  await writeFile(path.join(skillRoot, 'repair', 'SKILL.md'), '# Repair\nRun tests first.\n');
  const sessions = new NolaneSessionStore({ root: path.join(root, 'sessions') });
  const memory = new CrossSessionMemory({ file: path.join(root, 'memory.json'), clock: (() => { let n = 100; return () => ++n; })() });
  const skills = new NolaneSkillRegistry({ roots: [skillRoot] });
  const fabric = new SessionMemoryLearningFabric({ sessions, memory, skills, maxActiveMemories: 2 });
  await fabric.open();
  return { root, sessions, memory, skills, fabric };
}

test('session store persists profile scope, parent lineage and optimistic versions across restart', async (t) => {
  const { root, sessions } = await setup(t);
  await sessions.createSession({ id: 'parent', title: 'Parent', projectId: 'p1', profileId: 'alice' });
  await sessions.createSession({ id: 'child', title: 'Child', projectId: 'p1', profileId: 'alice', parentSessionId: 'parent' });
  const first = await sessions.appendMessage('child', { id: 'm1', role: 'user', text: 'fix retry' }, { expectedVersion: 1, profileId: 'alice' });
  assert.equal(first.sessionVersion, 2);
  await assert.rejects(() => sessions.appendMessage('child', { id: 'm2', role: 'assistant', text: 'stale' }, { expectedVersion: 1, profileId: 'alice' }), /version conflict/i);
  assert.throws(() => sessions.getSession('child', { profileId: 'bob' }), /profile scope/i);
  assert.deepEqual(sessions.lineage('child', { profileId: 'alice' }).map((entry) => entry.id), ['parent', 'child']);
  const restarted = new NolaneSessionStore({ root: path.join(root, 'sessions') });
  await restarted.open();
  assert.equal(restarted.getSession('child', { profileId: 'alice' }).version, 2);
  assert.deepEqual(restarted.search('retry', { profileId: 'alice' }).map((entry) => entry.sessionId), ['child']);
  assert.deepEqual(restarted.search('retry', { profileId: 'bob' }), []);
});

test('learning fabric rejects self-report and stores only independently verified experience in profile memory', async (t) => {
  const { fabric } = await setup(t);
  await assert.rejects(() => fabric.learn({ profileId: 'alice', key: 'retry-fix', value: { steps: ['edit'] }, outcomeReceipt: { verified: false, modelClaim: true, evidenceIds: [] } }), /independently verified/i);
  const learned = await fabric.learn({ profileId: 'alice', key: 'retry-fix', value: { steps: ['edit', 'test'] }, outcomeReceipt: { verified: true, verifierId: 'tests', evidenceIds: ['test:1'], receiptSha256: 'a'.repeat(64) } });
  assert.equal(learned.scope, 'profile:alice');
  assert.deepEqual(learned.provenance, ['a'.repeat(64), 'test:1']);
  assert.equal((await fabric.recall({ profileId: 'alice', key: 'retry-fix' })).value.steps[1], 'test');
  assert.equal(await fabric.recall({ profileId: 'bob', key: 'retry-fix' }), null);
});

test('learning fabric bounds active memory and invalidates oldest verified records with receipts', async (t) => {
  const { fabric } = await setup(t);
  const verified = (id) => ({ verified: true, verifierId: 'tests', evidenceIds: [`e:${id}`], receiptSha256: id.repeat(64).slice(0, 64) });
  await fabric.learn({ profileId: 'alice', key: 'a', value: 1, outcomeReceipt: verified('a') });
  await fabric.learn({ profileId: 'alice', key: 'b', value: 2, outcomeReceipt: verified('b') });
  const third = await fabric.learn({ profileId: 'alice', key: 'c', value: 3, outcomeReceipt: verified('c') });
  assert.equal(third.consolidation.invalidated.length, 1);
  assert.equal(third.consolidation.invalidated[0].key, 'a');
  assert.equal(await fabric.recall({ profileId: 'alice', key: 'a' }), null);
  assert.deepEqual((await fabric.searchMemory({ profileId: 'alice' })).map((entry) => entry.key), ['b', 'c']);
});

test('skill grading requires verified evidence, promotes versions and rolls back after regression', async (t) => {
  const { fabric } = await setup(t);
  await assert.rejects(() => fabric.gradeSkill({ profileId: 'alice', skillId: 'repair', score: 0.9, outcomeReceipt: { verified: false } }), /independently verified/i);
  const v1 = await fabric.gradeSkill({ profileId: 'alice', skillId: 'repair', score: 0.8, outcomeReceipt: { verified: true, verifierId: 'tests', evidenceIds: ['e1'], receiptSha256: '1'.repeat(64) } });
  const v2 = await fabric.gradeSkill({ profileId: 'alice', skillId: 'repair', score: 0.95, outcomeReceipt: { verified: true, verifierId: 'tests', evidenceIds: ['e2'], receiptSha256: '2'.repeat(64) } });
  assert.equal(v1.version, 1);
  assert.equal(v2.version, 2);
  assert.equal(v2.active, true);
  const rolledBack = await fabric.rollbackSkill({ profileId: 'alice', skillId: 'repair', reason: 'negative-transfer', evidenceReceipt: 'rollback:1' });
  assert.equal(rolledBack.activeVersion, 1);
  const status = await fabric.skillStatus({ profileId: 'alice', skillId: 'repair' });
  assert.equal(status.activeVersion, 1);
  assert.equal(status.versions[1].rolledBack, true);
});

test('orchestration service exposes state-learning production methods after open', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-orchestration-state-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const { NolaneNativeOrchestrationService } = await import('../src/nolane-native/orchestration-service.mjs');
  const service = new NolaneNativeOrchestrationService({ dataDir: root });
  await service.open();
  await service.createSession({ id: 's1', title: 'State', projectId: 'p1', profileId: 'alice' });
  await service.learnExperience({ profileId: 'alice', key: 'k', value: { ok: true }, outcomeReceipt: { verified: true, verifierId: 'tests', evidenceIds: ['e'], receiptSha256: 'e'.repeat(64) } });
  const status = service.status();
  assert.equal(status.stateLearning.ready, true);
  assert.equal(status.stateLearning.sessions, 1);
  assert.equal(status.stateLearning.activeMemories, 1);
});
