import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  CONSTRUCTION_SAFETY_COMPLETION_REQUIREMENT_IDS,
  measureConstructionSafetyCompletion,
} from '../scripts/measure-construction-safety-completion.mjs';
import { verifyConstructionSafetyCompletion } from '../src/release/construction-safety-completion-verifier.mjs';
import { verifyRepositoryTruthPlane } from '../src/release/repository-truth-plane-verifier.mjs';
import { verifyVerifiedMissionRuntime } from '../src/release/verified-mission-runtime-verifier.mjs';
import { verifyIntelligenceCompletionKernel } from '../src/release/intelligence-completion-kernel-verifier.mjs';

const PROMOTED_IDS = Object.freeze([
  '34.16',
  '35.6','35.7','35.11','35.12','35.13','35.15',
  '36.4','36.5','36.6','36.11','36.14','36.16',
  '37.4','37.5','37.11','37.15',
  '46.9','46.11','46.13','46.16',
]);

async function exists(relative) { try { await access(path.resolve(relative)); return true; } catch { return false; } }
function statusById(audit) { return new Map(audit.sections.flatMap((section) => section.items).map((item) => [item.id, item.status])); }

test('3.4 Construction Safety Completion measurement is deterministic and exercises real isolation', async () => {
  const first = await measureConstructionSafetyCompletion({ rootDirectory: process.cwd(), version: '3.4.0' });
  const second = await measureConstructionSafetyCompletion({ rootDirectory: process.cwd(), version: '3.4.0' });
  assert.equal(first.receiptSha256, second.receiptSha256);
  assert.deepEqual(first.promotedRequirementIds, PROMOTED_IDS);
  assert.deepEqual(CONSTRUCTION_SAFETY_COMPLETION_REQUIREMENT_IDS, PROMOTED_IDS);
  assert.deepEqual(first.construction, {
    contractFirst: true,
    verticalCheckpointsRequired: true,
    obsoleteTaskRevoked: true,
    boundedOwnership: true,
    realCandidateWorktrees: true,
    exactStateResume: true,
  });
  assert.deepEqual(first.changeSafety, {
    semanticApiDimensionsCovered: true,
    citedBlastRadius: true,
    duplicateAbstractionDetected: true,
    migrationRollbackRequired: true,
    candidatesComparedUnderOneContract: true,
    independentReviewRequired: true,
  });
  assert.deepEqual(first.verification, {
    mutationCaught: true,
    bytesRestoredExactly: true,
    reviewerIndependent: true,
    journeyArtifactsHashed: true,
    hiddenExpectedEncrypted: true,
    hiddenExpectedExecutorBlind: true,
  });
  assert.deepEqual(first.counterfactual, {
    singleVariableIntervention: true,
    heldConstantsVerified: true,
    effectDimensionsCovered: true,
    imagineVerifyExecuteEnforced: true,
    improvedOutcomeMeasured: true,
    worsenedOutcomeMeasured: true,
  });
  assert.deepEqual(first.boundaries, {
    externalGateCountChanged: false,
    comparativeSuperiorityClaimed: false,
    simulationClaimedAsObserved: false,
    selfReviewAccepted: false,
    hiddenExpectedExposed: false,
  });
  assert.match(first.receiptSha256, /^[a-f0-9]{64}$/);
});

test('3.4 release verifier requires source tests measurement audit transitions and non-claims', async (t) => {
  for (const relative of [
    'src/construction/construction-contract-runtime.mjs',
    'src/construction/semantic-change-safety-runtime.mjs',
    'src/verification/independent-verification-runtime.mjs',
    'src/cognition/causal-intervention-lab.mjs',
    'src/world-model/counterfactual-change-runtime.mjs',
    'tests/construction-safety-completion-integration.test.mjs',
    'docs/construction-safety-completion-measurement-3.4.0.json',
    'docs/feature-audit-3.4.0.json',
    'docs/LIMITATIONS-3.4.0.md',
  ]) assert.equal(await exists(relative), true, `${relative} is missing`);
  const output = await mkdtemp(path.join(os.tmpdir(), 'forge-340-construction-gate-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const report = await verifyConstructionSafetyCompletion({ rootDirectory: process.cwd(), version: '3.4.0', outputFile: path.join(output, 'report.json') });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.auditCounts, { verified_source_test: 1017, partial: 70, external_gate: 63, not_implemented: 0 });
  assert.deepEqual(report.promotedRequirementIds, PROMOTED_IDS);
  for (const value of Object.values(report.boundaries)) assert.equal(value, false);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
});

test('3.4 audit promotes exactly twenty-one local construction safety requirements', async () => {
  const previous = JSON.parse(await readFile('docs/feature-audit-3.3.0.json', 'utf8'));
  const current = JSON.parse(await readFile('docs/feature-audit-3.4.0.json', 'utf8'));
  assert.deepEqual(current.summary, { verified_source_test: 1017, partial: 70, external_gate: 63, not_implemented: 0 });
  const before = statusById(previous);
  const after = statusById(current);
  const changed = [...after].filter(([id, status]) => before.get(id) !== status).map(([id]) => id).sort();
  assert.deepEqual(changed, [...PROMOTED_IDS].sort());
  for (const id of PROMOTED_IDS) {
    assert.equal(before.get(id), 'partial');
    assert.equal(after.get(id), 'verified_source_test');
  }
});

test('full matrix includes Construction Safety Completion as required gate 73', async () => {
  const matrix = await readFile('src/release/full-release-matrix.mjs', 'utf8');
  assert.match(matrix, /id: 'construction-safety-completion'/);
  assert.match(matrix, /scripts\/verify-construction-safety-completion\.mjs/);
});


test('3.4 retains all 3.1-3.3 certified guarantees without requiring their historical audits to be the only changes', async (t) => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'forge-340-retention-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const reports = await Promise.all([
    verifyIntelligenceCompletionKernel({ rootDirectory: process.cwd(), version: '3.4.0', outputFile: path.join(output, 'intelligence.json') }),
    verifyVerifiedMissionRuntime({ rootDirectory: process.cwd(), version: '3.4.0', outputFile: path.join(output, 'mission.json') }),
    verifyRepositoryTruthPlane({ rootDirectory: process.cwd(), version: '3.4.0', outputFile: path.join(output, 'truth.json') }),
  ]);
  assert.deepEqual(reports.map((report) => report.status), ['pass', 'pass', 'pass']);
});
