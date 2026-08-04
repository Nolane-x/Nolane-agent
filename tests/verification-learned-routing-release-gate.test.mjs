import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

async function exists(relative) { try { await access(path.resolve(relative)); return true; } catch { return false; } }

test('2.25 release gate proves risk-adaptive verification and verified-outcome shadow learning', async (t) => {
  for (const relative of [
    'src/release/verification-learned-routing-verifier.mjs',
    'scripts/verify-verification-learned-routing.mjs',
    'scripts/measure-verification-learned-routing.mjs',
    'docs/verification-learned-routing-measurement-2.25.0.json',
    'docs/feature-audit-2.25.0.json',
    'docs/LIMITATIONS-2.25.0.md',
  ]) assert.equal(await exists(relative), true, `${relative} is missing`);

  const matrix = await readFile('src/release/full-release-matrix.mjs', 'utf8');
  assert.match(matrix, /id: 'verification-learned-routing'/);

  const audit = JSON.parse(await readFile('docs/feature-audit-2.25.0.json', 'utf8'));
  assert.equal(audit.totalItems, 1150);
  assert.deepEqual(audit.summary, { verified_source_test: 829, partial: 66, external_gate: 56, not_implemented: 199 });

  const output = await mkdtemp(path.join(os.tmpdir(), 'forge-225-verification-gate-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const { verifyVerificationLearnedRouting } = await import('../src/release/verification-learned-routing-verifier.mjs');
  const report = await verifyVerificationLearnedRouting({ rootDirectory: path.resolve('.'), version: '2.25.0', outputFile: path.join(output, 'report.json') });

  assert.equal(report.status, 'pass');
  assert.equal(report.measurement.pyramid.lowRiskNarrow, true);
  assert.equal(report.measurement.pyramid.highRiskExpanded, true);
  assert.equal(report.measurement.testIntegrity.falseGreenBlocked, true);
  assert.equal(report.measurement.api.missingApiBlocked, true);
  assert.equal(report.measurement.review.independentReviewerSelected, true);
  assert.equal(report.measurement.review.disagreementBlocked, true);
  assert.equal(report.measurement.failure.recoveredAndReverified, true);
  assert.equal(report.measurement.confidence.weakestLinkBounded, true);
  assert.equal(report.measurement.bandit.verifiedOnly, true);
  assert.equal(report.measurement.bandit.shadowOnly, true);
  assert.equal(report.measurement.completion.greenSuiteInsufficient, true);
  assert.equal(report.boundaries.productionTrafficChanged, false);
  assert.equal(report.boundaries.hiddenRegressionSetCertified, false);
  assert.equal(report.boundaries.longTermPatchSurvivalCertified, false);
  assert.equal(report.boundaries.comparativeSuperiorityClaimed, false);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
});
