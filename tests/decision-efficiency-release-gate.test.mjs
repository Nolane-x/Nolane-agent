import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

async function exists(relative) { try { await access(path.resolve(relative)); return true; } catch { return false; } }

test('2.20 release gates prove Decision Efficiency Loop and Context Engine V3 without inflating claims', async (t) => {
  for (const relative of [
    'src/release/decision-efficiency-loop-verifier.mjs',
    'src/release/context-engine-v3-verifier.mjs',
    'scripts/verify-decision-efficiency-loop.mjs',
    'scripts/verify-context-engine-v3.mjs',
    'scripts/measure-decision-efficiency-loop.mjs',
    'docs/decision-efficiency-loop-measurement-2.20.0.json',
    'docs/feature-audit-2.20.0.json',
    'docs/LIMITATIONS-2.20.0.md',
  ]) assert.equal(await exists(relative), true, `${relative} is missing`);

  const matrix = await readFile('src/release/full-release-matrix.mjs', 'utf8');
  assert.match(matrix, /id: 'decision-efficiency-loop'/);
  assert.match(matrix, /id: 'context-engine-v3'/);

  const audit = JSON.parse(await readFile('docs/feature-audit-2.20.0.json', 'utf8'));
  assert.equal(audit.totalItems, 1150);
  assert.deepEqual(audit.summary, { verified_source_test: 759, partial: 7, external_gate: 56, not_implemented: 328 });
  assert.equal(audit.summary.verified_source_test + audit.summary.partial + audit.summary.external_gate + audit.summary.not_implemented, 1150);

  const output = await mkdtemp(path.join(os.tmpdir(), 'forge-220-decision-gate-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const { verifyDecisionEfficiencyLoop } = await import('../src/release/decision-efficiency-loop-verifier.mjs');
  const { verifyContextEngineV3 } = await import('../src/release/context-engine-v3-verifier.mjs');
  const decision = await verifyDecisionEfficiencyLoop({ rootDirectory: path.resolve('.'), version: '2.20.0', outputFile: path.join(output, 'decision.json') });
  const context = await verifyContextEngineV3({ rootDirectory: path.resolve('.'), version: '2.20.0', outputFile: path.join(output, 'context.json') });

  assert.equal(decision.status, 'pass');
  assert.equal(decision.measurement.criteria.verifiedCriteriaScore, decision.measurement.criteria.totalCriteriaWeight);
  assert.ok(decision.measurement.efficiency.tokenYield > 0);
  assert.ok(decision.measurement.efficiency.memoryYield > 0);
  assert.ok(decision.measurement.efficiency.editYield > 0);
  assert.equal(decision.measurement.privacy.rawPromptRejected, true);
  assert.equal(decision.measurement.privacy.modelOutputRejected, true);
  assert.equal(decision.boundaries.comparativeSuperiorityClaimed, false);
  assert.equal(context.status, 'pass');
  assert.ok(context.measurement.context.selectedTokens < context.measurement.context.baselineTokens);
  assert.equal(context.measurement.context.counterEvidenceIncluded, true);
  assert.equal(context.measurement.context.verifiedCriteriaPreserved, true);
  assert.equal(context.measurement.tokenizer.degraded, false);
  assert.equal(context.boundaries.learnedContextPolicyClaimed, false);
  assert.match(decision.receiptSha256, /^[a-f0-9]{64}$/);
  assert.match(context.receiptSha256, /^[a-f0-9]{64}$/);
});
