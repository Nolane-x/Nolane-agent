import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { StateCapsuleStore } from '../src/construction/state-capsule-store.mjs';

test('persists and resumes an exact bounded state capsule across store instances', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-capsule-'));
  const first = new StateCapsuleStore({ root });
  const saved = await first.save({ capsuleId: 'capsule-1', missionId: 'm1', planId: 'p1', planRevision: 3, invariantRevision: 2, repositoryFingerprint: 'repo-a', goal: 'Add expiration', completedCriterionIds: ['c1'], decisionReceiptIds: ['d1'], changedSymbolIds: ['sym1'], verificationReceiptIds: ['v1'], residualRisks: ['browser-not-run'], gitCheckpoint: 'abc123', nextStepIds: ['s2'] });
  const second = new StateCapsuleStore({ root });
  const loaded = await second.load('capsule-1');
  assert.equal(loaded.receiptSha256, saved.receiptSha256);
  const resumed = await second.resume('capsule-1', { repositoryFingerprint: 'repo-a', planRevision: 3, invariantRevision: 2, gitCheckpoint: 'abc123' });
  assert.equal(resumed.status, 'resumable');
  assert.deepEqual(resumed.nextStepIds, ['s2']);
});

test('rejects drift and corrupted capsule bytes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-capsule-'));
  const store = new StateCapsuleStore({ root });
  await store.save({ capsuleId: 'capsule-2', missionId: 'm1', planId: 'p1', planRevision: 1, invariantRevision: 1, repositoryFingerprint: 'repo-a', goal: 'Goal', gitCheckpoint: 'abc' });
  const drift = await store.resume('capsule-2', { repositoryFingerprint: 'repo-b', planRevision: 1, invariantRevision: 1, gitCheckpoint: 'abc' });
  assert.equal(drift.status, 'revalidation-required');
  const file = path.join(root, 'capsule-2.json');
  const raw = JSON.parse(await readFile(file, 'utf8'));
  raw.goal = 'tampered';
  await writeFile(file, JSON.stringify(raw));
  await assert.rejects(() => store.load('capsule-2'), /integrity/i);
});
