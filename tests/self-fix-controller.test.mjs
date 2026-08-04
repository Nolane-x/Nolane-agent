import assert from 'node:assert/strict';
import test from 'node:test';

import { SelfFixController } from '../src/testing/self-fix-controller.mjs';
import { DiagnosticDeltaService } from '../src/testing/diagnostic-delta-service.mjs';

function testResult(status, text, id) {
  return {
    status,
    output: { exitCode: status === 'pass' ? 0 : 1, stdout: '', stderr: text },
    receipt: { receiptSha256: String(id).padEnd(64, '0').slice(0, 64) },
  };
}

test('SelfFixController repairs only newly introduced diagnostics and stops after a verified pass', async () => {
  const runs = [
    testResult('fail', 'src/a.mjs:1:1 error OLD: existing\nsrc/b.mjs:2:3 error NEW: regression', 'run1'),
    testResult('pass', '', 'run2'),
  ];
  const repairs = [];
  let workspaceRevision = 0;
  const controller = new SelfFixController({
    testEngine: { async run(input) { assert.equal(input.scope, 'file'); return runs.shift(); } },
    diagnostics: new DiagnosticDeltaService(),
    workspaceFingerprint: async () => `workspace-${workspaceRevision}`,
    repair: async (request) => {
      repairs.push(request);
      assert.deepEqual(request.delta.newDiagnostics.map((item) => item.code), ['NEW']);
      assert.deepEqual(request.delta.persistingDiagnostics.map((item) => item.code), ['OLD']);
      workspaceRevision += 1;
      return { status: 'applied', strategyId: 'target-new-regression', receiptSha256: 'a'.repeat(64) };
    },
  });

  const result = await controller.run({
    test: { scope: 'file', path: 'tests/a.test.mjs' },
    baselineOutput: 'src/a.mjs:1:1 error OLD: existing',
  });

  assert.equal(result.status, 'pass');
  assert.equal(result.attempts, 1);
  assert.equal(repairs.length, 1);
  assert.equal(result.history.filter((item) => item.kind === 'test').length, 2);
  assert.match(result.receipt.receiptSha256, /^[a-f0-9]{64}$/);
});

test('SelfFixController requires a strategy change on repeated state and stops when no progress continues', async () => {
  const repairs = [];
  const controller = new SelfFixController({
    testEngine: { async run() { return testResult('fail', 'src/a.mjs:1:1 error E1: same failure', `run-${repairs.length}`); } },
    diagnostics: new DiagnosticDeltaService(),
    workspaceFingerprint: async () => 'unchanged-workspace',
    maxAttempts: 5,
    maxStagnantAttempts: 1,
    repair: async (request) => {
      repairs.push(request);
      return { status: 'applied', strategyId: request.requiredStrategyChange ? 'alternate' : 'initial', receiptSha256: `${repairs.length}`.repeat(64).slice(0, 64) };
    },
  });

  const result = await controller.run({ test: { scope: 'package' }, baselineOutput: '' });

  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'no-progress');
  assert.equal(repairs.length, 2);
  assert.equal(repairs[0].requiredStrategyChange, false);
  assert.equal(repairs[1].requiredStrategyChange, true);
});

test('SelfFixController does not modify a workspace when verification only reports pre-existing failures', async () => {
  let repairCalls = 0;
  const controller = new SelfFixController({
    testEngine: { async run() { return testResult('fail', 'src/a.mjs:1:1 error OLD: existing', 'run'); } },
    diagnostics: new DiagnosticDeltaService(),
    workspaceFingerprint: async () => 'workspace',
    repair: async () => { repairCalls += 1; return { status: 'applied', strategyId: 'wrong', receiptSha256: 'a'.repeat(64) }; },
  });

  const result = await controller.run({ test: { scope: 'full' }, baselineOutput: 'src/a.mjs:1:1 error OLD: existing' });

  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'pre-existing-failures-only');
  assert.equal(repairCalls, 0);
});
