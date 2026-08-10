import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  collectMultiRuntimeTrajectories,
  writeMultiRuntimeTrajectoryDataset,
  verifyMultiRuntimeTrajectoryDataset,
} from '../src/small-model/multi-runtime-trajectory-collector.mjs';

const GO_AVAILABLE = spawnSync(process.env.GO_BINARY || 'go', ['version'], { stdio: 'ignore', windowsHide: true }).status === 0;
const GO_SKIP = GO_AVAILABLE ? false : 'Go executable is unavailable on this host';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-multi-runtime-'));
  t.after(() => rm(root, { recursive: true, force: true }));

  await mkdir(path.join(root, 'node-project'), { recursive: true });
  await writeFile(path.join(root, 'node-project', 'math.mjs'), 'export const add = (a, b) => a + b;\n');
  await writeFile(path.join(root, 'node-project', 'math.test.mjs'), "import test from 'node:test'; import assert from 'node:assert/strict'; import { add } from './math.mjs'; test('node add',()=>assert.equal(add(2,3),5));\n");

  await mkdir(path.join(root, 'go-project'), { recursive: true });
  await writeFile(path.join(root, 'go-project', 'go.mod'), 'module example.test/multi\n\ngo 1.22\n');
  await writeFile(path.join(root, 'go-project', 'math.go'), 'package multi\nfunc Add(a int, b int) int { return a + b }\n');
  await writeFile(path.join(root, 'go-project', 'math_test.go'), 'package multi\nimport "testing"\nfunc TestAdd(t *testing.T){ if Add(2,3)!=5 { t.Fatal("bad add") } }\n');

  await mkdir(path.join(root, 'python-project'), { recursive: true });
  await writeFile(path.join(root, 'python-project', 'mathlib.py'), 'def add(a, b):\n    return a + b\n');
  await writeFile(path.join(root, 'python-project', 'test_mathlib.py'), 'import unittest\nfrom mathlib import add\nclass T(unittest.TestCase):\n    def test_add(self): self.assertEqual(add(2,3),5)\nif __name__ == "__main__": unittest.main()\n');
  return root;
}

function probes() {
  const labels = { toolRouter: 'test', contextScorer: 'support', testSelector: 'integration', patchRanker: 'accept', riskClassifier: 'low' };
  return [
    { id: 'node-pass', projectId: 'node', projectRoot: 'node-project', runtime: 'node', argv: ['--test', 'math.test.mjs'], sourcePaths: ['math.mjs'], testPaths: ['math.test.mjs'], kind: 'verification', actionType: 'test', state: { scenarioGroup: 'node-pass', labels } },
    { id: 'go-pass', projectId: 'go', projectRoot: 'go-project', runtime: 'go', argv: ['test', './...'], sourcePaths: ['math.go'], testPaths: ['math_test.go'], kind: 'verification', actionType: 'test', state: { scenarioGroup: 'go-pass', labels } },
    { id: 'python-pass', projectId: 'python', projectRoot: 'python-project', runtime: 'python', argv: ['-m', 'unittest', 'discover', '-s', '.', '-p', 'test_*.py'], sourcePaths: ['mathlib.py'], testPaths: ['test_mathlib.py'], kind: 'verification', actionType: 'test', state: { scenarioGroup: 'python-pass', labels } },
  ];
}

test('multi-runtime collector records real Node Go and Python verifier outcomes', { skip: GO_SKIP }, async (t) => {
  const root = await fixture(t);
  const result = await collectMultiRuntimeTrajectories({ root, probes: probes(), timeoutMs: 30_000 });
  assert.equal(result.episodes.length, 3);
  assert.deepEqual([...new Set(result.episodes.map((entry) => entry.state.runtime))].sort(), ['go', 'node', 'python']);
  assert.ok(result.episodes.every((entry) => entry.verifier.valid === true && entry.verifier.exitCode === 0));
  assert.ok(result.episodes.every((entry) => /^[a-f0-9]{64}$/.test(entry.receiptSha256)));
});

test('multi-runtime collector rejects traversal shell strings and unsupported runtimes', async (t) => {
  const root = await fixture(t);
  await assert.rejects(() => collectMultiRuntimeTrajectories({ root, probes: [{ ...probes()[0], projectRoot: '../escape' }] }), /outside|project root/i);
  await assert.rejects(() => collectMultiRuntimeTrajectories({ root, probes: [{ ...probes()[0], argv: '--test math.test.mjs' }] }), /argv/i);
  await assert.rejects(() => collectMultiRuntimeTrajectories({ root, probes: [{ ...probes()[0], runtime: 'bash' }] }), /unsupported runtime/i);
});

test('multi-runtime dataset is content addressed and rejects tampering', { skip: GO_SKIP }, async (t) => {
  const root = await fixture(t);
  const collection = await collectMultiRuntimeTrajectories({ root, probes: probes() });
  const outputDir = path.join(root, 'dataset');
  const receipt = await writeMultiRuntimeTrajectoryDataset({ outputDir, collection });
  const verified = await verifyMultiRuntimeTrajectoryDataset({ outputDir });
  assert.equal(verified.episodes.length, 3);
  assert.equal(receipt.receiptSha256, verified.receiptSha256);
  const file = path.join(outputDir, 'execution-episodes.jsonl');
  await writeFile(file, `${await readFile(file, 'utf8')}{}\n`);
  await assert.rejects(() => verifyMultiRuntimeTrajectoryDataset({ outputDir }), /hash|count|receipt/i);
});
