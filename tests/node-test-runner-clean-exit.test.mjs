import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runNodeTests } from '../scripts/run-node-test-suite.mjs';

test('node test subprocess exits after passing even when a fixture leaks an interval', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-node-runner-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const fixture = path.join(root, 'leaky.test.mjs');
  await writeFile(fixture, "import test from 'node:test'; import assert from 'node:assert/strict'; test('passes',()=>assert.equal(1,1)); setInterval(()=>{},1000);\n");
  let timer;
  const result = await Promise.race([
    runNodeTests([fixture], { concurrency: 1, label: 'Clean exit fixture', quiet: true }),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('node test subprocess did not exit cleanly')), 4_000); }),
  ]).finally(() => clearTimeout(timer));
  assert.equal(result, 1);
});
