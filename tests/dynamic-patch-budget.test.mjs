import test from 'node:test';
import assert from 'node:assert/strict';

import { derivePatchBudget } from '../src/construction/dynamic-patch-budget.mjs';

test('derives small bugfix and larger bounded feature budgets', () => {
  const bug = derivePatchBudget({ taskKind: 'bugfix', risk: 'low' });
  const feature = derivePatchBudget({ taskKind: 'feature', risk: 'medium' });
  assert.deepEqual({ maxFiles: bug.maxFiles, maxChangedLines: bug.maxChangedLines }, { maxFiles: 2, maxChangedLines: 80 });
  assert.ok(feature.maxFiles > bug.maxFiles);
  assert.ok(feature.maxChangedLines > bug.maxChangedLines);
  assert.ok(feature.maxChangedLines <= 1000);
});

test('requires evidence to expand a budget and never weakens hard constraints', () => {
  const expanded = derivePatchBudget({ taskKind: 'bugfix', risk: 'high', requested: { maxFiles: 6, maxChangedLines: 400 }, expansionEvidenceReceiptId: 'blast-radius-proof' });
  assert.equal(expanded.expanded, true);
  assert.throws(() => derivePatchBudget({ taskKind: 'bugfix', risk: 'high', requested: { maxFiles: 6, maxChangedLines: 400 } }), /evidence/i);
});
