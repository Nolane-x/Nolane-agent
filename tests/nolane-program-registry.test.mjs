import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { generateNolaneProgram } from '../scripts/generate-nolane-program.mjs';
import { PRODUCT_IDENTITY } from '../src/product-identity.mjs';

test('program generator creates a real requirement registry and a Nolane runtime purity receipt and immutable historical transformation evidence', async () => {
  const featureAuditBefore = await readFile('docs/feature-audit-5.0.0-beta.6.json');
  const result = await generateNolaneProgram({ projectRoot: process.cwd() });
  assert.equal(result.product, 'Nolane Agent');
  assert.equal(result.requirements.total, 198);
  assert.equal(result.requirements.notImplemented, 0);
  assert.equal(result.retirement.externalRuntimeBundled, false);
  assert.equal(result.retirement.externalExecutablePaths, 0);
  assert.equal(result.retirement.pathFindings, 0);
  assert.equal(result.retirement.contentFindings, 0);
  assert.equal(result.retirement.archiveFindings, 0);
  assert.ok(result.retirement.historicalLedgerEntries >= 7000);
  const registry = JSON.parse(await readFile('requirements/nolane-agent-v5-requirements.json', 'utf8'));
  assert.deepEqual(await readFile('docs/feature-audit-5.0.0-beta.6.json'), featureAuditBefore);
  assert.equal(registry.requirements.some((item) => /requirement \d+$/.test(item.title)), false);
  assert.equal(registry.statusCounts.verified_source_test, 193);
  assert.equal(registry.statusCounts.external_gate, 5);
  assert.equal(registry.statusCounts.not_implemented ?? 0, 0);
  assert.equal(registry.version, PRODUCT_IDENTITY.version);
  assert.equal(registry.productVersion, PRODUCT_IDENTITY.version);
  const cleanRoom = registry.requirements.find((item) => item.id === 'NOL-AUDIT-003');
  assert.equal(cleanRoom.status, 'verified_source_test');
  assert.equal(cleanRoom.acceptance.entrypoint, 'scripts/certify-published-source.mjs');
  assert.equal(cleanRoom.acceptance.exactTest, 'tests/clean-room-certification.test.mjs');
  assert.equal(registry.statusCounts.implemented_not_wired ?? 0, 0);
  assert.ok(registry.requirements.every((item) => typeof item.acceptance.observableBehavior === 'string' && item.acceptance.observableBehavior.length > 0));
  assert.ok(registry.requirements.every((item) => item.acceptance.sourceCountIsProof === false));
  for (const id of ['NOL-UI-010','NOL-UI-011','NOL-UI-012','NOL-UI-013','NOL-UI-014','NOL-UI-015','NOL-UI-016','NOL-UI-017','NOL-UI-018','NOL-UI-019','NOL-UI-020','NOL-UI-021']) assert.equal(registry.requirements.find((item) => item.id === id)?.status, 'verified_source_test');
  for (const id of ['NOL-UI-022','NOL-UI-023','NOL-UI-024','NOL-UI-025','NOL-UI-026','NOL-UI-027','NOL-UI-028','NOL-UI-029']) assert.equal(registry.requirements.find((item) => item.id === id)?.status, 'verified_source_test');
  for (const id of ['NOL-UI-001','NOL-UI-004']) assert.equal(registry.requirements.find((item) => item.id === id)?.status, 'verified_source_test');
  for (const id of ['NOL-BRAND-002','NOL-BRAND-003','NOL-BRAND-004','NOL-BRAND-005','NOL-BRAND-006','NOL-BRAND-007','NOL-BRAND-008','NOL-BRAND-009','NOL-BRAND-010','NOL-BRAND-012','NOL-BRAND-013','NOL-BRAND-014']) assert.equal(registry.requirements.find((item) => item.id === id)?.status, 'verified_source_test');
  for (const id of ['NOL-NOLANE_NATIVE-012','NOL-NOLANE_NATIVE-017','NOL-NOLANE_NATIVE-018','NOL-NOLANE_NATIVE-019','NOL-NOLANE_NATIVE-020','NOL-NOLANE_NATIVE-021','NOL-NOLANE_NATIVE-022','NOL-NOLANE_NATIVE-024']) assert.equal(registry.requirements.find((item) => item.id === id)?.status, 'verified_source_test');
  for (const id of ['NOL-NOLANE_NATIVE-003','NOL-NOLANE_NATIVE-004','NOL-NOLANE_NATIVE-005','NOL-NOLANE_NATIVE-006','NOL-NOLANE_NATIVE-007','NOL-NOLANE_NATIVE-008','NOL-NOLANE_NATIVE-009','NOL-NOLANE_NATIVE-034','NOL-NOLANE_NATIVE-035']) assert.equal(registry.requirements.find((item) => item.id === id)?.status, 'verified_source_test');
  for (const id of ['NOL-NOLANE_NATIVE-013','NOL-NOLANE_NATIVE-014','NOL-NOLANE_NATIVE-015','NOL-NOLANE_NATIVE-023','NOL-NOLANE_NATIVE-036']) assert.equal(registry.requirements.find((item) => item.id === id)?.status, 'verified_source_test');
  for (const id of ['NOL-AUDIT-002','NOL-AUDIT-004','NOL-AUDIT-005','NOL-AUDIT-006','NOL-AUDIT-007','NOL-AUDIT-008','NOL-AUDIT-009','NOL-AUDIT-010','NOL-AUDIT-011','NOL-AUDIT-014','NOL-AUDIT-015']) assert.equal(registry.requirements.find((item) => item.id === id)?.status, 'verified_source_test');
  for (const id of ['NOL-NOLANE_NATIVE-002', 'NOL-NOLANE_NATIVE-031', 'NOL-AUDIT-016', 'NOL-SMALL-DISTILL-01', 'NOL-SMALL-DISTILL-04', 'NOL-SMALL-DISTILL-06', 'NOL-SMALL-DISTILL-10', 'NOL-SMALL-DISTILL-12', 'NOL-SMALL-VERIFY-01', 'NOL-SMALL-VERIFY-02', 'NOL-SMALL-VERIFY-03', 'NOL-SMALL-VERIFY-04', 'NOL-SMALL-VERIFY-06', 'NOL-SMALL-VERIFY-08', 'NOL-SMALL-VERIFY-09', 'NOL-SMALL-VERIFY-10', 'NOL-SMALL-VERIFY-11', 'NOL-SMALL-VERIFY-12', 'NOL-SMALL-SPECIALIST-01', 'NOL-SMALL-SPECIALIST-02', 'NOL-SMALL-SPECIALIST-04', 'NOL-SMALL-SPECIALIST-07', 'NOL-SMALL-SPECIALIST-08', 'NOL-SMALL-SPECIALIST-11', 'NOL-SMALL-SPECIALIST-12', 'NOL-SMALL-COMPUTE-01', 'NOL-SMALL-COMPUTE-02', 'NOL-SMALL-COMPUTE-03', 'NOL-SMALL-COMPUTE-05', 'NOL-SMALL-COMPUTE-06', 'NOL-SMALL-COMPUTE-07', 'NOL-SMALL-COMPUTE-08', 'NOL-SMALL-COMPUTE-09', 'NOL-SMALL-COMPUTE-10', 'NOL-SMALL-COMPUTE-11']) assert.equal(registry.requirements.find((item) => item.id === id)?.status, 'verified_source_test');
  for (const id of ['NOL-SMALL-DISTILL-02','NOL-SMALL-DISTILL-03','NOL-SMALL-DISTILL-05','NOL-SMALL-DISTILL-07','NOL-SMALL-DISTILL-08','NOL-SMALL-DISTILL-09','NOL-SMALL-DISTILL-11','NOL-SMALL-VERIFY-05','NOL-SMALL-VERIFY-07','NOL-SMALL-RECURSIVE-01','NOL-SMALL-RECURSIVE-02','NOL-SMALL-RECURSIVE-03','NOL-SMALL-RECURSIVE-04','NOL-SMALL-RECURSIVE-07','NOL-SMALL-RECURSIVE-08','NOL-SMALL-RECURSIVE-09','NOL-SMALL-RECURSIVE-10','NOL-SMALL-RECURSIVE-12','NOL-SMALL-SYMBOLIC-01','NOL-SMALL-SYMBOLIC-02','NOL-SMALL-SYMBOLIC-05','NOL-SMALL-SYMBOLIC-06','NOL-SMALL-SYMBOLIC-07','NOL-SMALL-SYMBOLIC-08','NOL-SMALL-SYMBOLIC-09','NOL-SMALL-SYMBOLIC-10','NOL-SMALL-SYMBOLIC-11','NOL-SMALL-SYMBOLIC-12','NOL-SMALL-SPECIALIST-03','NOL-SMALL-SPECIALIST-09','NOL-SMALL-SPECIALIST-10','NOL-SMALL-PLASTICITY-01','NOL-SMALL-PLASTICITY-02','NOL-SMALL-PLASTICITY-03','NOL-SMALL-PLASTICITY-04','NOL-SMALL-PLASTICITY-06','NOL-SMALL-PLASTICITY-07','NOL-SMALL-PLASTICITY-08','NOL-SMALL-PLASTICITY-10','NOL-SMALL-PLASTICITY-11','NOL-SMALL-PLASTICITY-12','NOL-SMALL-CURRICULUM-01','NOL-SMALL-CURRICULUM-02','NOL-SMALL-CURRICULUM-03','NOL-SMALL-CURRICULUM-04','NOL-SMALL-CURRICULUM-05','NOL-SMALL-CURRICULUM-06','NOL-SMALL-CURRICULUM-07','NOL-SMALL-CURRICULUM-08','NOL-SMALL-CURRICULUM-09','NOL-SMALL-CURRICULUM-10','NOL-SMALL-CURRICULUM-11','NOL-SMALL-CURRICULUM-12','NOL-SMALL-COMPUTE-04','NOL-NOLANE_NATIVE-025','NOL-NOLANE_NATIVE-027','NOL-NOLANE_NATIVE-028','NOL-NOLANE_NATIVE-032','NOL-NOLANE_NATIVE-033','NOL-NOLANE_NATIVE-037','NOL-NOLANE_NATIVE-038','NOL-NOLANE_NATIVE-039','NOL-AUDIT-013']) assert.equal(registry.requirements.find((item) => item.id === id)?.status, 'verified_source_test');
  for (const id of ['NOL-BRAND-011','NOL-NOLANE_NATIVE-010','NOL-NOLANE_NATIVE-011','NOL-NOLANE_NATIVE-016','NOL-NOLANE_NATIVE-026','NOL-NOLANE_NATIVE-029','NOL-NOLANE_NATIVE-030','NOL-SMALL-RECURSIVE-05','NOL-SMALL-RECURSIVE-06','NOL-SMALL-RECURSIVE-11','NOL-SMALL-SYMBOLIC-03','NOL-SMALL-SYMBOLIC-04','NOL-SMALL-SPECIALIST-05','NOL-SMALL-SPECIALIST-06','NOL-SMALL-PLASTICITY-05','NOL-SMALL-PLASTICITY-09','NOL-SMALL-COMPUTE-12']) assert.equal(registry.requirements.find((item) => item.id === id)?.status, 'verified_source_test');
  assert.equal(registry.requirements.find((item) => item.id === 'NOL-NOLANE_NATIVE-040')?.status, 'verified_source_test');
  for (const id of ['NOL-UI-002','NOL-UI-030','NOL-UI-031','NOL-UI-032','NOL-AUDIT-012']) {
    const item = registry.requirements.find((entry) => entry.id === id);
    assert.equal(item?.status, 'external_gate');
    assert.ok(item?.acceptance?.entrypoint);
    assert.ok(item?.acceptance?.exactTest);
    assert.match(item?.acceptance?.replayReceiptSha256 ?? '', /^[a-f0-9]{64}$/);
  }
  for (const item of registry.requirements.filter((entry) => entry.status !== 'not_implemented')) {
    assert.match(item.acceptance.evidence.entrypointSha256, /^[a-f0-9]{64}$/);
    assert.match(item.acceptance.evidence.exactTestSha256, /^[a-f0-9]{64}$/);
    assert.match(item.acceptance.replayReceiptSha256, /^[a-f0-9]{64}$/);
  }
  const lines = (await readFile('requirements/nolane-native-transformation-ledger.jsonl', 'utf8')).trim().split('\n');
  assert.equal(lines.length, result.retirement.historicalLedgerEntries);
  const sample = JSON.parse(lines[0]);
  assert.match(sample.action, /^(reimplement|rewrite-test|rewrite-doc|respecify-config|replace-asset|retain-license|exclude-with-reason)$/);
  assert.match(sample.sourceArchiveEntrySha256, /^[a-f0-9]{64}$/);
});


test('program generation is byte-stable when source evidence is unchanged', async () => {
  await generateNolaneProgram({ projectRoot: process.cwd() });
  const first = await readFile('requirements/nolane-agent-v5-requirements.json');
  await generateNolaneProgram({ projectRoot: process.cwd() });
  const second = await readFile('requirements/nolane-agent-v5-requirements.json');
  assert.deepEqual(second, first);
});
