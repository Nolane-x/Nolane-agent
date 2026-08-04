import test from 'node:test';
import assert from 'node:assert/strict';
import { expectedFrontierAuditCounts } from '../src/release/frontier-audit-counts.mjs';

test('frontier audit count table preserves historical releases and supports major 4', () => {
  assert.deepEqual(expectedFrontierAuditCounts('2.20.0'), { verified_source_test: 759, partial: 7, external_gate: 56, not_implemented: 328 });
  assert.deepEqual(expectedFrontierAuditCounts('2.29.0'), { verified_source_test: 936, partial: 112, external_gate: 59, not_implemented: 43 });
  assert.deepEqual(expectedFrontierAuditCounts('3.0.0'), { verified_source_test: 959, partial: 115, external_gate: 63, not_implemented: 13 });
  assert.deepEqual(expectedFrontierAuditCounts('4.0.0'), { verified_source_test: 1081, partial: 0, external_gate: 69, not_implemented: 0 });
  assert.throws(() => expectedFrontierAuditCounts('5.0.0'), /unsupported frontier audit version/);
});
