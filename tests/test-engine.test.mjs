import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { TestEngine } from '../src/testing/test-engine.mjs';

async function workspace(files) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-test-engine-'));
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(root, relative); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, content);
  }
  return root;
}

test('TestEngine detects Node, Python, Go, and Rust test frameworks without executing code', async () => {
  const node = await workspace({ 'package.json': JSON.stringify({ scripts: { test: 'node --test', 'test:unit': 'node --test tests/unit' }, devDependencies: { vitest: '^3.0.0' } }), 'package-lock.json': '{}' });
  const python = await workspace({ 'pyproject.toml': '[tool.pytest.ini_options]\ntestpaths=["tests"]\n' });
  const go = await workspace({ 'go.mod': 'module example.com/forge\n\ngo 1.23\n' });
  const rust = await workspace({ 'Cargo.toml': '[package]\nname="forge"\nversion="0.1.0"\n' });
  assert.deepEqual((await new TestEngine({ workspaceRoot: node }).detect()).map((item) => item.id), ['node-vitest']);
  assert.deepEqual((await new TestEngine({ workspaceRoot: python }).detect()).map((item) => item.id), ['python-pytest']);
  assert.deepEqual((await new TestEngine({ workspaceRoot: go }).detect()).map((item) => item.id), ['go-test']);
  assert.deepEqual((await new TestEngine({ workspaceRoot: rust }).detect()).map((item) => item.id), ['rust-cargo-test']);
});

test('TestEngine plans related file before module, package, and full verification', async () => {
  const root = await workspace({ 'package.json': JSON.stringify({ scripts: { test: 'node --test' } }), 'package-lock.json': '{}', 'src/math.mjs': '', 'tests/math.test.mjs': '' });
  const engine = new TestEngine({ workspaceRoot: root });
  const plan = await engine.plan({ changedPaths: ['src/math.mjs'], relatedTests: ['tests/math.test.mjs'], includeFull: true });
  assert.deepEqual(plan.steps.map((step) => step.scope), ['file', 'module', 'package', 'full']);
  assert.deepEqual(plan.steps[0].args, ['--test', 'tests/math.test.mjs']);
  assert.equal(plan.steps.at(-1).command, 'npm');
  assert.deepEqual(plan.steps.at(-1).args, ['test', '--', '--test-reporter=spec']);
});

test('TestEngine executes argv-only steps, stops on failure, and emits content-addressed receipts', async () => {
  const root = await workspace({ 'package.json': JSON.stringify({ scripts: { test: 'node --test' } }), 'package-lock.json': '{}', 'tests/a.test.mjs': '' });
  const calls = [];
  const engine = new TestEngine({ workspaceRoot: root, runner: async (request) => { calls.push(request); return { exitCode: request.args.includes('tests/a.test.mjs') ? 1 : 0, stdout: '', stderr: 'failure', timedOut: false }; } });
  const result = await engine.run({ scope: 'file', path: 'tests/a.test.mjs' });
  assert.equal(result.status, 'fail');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].shell, false);
  assert.match(result.receipt.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(result.receipt.framework, 'node-test');
});

test('TestEngine supports unit and integration scripts and rejects paths outside the workspace', async () => {
  const root = await workspace({ 'package.json': JSON.stringify({ scripts: { test: 'node --test', 'test:unit': 'node --test tests/unit', 'test:integration': 'node --test tests/integration' } }), 'pnpm-lock.yaml': '' });
  const calls = [];
  const engine = new TestEngine({ workspaceRoot: root, runner: async (request) => { calls.push(request); return { exitCode: 0, stdout: 'ok', stderr: '', timedOut: false }; } });
  assert.equal((await engine.run({ scope: 'unit' })).status, 'pass');
  assert.equal((await engine.run({ scope: 'integration' })).status, 'pass');
  assert.deepEqual(calls.map((call) => [call.command, call.args]), [['pnpm', ['run', 'test:unit']], ['pnpm', ['run', 'test:integration']]]);
  await assert.rejects(() => engine.run({ scope: 'file', path: '../outside.test.mjs' }), /outside workspace/i);
});
