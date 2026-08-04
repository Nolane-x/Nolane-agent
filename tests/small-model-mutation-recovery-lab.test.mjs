import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  runMutationRecoveryLab,
  writeMutationRecoveryDataset,
  verifyMutationRecoveryDataset,
} from '../src/small-model/mutation-recovery-lab.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-recovery-lab-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'node-project'), { recursive: true });
  await writeFile(path.join(root, 'node-project', 'math.mjs'), 'export const add = (a, b) => a + b;\n');
  await writeFile(path.join(root, 'node-project', 'math.test.mjs'), "import test from 'node:test'; import assert from 'node:assert/strict'; import { add } from './math.mjs'; test('node add',()=>assert.equal(add(2,3),5));\n");
  return root;
}

function scenario() {
  return {
    id: 'node-add-recovery', projectId: 'node-fixture', projectRoot: 'node-project', runtime: 'node',
    argv: ['--test', 'math.test.mjs'], sourcePath: 'math.mjs', testPaths: ['math.test.mjs'],
    mutation: { from: 'a + b', to: 'a - b' }, repair: { from: 'a - b', to: 'a + b' },
    state: {
      scenarioGroup: 'node-add-recovery', evidenceFamily: 'mutation-recovery',
      failureLabels: { toolRouter: 'stop', contextScorer: 'counter-evidence', testSelector: 'mutation', patchRanker: 'reject', riskClassifier: 'high' },
      recoveryLabels: { toolRouter: 'rollback', contextScorer: 'support', testSelector: 'integration', patchRanker: 'accept', riskClassifier: 'low' },
    },
  };
}

test('mutation recovery lab observes pass fail repair pass without changing original source', async (t) => {
  const root = await fixture(t);
  const before = await readFile(path.join(root, 'node-project', 'math.mjs'), 'utf8');
  const result = await runMutationRecoveryLab({ root, scenarios: [scenario()] });
  assert.equal(result.scenarios.length, 1);
  assert.equal(result.episodes.length, 2);
  assert.deepEqual(result.scenarios[0].phases.map((phase) => phase.exitCode), [0, 1, 0]);
  assert.equal(result.scenarios[0].mutationObserved, true);
  assert.equal(result.scenarios[0].recoveryObserved, true);
  assert.equal(await readFile(path.join(root, 'node-project', 'math.mjs'), 'utf8'), before);
});

test('mutation recovery lab rejects non-exact mutations and path escape', async (t) => {
  const root = await fixture(t);
  await assert.rejects(() => runMutationRecoveryLab({ root, scenarios: [{ ...scenario(), mutation: { from: 'missing-token', to: 'x' } }] }), /exactly once|mutation/i);
  await assert.rejects(() => runMutationRecoveryLab({ root, scenarios: [{ ...scenario(), sourcePath: '../escape.mjs' }] }), /outside|source path/i);
});

test('mutation recovery dataset is content addressed and detects tampering', async (t) => {
  const root = await fixture(t);
  const result = await runMutationRecoveryLab({ root, scenarios: [scenario()] });
  const outputDir = path.join(root, 'dataset');
  const receipt = await writeMutationRecoveryDataset({ outputDir, result });
  const verified = await verifyMutationRecoveryDataset({ outputDir });
  assert.equal(verified.episodes.length, 2);
  assert.equal(verified.receiptSha256, receipt.receiptSha256);
  const file = path.join(outputDir, 'recovery-episodes.jsonl');
  await writeFile(file, `${await readFile(file, 'utf8')}{}\n`);
  await assert.rejects(() => verifyMutationRecoveryDataset({ outputDir }), /hash|count/i);
});
