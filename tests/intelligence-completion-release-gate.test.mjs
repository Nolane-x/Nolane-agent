import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { measureIntelligenceCompletion } from '../scripts/measure-intelligence-completion.mjs';
import { verifyIntelligenceCompletionKernel } from '../src/release/intelligence-completion-kernel-verifier.mjs';

const PROMOTED_IDS = Object.freeze(['30.13','30.14','30.15','31.12','32.5','32.8','32.13','32.16','33.6','33.7','36.12','36.13','36.17']);
async function exists(relative) { try { await access(path.resolve(relative)); return true; } catch { return false; } }

function statusById(audit) {
  return new Map(audit.sections.flatMap((section) => section.items).map((item) => [item.id, item.status]));
}

test('3.1 measurement deterministically proves all intelligence completion boundaries', async () => {
  const first = await measureIntelligenceCompletion({ rootDirectory: process.cwd(), version: '3.1.0' });
  const second = await measureIntelligenceCompletion({ rootDirectory: process.cwd(), version: '3.1.0' });
  assert.equal(first.receiptSha256, second.receiptSha256);
  assert.deepEqual(first.promotedRequirementIds, PROMOTED_IDS);
  assert.ok(first.context.expansionKinds.includes('counter-evidence'));
  assert.equal(first.context.unverifiedOutcomeChangedLearning, false);
  assert.deepEqual(first.context.ablationClassifications, ['required', 'unnecessary', 'inconclusive']);
  assert.equal(first.vectors.pages, 3);
  assert.equal(first.vectors.pagesRead, 1);
  assert.ok(first.vectors.peakLoadedBytes < first.vectors.totalVectorBytes);
  assert.equal(first.vectors.fullIndexLoadedIntoMemory, false);
  assert.equal(first.repository.causalityProven, false);
  assert.ok(first.repository.moduleCount >= 2);
  assert.ok(first.repository.zoneTypes.includes('security-critical'));
  assert.ok(first.program.controlFlowEdges > 0);
  assert.ok(first.program.dataFlowEdges > 0);
  assert.equal(first.program.dynamicTargetsGuessed, false);
  assert.equal(first.variables.transitionCount, 7);
  assert.equal(first.variables.identityInferredWithoutEvidence, false);
  assert.deepEqual(first.patchAblation.classifications, ['required', 'unnecessary']);
  assert.equal(first.patchAblation.patchAppliedToOriginalWorkspace, false);
  assert.equal(first.integration.fastPathCompletionServicesLoaded, 0);
  assert.equal(first.boundaries.externalGateCountChanged, false);
  assert.equal(first.boundaries.comparativeSuperiorityClaimed, false);
  assert.match(first.receiptSha256, /^[a-f0-9]{64}$/);
});

test('3.1 release gate requires direct source tests measurement audit transitions and non-claims', async (t) => {
  for (const relative of [
    'scripts/measure-intelligence-completion.mjs',
    'src/release/intelligence-completion-kernel-verifier.mjs',
    'scripts/verify-intelligence-completion-kernel.mjs',
    'docs/intelligence-completion-measurement-3.1.0.json',
    'docs/feature-audit-3.1.0.json',
    'docs/LIMITATIONS-3.1.0.md',
  ]) assert.equal(await exists(relative), true, `${relative} is missing`);
  const output = await mkdtemp(path.join(os.tmpdir(), 'forge-310-intelligence-completion-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const report = await verifyIntelligenceCompletionKernel({ rootDirectory: process.cwd(), version: '3.1.0', outputFile: path.join(output, 'report.json') });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.auditCounts, { verified_source_test: 972, partial: 115, external_gate: 63, not_implemented: 0 });
  assert.deepEqual(report.promotedRequirementIds, PROMOTED_IDS);
  assert.equal(report.boundaries.externalGateCountChanged, false);
  assert.equal(report.boundaries.autonomousMutationClaimed, false);
  assert.equal(report.boundaries.comparativeSuperiorityClaimed, false);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
});

test('3.1 audit promotes exactly the 13 internal gaps while preserving all other 3.0 statuses', async () => {
  const previous = JSON.parse(await readFile('docs/feature-audit-3.0.0.json', 'utf8'));
  const current = JSON.parse(await readFile('docs/feature-audit-3.1.0.json', 'utf8'));
  assert.deepEqual(current.summary, { verified_source_test: 972, partial: 115, external_gate: 63, not_implemented: 0 });
  const before = statusById(previous);
  const after = statusById(current);
  const changed = [...after].filter(([id, status]) => before.get(id) !== status).map(([id]) => id).sort();
  assert.deepEqual(changed, [...PROMOTED_IDS].sort());
  for (const id of PROMOTED_IDS) {
    assert.equal(before.get(id), 'not_implemented');
    assert.equal(after.get(id), 'verified_source_test');
  }
});

test('full matrix includes intelligence completion as a required architecture gate', async () => {
  const matrix = await readFile('src/release/full-release-matrix.mjs', 'utf8');
  assert.match(matrix, /id: 'intelligence-completion-kernel'/);
  assert.match(matrix, /scripts\/verify-intelligence-completion-kernel\.mjs/);
});

test('later releases retain the 3.1 intelligence completion guarantees while allowing separately certified audit promotions', async (t) => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'forge-320-intelligence-retention-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const report = await verifyIntelligenceCompletionKernel({ rootDirectory: process.cwd(), version: '3.2.0', outputFile: path.join(output, 'report.json') });

  assert.equal(report.status, 'pass');
  assert.deepEqual(report.auditCounts, { verified_source_test: 985, partial: 102, external_gate: 63, not_implemented: 0 });
  assert.deepEqual(report.promotedRequirementIds, PROMOTED_IDS);
  assert.equal(report.boundaries.externalGateCountChanged, false);
});
