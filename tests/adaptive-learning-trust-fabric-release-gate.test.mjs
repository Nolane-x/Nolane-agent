import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  ADAPTIVE_LEARNING_TRUST_REQUIREMENT_IDS,
  measureAdaptiveLearningTrustFabric,
} from '../scripts/measure-adaptive-learning-trust-fabric.mjs';
import { verifyAdaptiveLearningTrustFabric } from '../src/release/adaptive-learning-trust-fabric-verifier.mjs';
import { verifyConstructionSafetyCompletion } from '../src/release/construction-safety-completion-verifier.mjs';

const PROMOTED_IDS = Object.freeze(['38.2','38.6','38.7','38.10','38.12','38.13','38.14','38.18','47.6','47.10','47.11']);

async function exists(relative) { try { await access(path.resolve(relative)); return true; } catch { return false; } }
function statusById(audit) { return new Map(audit.sections.flatMap((section) => section.items).map((item) => [item.id, item.status])); }

test('3.5 Adaptive Learning measurement is deterministic and exercises verified-only local behavior', async () => {
  const first = await measureAdaptiveLearningTrustFabric({ rootDirectory: process.cwd(), version: '3.5.0' });
  const second = await measureAdaptiveLearningTrustFabric({ rootDirectory: process.cwd(), version: '3.5.0' });
  assert.equal(first.receiptSha256, second.receiptSha256);
  assert.deepEqual(first.promotedRequirementIds, PROMOTED_IDS);
  assert.deepEqual(ADAPTIVE_LEARNING_TRUST_REQUIREMENT_IDS, PROMOTED_IDS);
  assert.deepEqual(first.routing, {
    taskFeaturesConditioned: true,
    heldOutDisjoint: true,
    heldOutCandidatePromotable: true,
    cohortDeterministic: true,
    cohortRegressionDisabled: true,
    strategyLearned: true,
    patchSurvivalVerified: true,
    modelSwitchTranslated: true,
  });
  assert.deepEqual(first.trustAndDevelopment, {
    domainTaskTrustConditioned: true,
    roleTrustIsolated: true,
    multiTurnToolCalibration: true,
    structureSurfaceSeparated: true,
    teacherChallengeKindsCovered: true,
    executorOracleBlind: true,
  });
  assert.deepEqual(first.boundaries, {
    productionRoutingChanged: false,
    heldOutUsedForTuning: false,
    unverifiedOutcomeLearned: false,
    longTermSurvivalClaimedWithoutObservation: false,
    teacherOracleExposed: false,
    comparativeSuperiorityClaimed: false,
  });
  assert.match(first.receiptSha256, /^[a-f0-9]{64}$/);
});

test('3.5 audit promotes exactly eleven adaptive learning requirements and retains external gates', async () => {
  const previous = JSON.parse(await readFile('docs/feature-audit-3.4.0.json', 'utf8'));
  const current = JSON.parse(await readFile('docs/feature-audit-3.5.0.json', 'utf8'));
  assert.deepEqual(current.summary, { verified_source_test: 1028, partial: 59, external_gate: 63, not_implemented: 0 });
  const before = statusById(previous);
  const after = statusById(current);
  const changed = [...after].filter(([id, status]) => before.get(id) !== status).map(([id]) => id).sort();
  assert.deepEqual(changed, [...PROMOTED_IDS].sort());
  for (const id of PROMOTED_IDS) {
    assert.equal(before.get(id), 'partial');
    assert.equal(after.get(id), 'verified_source_test');
  }
  assert.equal([...after.values()].filter((status) => status === 'external_gate').length, 63);
});

test('3.5 release verifier requires source tests deterministic measurement audit and non-claims', async (t) => {
  for (const relative of [
    'src/learning/task-feature-encoder.mjs',
    'src/learning/held-out-policy-evaluator.mjs',
    'src/learning/cohort-canary-governor.mjs',
    'src/learning/strategy-policy-learner.mjs',
    'src/learning/domain-trust-ledger.mjs',
    'src/learning/model-switch-coordinator.mjs',
    'src/learning/adaptive-learning-control-plane.mjs',
    'src/development/teacher-challenge-lab.mjs',
    'tests/adaptive-learning-trust-fabric-integration.test.mjs',
    'docs/adaptive-learning-trust-fabric-measurement-3.5.0.json',
    'docs/feature-audit-3.5.0.json',
    'docs/LIMITATIONS-3.5.0.md',
  ]) assert.equal(await exists(relative), true, `${relative} is missing`);
  const output = await mkdtemp(path.join(os.tmpdir(), 'forge-350-learning-gate-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const report = await verifyAdaptiveLearningTrustFabric({ rootDirectory: process.cwd(), version: '3.5.0', outputFile: path.join(output, 'report.json') });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.auditCounts, { verified_source_test: 1028, partial: 59, external_gate: 63, not_implemented: 0 });
  assert.deepEqual(report.promotedRequirementIds, PROMOTED_IDS);
  for (const value of Object.values(report.boundaries)) assert.equal(value, false);
});

test('full matrix includes Adaptive Learning Trust Fabric as required gate 74', async () => {
  const matrix = await readFile('src/release/full-release-matrix.mjs', 'utf8');
  assert.match(matrix, /id: 'adaptive-learning-trust-fabric'/);
  assert.match(matrix, /scripts\/verify-adaptive-learning-trust-fabric\.mjs/);
});


test('3.5 retains all 3.4 Construction Safety Completion guarantees while allowing the new eleven promotions', async (t) => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'forge-350-construction-retention-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const report = await verifyConstructionSafetyCompletion({ rootDirectory: process.cwd(), version: '3.5.0', outputFile: path.join(output, 'report.json') });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.auditCounts, { verified_source_test: 1028, partial: 59, external_gate: 63, not_implemented: 0 });
});
