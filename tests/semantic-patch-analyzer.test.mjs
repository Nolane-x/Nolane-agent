import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeSemanticPatch } from '../src/construction/semantic-patch-analyzer.mjs';

test('scores a small public API break above a larger compatible internal patch', () => {
  const apiBreak = analyzeSemanticPatch({
    taskKind: 'bugfix', changedFiles: 1, changedLines: 5, changedSymbols: ['validateSession'],
    publicApiChanges: [{ symbolId: 'validateSession', kind: 'signature-change', compatibility: 'breaking' }],
    callerCount: 8,
  });
  const internal = analyzeSemanticPatch({
    taskKind: 'bugfix', changedFiles: 1, changedLines: 30, changedSymbols: ['normalizeExpiry'],
    publicApiChanges: [], callerCount: 1,
  });
  assert.ok(apiBreak.semanticFootprint > internal.semanticFootprint);
  assert.ok(apiBreak.findings.some((item) => item.kind === 'breaking-public-api'));
});

test('records generated, test weakening, permission and correction lineage costs', () => {
  const report = analyzeSemanticPatch({
    taskKind: 'feature', changedFiles: 4, changedLines: 60, changedSymbols: ['a', 'b'],
    generatedPaths: ['dist/client.js'], weakenedTests: ['tests/auth.test.mjs'],
    permissionChanges: [{ kind: 'network', scope: 'external' }], revertedLines: 25, correctionCycles: 2,
  });
  assert.ok(report.findings.some((item) => item.kind === 'generated-source-edit'));
  assert.ok(report.findings.some((item) => item.kind === 'test-integrity-weakened'));
  assert.ok(report.findings.some((item) => item.kind === 'permission-expansion'));
  assert.equal(report.editCost.revertedLines, 25);
  assert.equal(report.editCost.correctionCycles, 2);
});
