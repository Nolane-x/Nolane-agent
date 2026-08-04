import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { SymbolEditService } from '../src/repository/symbol-edit-service.mjs';
import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-symbol-edit-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = `export function add(a, b) {\n  return a + b;\n}\n\nexport class Counter {\n  value = 0;\n  increment() { this.value += 1; }\n}\n`;
  await mkdir(path.join(root, 'src'), { recursive: true });
  await writeFile(path.join(root, 'src', 'math.mjs'), source);
  return { root, source, service: new SymbolEditService({ workspaceRoot: root, allowedPaths: ['src/**'] }) };
}

test('SymbolEditService lists and reads exact function and class ranges with line metadata', async (t) => {
  const f = await fixture(t);
  const symbols = await f.service.list({ path: 'src/math.mjs' });
  assert.deepEqual(symbols.map((item) => [item.kind, item.name]), [['function', 'add'], ['class', 'Counter']]);
  const selected = await f.service.read({ path: 'src/math.mjs', symbol: 'Counter', kind: 'class' });
  assert.equal(selected.startLine, 5);
  assert.equal(selected.endLine, 8);
  assert.match(selected.content, /increment/);
  assert.match(selected.fileSha256, /^[a-f0-9]{64}$/);
});

test('SymbolEditService replaces and inserts around symbols with stale-hash and generated-code guards', async (t) => {
  const f = await fixture(t);
  const before = canonicalSha256(f.source);
  const replaced = await f.service.replace({
    path: 'src/math.mjs', symbol: 'add', kind: 'function', expectedSha256: before,
    content: `export function add(a, b) {\n  return Number(a) + Number(b);\n}`,
  });
  assert.notEqual(replaced.beforeSha256, replaced.afterSha256);
  const insertedBefore = await f.service.insertBefore({ path: 'src/math.mjs', symbol: 'Counter', content: 'const initial = 0;\n\n', expectedSha256: replaced.afterSha256 });
  const insertedAfter = await f.service.insertAfter({ path: 'src/math.mjs', symbol: 'Counter', content: '\nexport const counter = new Counter();', expectedSha256: insertedBefore.afterSha256 });
  const final = await readFile(path.join(f.root, 'src', 'math.mjs'), 'utf8');
  assert.match(final, /Number\(a\)/);
  assert.match(final, /const initial = 0;\n\nexport class Counter/);
  assert.match(final, /export const counter = new Counter\(\);/);
  await assert.rejects(() => f.service.replace({ path: 'src/math.mjs', symbol: 'add', content: 'bad', expectedSha256: before }), /hash mismatch/i);
  await mkdir(path.join(f.root, 'src', 'generated'), { recursive: true });
  await writeFile(path.join(f.root, 'src', 'generated', 'client.mjs'), 'function generated() {}\n');
  await assert.rejects(() => f.service.replace({ path: 'src/generated/client.mjs', symbol: 'generated', content: 'function generated() { return 1; }' }), /generated code/i);
  assert.match(insertedAfter.operationSha256, /^[a-f0-9]{64}$/);
});

test('SymbolEditService rejects ambiguous symbols instead of patching the wrong declaration', async (t) => {
  const f = await fixture(t);
  await writeFile(path.join(f.root, 'src', 'duplicate.mjs'), 'function same() {}\nfunction same() {}\n');
  await assert.rejects(() => f.service.read({ path: 'src/duplicate.mjs', symbol: 'same' }), /ambiguous/i);
});
