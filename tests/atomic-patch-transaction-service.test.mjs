import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { AtomicPatchTransactionService } from '../src/execution/atomic-patch-transaction-service.mjs';
import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';

function patch(file, before, after) {
  const beforeLines = before.replace(/\n$/, '').split('\n');
  const afterLines = after.replace(/\n$/, '').split('\n');
  return `--- a/${file}\n+++ b/${file}\n@@ -1,${beforeLines.length} +1,${afterLines.length} @@\n${beforeLines.map((line) => `-${line}`).join('\n')}\n${afterLines.map((line) => `+${line}`).join('\n')}\n`;
}

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-atomic-patch-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src'), { recursive: true });
  const a = '// KEEP: public contract\nexport const alpha = 1;\n';
  const b = 'export const beta = 2;\n';
  await writeFile(path.join(root, 'src', 'a.js'), a);
  await writeFile(path.join(root, 'src', 'b.js'), b);
  await chmod(path.join(root, 'src', 'a.js'), 0o640);
  const service = new AtomicPatchTransactionService({
    workspaceRoot: root,
    allowedCommands: [process.execPath],
    formatterTimeoutMs: 2_000,
  });
  return { root, service, a, b };
}

test('applies multiple patches all-or-rollback and emits minimal diffs with metrics', async (t) => {
  const f = await fixture(t);
  const nextA = '// KEEP: public contract\nexport const alpha = 10;\n';
  const nextB = 'export const beta = 20;\n';
  const dry = await f.service.apply({
    patches: [
      { patch: patch('src/a.js', f.a, nextA), expectedSha256: canonicalSha256(f.a) },
      { patch: patch('src/b.js', f.b, nextB), expectedSha256: canonicalSha256(f.b) },
    ],
    dryRun: true,
  });
  assert.equal(dry.dryRun, true);
  assert.equal(await readFile(path.join(f.root, 'src', 'a.js'), 'utf8'), f.a);
  assert.equal(dry.metrics.filesChanged, 2);
  assert.equal(dry.metrics.additions, 2);
  assert.equal(dry.metrics.deletions, 2);
  assert.equal(dry.metrics.changedLines, 4);
  assert.ok(dry.files.every((file) => file.minimalPatch.includes('@@')));
  assert.match(dry.receiptSha256, /^[a-f0-9]{64}$/);

  const applied = await f.service.apply({
    patches: [
      { patch: patch('src/a.js', f.a, nextA), expectedSha256: canonicalSha256(f.a) },
      { patch: patch('src/b.js', f.b, nextB), expectedSha256: canonicalSha256(f.b) },
    ],
  });
  assert.equal(applied.status, 'committed');
  assert.equal(await readFile(path.join(f.root, 'src', 'a.js'), 'utf8'), nextA);
  assert.equal(await readFile(path.join(f.root, 'src', 'b.js'), 'utf8'), nextB);
  assert.equal((await stat(path.join(f.root, 'src', 'a.js'))).mode & 0o777, 0o640);
});

test('rejects stale hashes, duplicate files, file and changed-line budgets before writing', async (t) => {
  const f = await fixture(t);
  const nextA = '// KEEP: public contract\nexport const alpha = 10;\n';
  const one = { patch: patch('src/a.js', f.a, nextA), expectedSha256: canonicalSha256(f.a) };
  await assert.rejects(() => f.service.apply({ patches: [{ ...one, expectedSha256: '0'.repeat(64) }] }), /hash mismatch/i);
  await assert.rejects(() => f.service.apply({ patches: [one, one] }), /duplicate patch path/i);
  await assert.rejects(() => f.service.apply({ patches: [one], maxFiles: 0 }), /maxFiles/i);
  await assert.rejects(() => f.service.apply({ patches: [one], maxChangedLines: 1 }), /changed-line budget/i);
  assert.equal(await readFile(path.join(f.root, 'src', 'a.js'), 'utf8'), f.a);
});

test('denies generated code and removal of protected comments', async (t) => {
  const f = await fixture(t);
  await mkdir(path.join(f.root, 'generated'), { recursive: true });
  const generated = '// @generated - do not edit\nexport const value = 1;\n';
  await writeFile(path.join(f.root, 'generated', 'client.js'), generated);
  await assert.rejects(() => f.service.apply({ patches: [{ patch: patch('generated/client.js', generated, generated.replace('1', '2')), expectedSha256: canonicalSha256(generated) }] }), /generated code/i);

  const withoutImportant = 'export const alpha = 10;\n';
  await assert.rejects(() => f.service.apply({ patches: [{ patch: patch('src/a.js', f.a, withoutImportant), expectedSha256: canonicalSha256(f.a) }] }), /protected comment/i);
  assert.equal(await readFile(path.join(f.root, 'src', 'a.js'), 'utf8'), f.a);
});

test('enforces reject, preserve, and resolve conflict-marker policies', async (t) => {
  const f = await fixture(t);
  const conflict = '<<<<<<< ours\nexport const beta = 2;\n=======\nexport const beta = 3;\n>>>>>>> theirs\n';
  await writeFile(path.join(f.root, 'src', 'b.js'), conflict);
  await assert.rejects(() => f.service.apply({ patches: [{ patch: patch('src/b.js', conflict, conflict), expectedSha256: canonicalSha256(conflict) }] }), /conflict markers/i);

  const preserved = conflict.replace('beta = 2', 'beta = 20');
  const keep = await f.service.apply({ patches: [{ patch: patch('src/b.js', conflict, preserved), expectedSha256: canonicalSha256(conflict) }], conflictPolicy: 'preserve', dryRun: true });
  assert.equal(keep.metrics.conflictBlocksBefore, 1);
  assert.equal(keep.metrics.conflictBlocksAfter, 1);

  const resolved = 'export const beta = 20;\n';
  const result = await f.service.apply({ patches: [{ patch: patch('src/b.js', conflict, resolved), expectedSha256: canonicalSha256(conflict) }], conflictPolicy: 'resolve' });
  assert.equal(result.metrics.conflictBlocksBefore, 1);
  assert.equal(result.metrics.conflictBlocksAfter, 0);
  assert.equal(await readFile(path.join(f.root, 'src', 'b.js'), 'utf8'), resolved);

  const malformed = '<<<<<<< ours\nvalue\n>>>>>>> theirs\n';
  await writeFile(path.join(f.root, 'src', 'b.js'), malformed);
  await assert.rejects(() => f.service.apply({ patches: [{ patch: patch('src/b.js', malformed, malformed), expectedSha256: canonicalSha256(malformed) }], conflictPolicy: 'preserve' }), /malformed conflict markers/i);
});

test('formats only transaction temp files and rolls back all originals when formatter fails', async (t) => {
  const f = await fixture(t);
  await mkdir(path.join(f.root, 'tools'), { recursive: true });
  const formatter = `import { readFile, writeFile } from 'node:fs/promises';\nconst file=process.argv[2];\nconst text=await readFile(file,'utf8');\nif(text.includes('FAIL_FORMAT')) process.exit(7);\nawait writeFile(file,text.replace(/;\\n$/,'; // formatted\\n'));\n`;
  await writeFile(path.join(f.root, 'tools', 'format.mjs'), formatter);
  const nextA = '// KEEP: public contract\nexport const alpha = 10;\n';
  const nextB = 'export const beta = 20;\n';
  const formatted = await f.service.apply({
    patches: [
      { patch: patch('src/a.js', f.a, nextA), expectedSha256: canonicalSha256(f.a) },
      { patch: patch('src/b.js', f.b, nextB), expectedSha256: canonicalSha256(f.b) },
    ],
    formatter: { command: process.execPath, args: ['tools/format.mjs', '{file}'] },
  });
  assert.equal(formatted.formatter.filesFormatted, 2);
  assert.match(await readFile(path.join(f.root, 'src', 'a.js'), 'utf8'), /formatted/);
  assert.match(await readFile(path.join(f.root, 'src', 'b.js'), 'utf8'), /formatted/);
  assert.ok(formatted.files.every((file) => !file.path.includes('forge-format')));

  const currentA = await readFile(path.join(f.root, 'src', 'a.js'), 'utf8');
  const currentB = await readFile(path.join(f.root, 'src', 'b.js'), 'utf8');
  const failA = currentA.replace('10', '11');
  const failB = currentB.replace('20', 'FAIL_FORMAT');
  await assert.rejects(() => f.service.apply({
    patches: [
      { patch: patch('src/a.js', currentA, failA), expectedSha256: canonicalSha256(currentA) },
      { patch: patch('src/b.js', currentB, failB), expectedSha256: canonicalSha256(currentB) },
    ],
    formatter: { command: process.execPath, args: ['tools/format.mjs', '{file}'] },
  }), /formatter exited with 7/i);
  assert.equal(await readFile(path.join(f.root, 'src', 'a.js'), 'utf8'), currentA);
  assert.equal(await readFile(path.join(f.root, 'src', 'b.js'), 'utf8'), currentB);
});

test('rejects semantic authorization failures before filesystem mutation', async (t) => {
  const f = await fixture(t);
  const nextA = '// KEEP: public contract\nexport const alpha = 10;\n';
  await assert.rejects(() => f.service.apply({
    patches: [{ patch: patch('src/a.js', f.a, nextA), expectedSha256: canonicalSha256(f.a) }],
    semanticAuthorization: { allowed: false, reasons: ['opportunistic-refactor'], receiptSha256: 'semantic-block' },
  }), /semantic patch authorization/i);
  assert.equal(await readFile(path.join(f.root, 'src', 'a.js'), 'utf8'), f.a);
});
