import test from 'node:test';
import assert from 'node:assert/strict';

import { VerificationRunner } from '../src/orchestration/verification-runner.mjs';

function receipt(tool, output, status = 'pass') {
  return { status, output, receipt: { receiptSha256: (tool.charCodeAt(0).toString(16).padStart(2, '0').repeat(32)).slice(0, 64), durationMs: 2 } };
}

function fixture({ planScopes = ['file', 'module', 'package', 'full'], testStatus = 'pass' } = {}) {
  const task = {
    id: 't1', projectId: 'p1', missionId: 'm1', status: 'review', objective: 'Implement and verify a complete test matrix with one required report.',
    metadata: {
      testMatrix: { changedPaths: ['src/a.mjs'], relatedTests: ['tests/a.test.mjs'], requireFull: true },
      taskContract: {
        schema: 'forge.task-contract.v1',
        successCriteria: [{ id: 'syntax', description: 'Source parses', verification: { command: 'node', args: ['--check', 'src/a.mjs'] } }],
        outputContract: { requiredArtifacts: ['verification-report.md'] },
      },
    },
  };
  const calls = [];
  const broker = {
    async execute(request) {
      calls.push(['broker', request]);
      if (request.tool === 'fs.read') return receipt('f', { path: request.input.path, content: 'report', bytes: 6, sha256: 'd'.repeat(64) });
      const args = request.input.args;
      if (args[0] === 'rev-parse') return receipt('h', { command: 'git', args, stdout: 'a'.repeat(40) + '\n', stderr: '', exitCode: 0 });
      if (args[0] === 'diff' && args[1] === '--binary') return receipt('d', { command: 'git', args, stdout: 'diff', stderr: '', exitCode: 0 });
      return receipt('c', { command: request.input.command, args, stdout: '', stderr: '', exitCode: 0 });
    },
  };
  const testEngine = {
    async plan(input) { calls.push(['plan', input]); return { steps: planScopes.map((scope) => ({ scope, path: scope === 'file' ? 'tests/a.test.mjs' : scope === 'module' ? 'tests' : undefined })) }; },
    async run(input) { calls.push(['test', input]); return { status: testStatus, output: { exitCode: testStatus === 'pass' ? 0 : 1, stdout: '', stderr: '' }, receipt: { receiptSha256: 'e'.repeat(64), durationMs: 3 }, framework: { id: 'node-test' }, step: { command: 'node', args: ['--test'] } }; },
  };
  const store = { getTask: (id) => id === 't1' ? task : null };
  return { runner: new VerificationRunner({ store, brokerFactory: () => broker, testEngineFactory: () => testEngine }), calls };
}

test('VerificationRunner executes related-to-full test matrix, task success criteria, and required artifacts', async () => {
  const { runner, calls } = fixture();
  const report = await runner.runTask('t1');
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.evidence.map((item) => item.kind), ['diff-check', 'test-file', 'test-module', 'test-package', 'test-full', 'success-criterion', 'required-artifact']);
  assert.deepEqual(calls.filter(([kind]) => kind === 'test').map(([, input]) => input.scope), ['file', 'module', 'package', 'full']);
  assert.equal(report.fullMatrixCompleted, true);
});

test('VerificationRunner fails closed when a required full test gate is absent', async () => {
  const { runner } = fixture({ planScopes: ['file', 'module', 'package'] });
  const report = await runner.runTask('t1');
  assert.equal(report.status, 'fail');
  assert.equal(report.fullMatrixCompleted, false);
  const gate = report.evidence.find((item) => item.kind === 'test-full-gate');
  assert.ok(gate);
  assert.match(gate.receiptSha256, /^[a-f0-9]{64}$/);
});

test('VerificationRunner preserves failing test evidence instead of manufacturing success', async () => {
  const { runner } = fixture({ testStatus: 'fail' });
  const report = await runner.runTask('t1');
  assert.equal(report.status, 'fail');
  assert.ok(report.evidence.some((item) => item.kind === 'test-file' && item.status === 'fail'));
  assert.equal(report.evidence.some((item) => item.kind === 'test-file' && item.status === 'pass'), false);
});
