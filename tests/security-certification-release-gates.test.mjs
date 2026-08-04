import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

async function exists(relative) { try { await access(path.resolve(relative)); return true; } catch { return false; } }

test('2.28 release gates prove security resilience and lock comparative claims without external evidence', async (t) => {
  for (const relative of [
    'src/release/security-resilience-verifier.mjs',
    'src/release/comparative-certification-verifier.mjs',
    'scripts/verify-security-resilience.mjs',
    'scripts/verify-comparative-certification.mjs',
    'scripts/measure-security-certification.mjs',
    'docs/security-certification-measurement-2.28.0.json',
    'docs/feature-audit-2.28.0.json',
    'docs/LIMITATIONS-2.28.0.md',
  ]) assert.equal(await exists(relative), true, `${relative} is missing`);

  const matrix = await readFile('src/release/full-release-matrix.mjs', 'utf8');
  assert.match(matrix, /id: 'security-resilience-supply-chain'/);
  assert.match(matrix, /id: 'comparative-certification-harness'/);

  const audit = JSON.parse(await readFile('docs/feature-audit-2.28.0.json', 'utf8'));
  assert.equal(audit.totalItems, 1150);
  assert.deepEqual(audit.summary, { verified_source_test: 907, partial: 105, external_gate: 59, not_implemented: 79 });

  const output = await mkdtemp(path.join(os.tmpdir(), 'forge-228-security-gate-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const [{ verifySecurityResilience }, { verifyComparativeCertification }] = await Promise.all([
    import('../src/release/security-resilience-verifier.mjs'),
    import('../src/release/comparative-certification-verifier.mjs'),
  ]);
  const security = await verifySecurityResilience({ rootDirectory: path.resolve('.'), version: '2.28.0', outputFile: path.join(output, 'security.json') });
  const certification = await verifyComparativeCertification({ rootDirectory: path.resolve('.'), version: '2.28.0', outputFile: path.join(output, 'certification.json') });
  assert.equal(security.status, 'pass');
  assert.equal(security.measurement.security.taintBlocked, true);
  assert.equal(security.measurement.security.promptQuarantined, true);
  assert.equal(security.measurement.security.dependencyQuarantined, true);
  assert.equal(security.measurement.security.exfiltrationBlocked, true);
  assert.equal(security.measurement.security.auditTamperDetected, true);
  assert.equal(security.measurement.adversarial.sandboxEscapeBlocked, true);
  assert.equal(security.measurement.adversarial.failureRecovered, true);
  assert.equal(certification.status, 'pass');
  assert.equal(certification.measurement.certification.comparableContractPassed, true);
  assert.equal(certification.measurement.certification.mismatchRejected, true);
  assert.equal(certification.measurement.certification.contaminationBlocked, true);
  assert.equal(certification.measurement.certification.fakeProviderExcluded, true);
  assert.equal(certification.measurement.certification.externalComparativeClaimAllowed, false);
  assert.equal(certification.boundaries.realCompetitorRunsPresent, false);
  assert.equal(certification.boundaries.independentSuperiorityAttested, false);
});
