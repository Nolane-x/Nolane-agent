import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { parseUnifiedPatch, applyUnifiedPatch } from '../src/execution/unified-patch.mjs';
import { ToolBroker } from '../src/execution/tool-broker.mjs';
import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';

const PATCH = `--- a/src/a.txt
+++ b/src/a.txt
@@ -1,3 +1,3 @@
 alpha
-beta
+BETA
 gamma
@@ -5,2 +5,3 @@
 epsilon
 zeta
+eta
`;

test('parseUnifiedPatch parses a single file with multiple hunks', () => {
  const parsed = parseUnifiedPatch(PATCH);
  assert.equal(parsed.oldPath, 'src/a.txt');
  assert.equal(parsed.newPath, 'src/a.txt');
  assert.equal(parsed.hunks.length, 2);
  assert.deepEqual(parsed.hunks[0].lines.slice(1, 3), ['-beta', '+BETA']);
});

test('applyUnifiedPatch applies exact hunks and reports conflicts without partial output', () => {
  const original = 'alpha\nbeta\ngamma\ndelta\nepsilon\nzeta\n';
  const result = applyUnifiedPatch(original, parseUnifiedPatch(PATCH));
  assert.equal(result.content, 'alpha\nBETA\ngamma\ndelta\nepsilon\nzeta\neta\n');
  assert.equal(result.appliedHunks, 2);
  assert.throws(() => applyUnifiedPatch(original.replace('beta', 'different'), parseUnifiedPatch(PATCH)), /patch conflict.*hunk 1/i);
});

test('ToolBroker fs.patch enforces path containment and expected hash then emits receipt', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-patch-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src'));
  const original = 'alpha\nbeta\ngamma\ndelta\nepsilon\nzeta\n';
  await writeFile(path.join(root, 'src', 'a.txt'), original);
  const broker = new ToolBroker({ workspaceRoot: root, allowedCommands: [] });

  await assert.rejects(() => broker.execute({ tool: 'fs.patch', input: { patch: PATCH, expectedSha256: '0'.repeat(64) } }), /hash mismatch/i);
  const result = await broker.execute({ tool: 'fs.patch', input: { patch: PATCH, expectedSha256: canonicalSha256(original) } });
  assert.equal(result.status, 'pass');
  assert.equal(result.output.path, 'src/a.txt');
  assert.equal(result.output.appliedHunks, 2);
  assert.match(result.receipt.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(await readFile(path.join(root, 'src', 'a.txt'), 'utf8'), 'alpha\nBETA\ngamma\ndelta\nepsilon\nzeta\neta\n');

  const traversal = PATCH.replaceAll('src/a.txt', '../outside.txt');
  await assert.rejects(() => broker.execute({ tool: 'fs.patch', input: { patch: traversal } }), /escapes workspace/i);
});
