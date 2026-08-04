import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { DomainTrustLedger } from '../src/learning/domain-trust-ledger.mjs';
import { ModelSwitchCoordinator } from '../src/learning/model-switch-coordinator.mjs';
import { StateCapsuleStore } from '../src/construction/state-capsule-store.mjs';

const H = (ch) => ch.repeat(64);

test('DomainTrustLedger isolates executor, reviewer, and tool trust by domain and task type', () => {
  const ledger = new DomainTrustLedger();
  ledger.record({ outcomeId: 'e1', role: 'executor', identity: 'model-a', domain: 'backend', taskType: 'migration', confidence: 0.8, success: true, verified: true, verificationReceiptSha256: H('a') });
  ledger.record({ outcomeId: 'r1', role: 'reviewer', identity: 'model-a', domain: 'backend', taskType: 'migration', confidence: 0.8, success: false, verified: true, verificationReceiptSha256: H('b') });
  ledger.record({ outcomeId: 't1', role: 'tool', identity: 'test-runner', domain: 'backend', taskType: 'migration', confidence: 0.9, success: true, verified: true, verificationReceiptSha256: H('c') });

  const executor = ledger.project({ role: 'executor', identity: 'model-a', domain: 'backend', taskType: 'migration' });
  const reviewer = ledger.project({ role: 'reviewer', identity: 'model-a', domain: 'backend', taskType: 'migration' });
  const tool = ledger.project({ role: 'tool', identity: 'test-runner', domain: 'backend', taskType: 'migration' });
  assert.equal(executor.sampleCount, 1);
  assert.equal(executor.posteriorSuccessRate > reviewer.posteriorSuccessRate, true);
  assert.equal(tool.sampleCount, 1);
  assert.notEqual(executor.bucketKey, reviewer.bucketKey);
  assert.equal(executor.claims.roleIsolated, true);
  assert.throws(() => ledger.record({ outcomeId: 'bad', role: 'executor', identity: 'x', domain: 'backend', taskType: 'migration', confidence: 1, success: true, verified: false, verificationReceiptSha256: H('d') }), /verified outcome/i);
});

test('DomainTrustLedger reports Brier error and idempotent verified records', () => {
  const ledger = new DomainTrustLedger();
  const input = { outcomeId: 'x', role: 'executor', identity: 'model-a', domain: 'frontend', taskType: 'bugfix', confidence: 0.75, success: false, verified: true, verificationReceiptSha256: H('e') };
  const first = ledger.record(input);
  const duplicate = ledger.record(input);
  assert.equal(first.brier, 0.75 ** 2);
  assert.equal(duplicate.duplicate, true);
  assert.equal(ledger.project({ role: 'executor', identity: 'model-a', domain: 'frontend', taskType: 'bugfix' }).brierError, 0.75 ** 2);
  assert.throws(() => ledger.record({ ...input, success: true }), /trust outcome conflict/i);
});

test('ModelSwitchCoordinator translates a valid state capsule and blocks stale state or missing capabilities', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-model-switch-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new StateCapsuleStore({ root });
  await store.save({
    capsuleId: 'capsule-1', missionId: 'mission-1', planId: 'plan-1', planRevision: 2, invariantRevision: 3,
    repositoryFingerprint: H('1'), goal: 'Complete migration', completedCriterionIds: ['c1'], decisionReceiptIds: [H('2')],
    changedSymbolIds: ['symbol:a'], verificationReceiptIds: [H('3')], residualRisks: ['db rollback'], gitCheckpoint: H('4'), nextStepIds: ['step-2'],
  });
  const coordinator = new ModelSwitchCoordinator({ capsuleStore: store });
  const result = await coordinator.switchSession({
    capsuleId: 'capsule-1', from: { modelId: 'model-a', harness: 'codex-cli' }, to: { modelId: 'model-b', harness: 'generic-local', capabilities: ['read', 'edit', 'test'] },
    requiredCapabilities: ['read', 'edit', 'test'], currentState: { repositoryFingerprint: H('1'), planRevision: 2, invariantRevision: 3, gitCheckpoint: H('4') },
    translation: { sourceHarness: 'codex-cli', targetHarness: 'generic-local', revisionSha256: H('5'), toolAliases: { apply_patch: 'edit' }, roleMap: { reviewer: 'critic' } },
  });
  assert.equal(result.status, 'switched');
  assert.equal(result.translatedState.nextStepIds[0], 'step-2');
  assert.equal(result.translation.toolAliases.apply_patch, 'edit');
  assert.equal(result.claims.rawPromptTransferred, false);

  await assert.rejects(() => coordinator.switchSession({
    capsuleId: 'capsule-1', from: { modelId: 'model-a', harness: 'codex-cli' }, to: { modelId: 'model-b', harness: 'generic-local', capabilities: ['read'] },
    requiredCapabilities: ['read', 'edit'], currentState: { repositoryFingerprint: H('1'), planRevision: 2, invariantRevision: 3, gitCheckpoint: H('4') },
    translation: { sourceHarness: 'codex-cli', targetHarness: 'generic-local', revisionSha256: H('5') },
  }), /missing target capability/i);

  await assert.rejects(() => coordinator.switchSession({
    capsuleId: 'capsule-1', from: { modelId: 'model-a', harness: 'codex-cli' }, to: { modelId: 'model-b', harness: 'generic-local', capabilities: ['read', 'edit', 'test'] },
    requiredCapabilities: ['read'], currentState: { repositoryFingerprint: H('9'), planRevision: 2, invariantRevision: 3, gitCheckpoint: H('4') },
    translation: { sourceHarness: 'codex-cli', targetHarness: 'generic-local', revisionSha256: H('5') },
  }), /state capsule requires revalidation/i);
});
