import test from 'node:test';
import assert from 'node:assert/strict';
import { auditEvidenceBindings } from '../src/forensics/evidence-quality-auditor.mjs';

function requirement(id, overrides = {}) {
  return {
    id,
    status: 'verified',
    acceptance: {
      productionEntrypoint: 'src/runtime.mjs',
      productionEntryPoints: ['src/runtime.mjs'],
      testPaths: ['tests/runtime.test.mjs'],
      negativeTestPaths: ['tests/runtime-negative.test.mjs'],
      positiveAssertions: ['tests/runtime.test.mjs#works'],
      negativeAssertions: ['tests/runtime-negative.test.mjs#rejects'],
      ...overrides,
    },
  };
}

test('evidence audit rejects documentation-only production entrypoints and missing assertion bindings', () => {
  const report = auditEvidenceBindings({ requirements: [
    requirement('R1', { productionEntrypoint: 'docs/measurement.json', productionEntryPoints: ['docs/measurement.json'], positiveAssertions: [], negativeAssertions: [] }),
  ] });
  assert.ok(report.violations.some((item) => item.code === 'documentation-production-entrypoint'));
  assert.ok(report.violations.some((item) => item.code === 'missing-positive-assertion'));
  assert.ok(report.violations.some((item) => item.code === 'missing-negative-assertion'));
  assert.equal(report.certifiable, false);
});

test('evidence audit reports tests reused beyond a bounded threshold', () => {
  const requirements = Array.from({ length: 4 }, (_, index) => requirement(`R${index}`, { testPaths: ['tests/generic.test.mjs'], positiveAssertions: [`tests/generic.test.mjs#case-${index}`] }));
  const report = auditEvidenceBindings({ requirements, policy: { maxRequirementsPerTest: 3 } });
  assert.equal(report.overBroadEvidence[0].path, 'tests/generic.test.mjs');
  assert.equal(report.overBroadEvidence[0].requirements, 4);
});

test('fully bound evidence remains certifiable', () => {
  const report = auditEvidenceBindings({ requirements: [requirement('R1')] });
  assert.equal(report.violations.length, 0);
  assert.equal(report.certifiable, true);
});
