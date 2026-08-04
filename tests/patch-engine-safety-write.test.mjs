import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ToolBroker } from '../src/execution/tool-broker.mjs';
import { WorkspacePolicy } from '../src/security/path-policy.mjs';
import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-patch-safety-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src', 'a.txt'), 'old\n');
  return { root, broker: new ToolBroker({ workspaceRoot: root, allowedCommands: [] }) };
}

test('patch safety-write compatibility creates and replaces files with expected hashes', async (t) => {
  const { root, broker } = await fixture(t);
  await broker.execute({ tool: 'fs.write', input: { path: 'src/new.txt', content: 'created\n' } });
  assert.equal(await readFile(path.join(root, 'src', 'new.txt'), 'utf8'), 'created\n');
  await broker.execute({ tool: 'fs.write', input: { path: 'src/a.txt', content: 'new\n', expectedSha256: canonicalSha256('old\n') } });
  assert.equal(await readFile(path.join(root, 'src', 'a.txt'), 'utf8'), 'new\n');
});

test('patch safety-write compatibility blocks traversal, stale hashes, and symlink escapes', async (t) => {
  const { root, broker } = await fixture(t);
  await assert.rejects(() => broker.execute({ tool: 'fs.write', input: { path: '../escape.txt', content: 'no' } }), /escapes workspace/i);
  await assert.rejects(() => broker.execute({ tool: 'fs.write', input: { path: 'src/a.txt', content: 'no', expectedSha256: '0'.repeat(64) } }), /hash mismatch/i);
  const outside = await mkdtemp(path.join(os.tmpdir(), 'nolane-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await symlink(outside, path.join(root, 'src', 'link'), 'dir');
  const policy = new WorkspacePolicy(root);
  await assert.rejects(() => policy.resolveWrite('src/link/file.txt'), /symlink/i);
});
