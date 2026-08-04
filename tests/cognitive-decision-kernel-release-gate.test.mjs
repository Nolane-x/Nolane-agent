import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

async function exists(relative) {
  try { await access(path.resolve(relative)); return true; }
  catch { return false; }
}

test('2.23 release gate proves bounded cognitive decisions without private reasoning or autonomous self-modification claims', async (t) => {
  for (const relative of [
    'src/release/cognitive-decision-kernel-verifier.mjs',
    'scripts/verify-cognitive-decision-kernel.mjs',
    'scripts/measure-cognitive-decision-kernel.mjs',
    'docs/cognitive-decision-kernel-measurement-2.23.0.json',
    'docs/feature-audit-2.23.0.json',
    'docs/LIMITATIONS-2.23.0.md',
  ]) assert.equal(await exists(relative), true, `${relative} is missing`);

  const matrix = await readFile('src/release/full-release-matrix.mjs', 'utf8');
  assert.match(matrix, /id: 'cognitive-decision-kernel'/);

  const audit = JSON.parse(await readFile('docs/feature-audit-2.23.0.json', 'utf8'));
  assert.equal(audit.totalItems, 1150);
  assert.deepEqual(audit.summary, {
    verified_source_test: 786,
    partial: 43,
    external_gate: 56,
    not_implemented: 265,
  });

  const output = await mkdtemp(path.join(os.tmpdir(), 'forge-223-cognition-gate-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const { verifyCognitiveDecisionKernel } = await import('../src/release/cognitive-decision-kernel-verifier.mjs');
  const report = await verifyCognitiveDecisionKernel({
    rootDirectory: path.resolve('.'),
    version: '2.23.0',
    outputFile: path.join(output, 'report.json'),
  });

  assert.equal(report.status, 'pass');
  assert.equal(report.measurement.context.memoryAllowedBefore, false);
  assert.equal(report.measurement.context.memoryAllowedAfter, true);
  assert.equal(report.measurement.hypotheses.alternativeSurvived, true);
  assert.equal(report.measurement.hypotheses.falsifiedExplicitly, true);
  assert.equal(report.measurement.actions.selectedProbe, 'targeted-test');
  assert.equal(report.measurement.actions.irreversibleRejected, true);
  assert.equal(report.measurement.errors.missingBinaryPrimary, 'execution');
  assert.equal(report.measurement.errors.staleMemoryOwners.includes('memory'), true);
  assert.equal(report.measurement.episode.bound, true);
  assert.equal(report.measurement.agency.rawCommandStored, false);
  assert.equal(report.measurement.recovery.failedStrategyBanned, true);
  assert.equal(report.measurement.commit.deniedBeforeEvidence, true);
  assert.equal(report.measurement.commit.allowedAfterEvidence, true);
  assert.equal(report.measurement.stop.criteriaVerifiedStops, true);
  assert.equal(report.measurement.stop.lowInformationGainStops, true);
  assert.equal(report.boundaries.chainOfThoughtStored, false);
  assert.equal(report.boundaries.autonomousSourceMutationClaimed, false);
  assert.equal(report.boundaries.learnedPolicyClaimed, false);
  assert.equal(report.boundaries.comparativeSuperiorityClaimed, false);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
});
