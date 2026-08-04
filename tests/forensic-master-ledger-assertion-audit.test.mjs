import test from 'node:test';
import assert from 'node:assert/strict';
import { auditMasterLedgerAssertions } from '../src/forensics/master-ledger-assertion-audit.mjs';

const H = (char) => char.repeat(64);
const index = new Map([
  ['tests/good.test.mjs', { path: 'tests/good.test.mjs', sourceSha256: H('b'), namedTests: ['works', 'rejects stale input'], positiveAssertions: ['assert.equal(value, true)'], negativeAssertions: ['assert.throws(fn)'], hasPositiveEvidence: true, hasNegativeEvidence: true }],
  ['tests/positive-only.test.mjs', { path: 'tests/positive-only.test.mjs', sourceSha256: H('d'), namedTests: ['works'], positiveAssertions: ['assert.ok(value)'], negativeAssertions: [], hasPositiveEvidence: true, hasNegativeEvidence: false }],
]);

test('master ledger assertion audit assigns explicit evidence dispositions without changing requirement status', () => {
  const requirements = [
    { id: 'R-1', status: 'verified', acceptance: { productionEntryPoints: ['src/a.mjs'], testPaths: ['tests/good.test.mjs'], evidenceHashes: { 'src/a.mjs': H('a'), 'tests/good.test.mjs': H('b') } } },
    { id: 'R-2', status: 'verified', acceptance: { productionEntryPoints: ['docs/report.md'], testPaths: ['tests/good.test.mjs'], evidenceHashes: { 'docs/report.md': H('c'), 'tests/good.test.mjs': H('b') } } },
    { id: 'R-3', status: 'verified', acceptance: { productionEntryPoints: ['src/c.mjs'], testPaths: ['tests/positive-only.test.mjs'], evidenceHashes: { 'src/c.mjs': H('c'), 'tests/positive-only.test.mjs': H('d') } } },
    { id: 'R-4', status: 'external', acceptance: { productionEntryPoints: ['src/d.mjs'], testPaths: ['tests/good.test.mjs'], externalConditions: ['windows'] } },
  ];
  const result = auditMasterLedgerAssertions({
    requirements,
    existingPaths: new Set(['src/a.mjs', 'docs/report.md', 'src/c.mjs', 'src/d.mjs', 'tests/good.test.mjs', 'tests/positive-only.test.mjs']),
    sha256ByPath: new Map([['src/a.mjs', H('a')], ['docs/report.md', H('c')], ['src/c.mjs', H('c')], ['tests/good.test.mjs', H('b')], ['tests/positive-only.test.mjs', H('d')]]),
    testIndex: index,
    maxRequirementsPerTest: 25,
  });
  assert.equal(result.records.find((item) => item.requirementId === 'R-1').assertionStatus, 'verified');
  assert.equal(result.records.find((item) => item.requirementId === 'R-2').blockers.includes('documentation-only-production-entrypoint'), true);
  assert.equal(result.records.find((item) => item.requirementId === 'R-3').blockers.includes('negative-assertion-missing'), true);
  assert.equal(result.records.find((item) => item.requirementId === 'R-4').assertionStatus, 'external-unverified');
  assert.equal(requirements[0].status, 'verified');
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
});

test('master ledger assertion audit exposes over-broad shared tests instead of certifying them', () => {
  const requirements = Array.from({ length: 3 }, (_, indexValue) => ({ id: `R-${indexValue}`, status: 'verified', acceptance: { productionEntryPoints: [`src/${indexValue}.mjs`], testPaths: ['tests/good.test.mjs'] } }));
  const result = auditMasterLedgerAssertions({ requirements, existingPaths: new Set(['src/0.mjs','src/1.mjs','src/2.mjs','tests/good.test.mjs']), sha256ByPath: new Map(), testIndex: index, maxRequirementsPerTest: 2 });
  assert.equal(result.summary.overBroadTestFiles, 1);
  assert.equal(result.records.every((item) => item.warnings.includes('over-broad-test-evidence:tests/good.test.mjs')), true);
  assert.equal(result.records.every((item) => item.blockers.includes('dedicated-test-evidence-missing')), true);
  assert.equal(result.certifiable, false);
});

test('master ledger audit accepts one dedicated fresh test while preserving stale and over-broad aliases as warnings', () => {
  const requirements = [
    { id: 'R-dedicated', status: 'verified', acceptance: {
      productionEntryPoints: ['src/a.mjs', 'docs/old.md'],
      testPaths: ['tests/shared.test.mjs', 'tests/dedicated.test.mjs', 'tests/missing.test.mjs'],
      evidenceHashes: { 'src/a.mjs': H('a'), 'tests/dedicated.test.mjs': H('e') },
    } },
    ...Array.from({ length: 3 }, (_, indexValue) => ({ id: `R-shared-${indexValue}`, status: 'verified', acceptance: { productionEntryPoints: [`src/${indexValue}.mjs`], testPaths: ['tests/shared.test.mjs'] } })),
  ];
  const result = auditMasterLedgerAssertions({
    requirements,
    existingPaths: new Set(['src/a.mjs', 'docs/old.md', 'tests/shared.test.mjs', 'tests/dedicated.test.mjs', 'src/0.mjs', 'src/1.mjs', 'src/2.mjs']),
    sha256ByPath: new Map([['src/a.mjs', H('a')], ['tests/dedicated.test.mjs', H('e')]]),
    testIndex: new Map([
      ['tests/shared.test.mjs', { sourceSha256: H('b'), namedTests: ['works', 'rejects invalid'], positiveAssertions: ['pass'], negativeAssertions: ['reject'], hasPositiveEvidence: true, hasNegativeEvidence: true }],
      ['tests/dedicated.test.mjs', { sourceSha256: H('e'), namedTests: ['specific behavior', 'rejects stale specific input'], positiveAssertions: ['pass'], negativeAssertions: ['reject'], hasPositiveEvidence: true, hasNegativeEvidence: true }],
    ]),
    maxRequirementsPerTest: 2,
  });
  const record = result.records.find((item) => item.requirementId === 'R-dedicated');
  assert.equal(record.assertionStatus, 'verified');
  assert.deepEqual(record.dedicatedTestPaths, ['tests/dedicated.test.mjs']);
  assert.equal(record.warnings.includes('over-broad-test-evidence:tests/shared.test.mjs'), true);
  assert.equal(record.warnings.includes('missing-test-path:tests/missing.test.mjs'), true);
  assert.equal(result.summary.assertionVerified, 1);
});
