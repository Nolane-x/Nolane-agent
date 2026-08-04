import test from 'node:test';
import assert from 'node:assert/strict';

import { EvalRunner } from '../src/eval/eval-runner.mjs';

const suite = {
  id: 'coding-smoke',
  cases: [
    { id: 'read', input: { objective: 'Read file' }, assertions: { state: 'awaiting-verification', outputIncludes: ['hello'], maxToolCalls: 2, evidenceComplete: true } },
    { id: 'patch', input: { objective: 'Patch file' }, assertions: { state: 'awaiting-verification', outputIncludes: ['patched'], maxToolCalls: 3, evidenceComplete: true } },
  ],
};

test('EvalRunner scores providers, records bounded metrics, and emits a deterministic semantic report hash', async () => {
  let tick = 0;
  const runner = new EvalRunner({
    clock: () => (tick += 10),
    executor: async ({ evalCase, providerId }) => ({
      state: 'awaiting-verification',
      output: providerId === 'strong' ? `${evalCase.id === 'read' ? 'hello' : 'patched'} result` : 'wrong',
      toolCalls: evalCase.id === 'read' ? 1 : 2,
      estimatedTokens: 100,
      retries: 0,
      evidence: providerId === 'strong' ? [{ status: 'pass', receiptSha256: 'a'.repeat(64) }] : [],
    }),
  });
  const first = await runner.runSuite(suite, { providerIds: ['strong', 'weak'], timeoutMs: 1000 });
  assert.equal(first.providers.strong.passRate, 1);
  assert.equal(first.providers.weak.passRate, 0);
  assert.equal(first.providers.strong.totalToolCalls, 3);
  assert.equal(first.cases.length, 4);
  assert.match(first.reportSha256, /^[a-f0-9]{64}$/);

  tick = 0;
  const second = await runner.runSuite(suite, { providerIds: ['strong', 'weak'], timeoutMs: 1000 });
  assert.equal(second.reportSha256, first.reportSha256, 'elapsed telemetry must not destabilize the semantic hash');
});

test('EvalRunner times out one case without cancelling the remaining provider comparison', async () => {
  const runner = new EvalRunner({
    executor: async ({ evalCase, signal }) => {
      if (evalCase.id === 'read') await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 500);
        signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('aborted')); }, { once: true });
      });
      return { state: 'awaiting-verification', output: 'patched hello', toolCalls: 0, estimatedTokens: 1, evidence: [{ status: 'pass', receiptSha256: 'b'.repeat(64) }] };
    },
  });
  const report = await runner.runSuite(suite, { providerIds: ['one'], timeoutMs: 20 });
  assert.equal(report.cases.find((item) => item.caseId === 'read').status, 'timeout');
  assert.equal(report.cases.find((item) => item.caseId === 'patch').status, 'pass');
  assert.equal(report.providers.one.passCount, 1);
});

test('EvalRunner validates duplicate case IDs and empty provider sets', async () => {
  const runner = new EvalRunner({ executor: async () => ({}) });
  await assert.rejects(() => runner.runSuite({ id: 'bad', cases: [{ id: 'x' }, { id: 'x' }] }, { providerIds: ['p'] }), /duplicate eval case/i);
  await assert.rejects(() => runner.runSuite(suite, { providerIds: [] }), /provider/i);
});
