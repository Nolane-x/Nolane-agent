import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { ToolBroker } from '../src/execution/tool-broker.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-tool-complete-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src', 'a.txt'), 'one\ntwo\nthree\nfour\n');
  await writeFile(path.join(root, 'src', 'b.txt'), 'bee\n');
  await chmod(path.join(root, 'src', 'a.txt'), 0o750);
  return { root, broker: new ToolBroker({ workspaceRoot: root }) };
}

test('ToolBroker supports paged reads and bounded parallel multi-file reads', async (t) => {
  const { broker } = await fixture(t);
  const first = await broker.execute({ tool: 'fs.read', input: { path: 'src/a.txt', pageSizeLines: 2 } });
  assert.equal(first.output.content, 'one\ntwo\n');
  assert.equal(typeof first.output.nextPageToken, 'string');
  const second = await broker.execute({ tool: 'fs.read', input: { path: 'src/a.txt', pageSizeLines: 2, pageToken: first.output.nextPageToken } });
  assert.equal(second.output.content, 'three\nfour\n');
  assert.equal(second.output.nextPageToken, null);
  const many = await broker.execute({ tool: 'fs.readMany', input: { paths: ['src/b.txt', 'src/a.txt'], concurrency: 2 } });
  assert.deepEqual(many.output.items.map((item) => item.path), ['src/b.txt', 'src/a.txt']);
  assert.equal(many.output.items[1].totalLines, 4);
});

test('ToolBroker deletes, renames, creates directories, removes empty directories, and preserves mode on write', async (t) => {
  const { root, broker } = await fixture(t);
  await broker.execute({ tool: 'fs.write', input: { path: 'src/a.txt', content: 'changed\n' } });
  if (process.platform !== 'win32') assert.equal((await stat(path.join(root, 'src', 'a.txt'))).mode & 0o777, 0o750);
  await broker.execute({ tool: 'fs.mkdir', input: { path: 'generated/nested' } });
  await broker.execute({ tool: 'fs.rename', input: { from: 'src/b.txt', to: 'generated/nested/b.txt' } });
  assert.equal(await readFile(path.join(root, 'generated/nested/b.txt'), 'utf8'), 'bee\n');
  await broker.execute({ tool: 'fs.delete', input: { path: 'generated/nested/b.txt' } });
  await broker.execute({ tool: 'fs.rmdir', input: { path: 'generated/nested' } });
  await assert.rejects(() => stat(path.join(root, 'generated/nested')), /ENOENT/);
});

test('ToolBroker detects and redacts secrets emitted by terminal processes before output and receipt hashing', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-terminal-secret-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const broker = new ToolBroker({ workspaceRoot: root, allowedPaths: ['**'], allowedCommands: [process.execPath] });
  const secret = 'sk-abcdefghijklmnopqrstuvwxyz123456';
  const result = await broker.execute({ tool: 'process.run', input: { command: process.execPath, args: ['-e', `process.stdout.write(${JSON.stringify(secret)})`], cwd: '.' } });
  assert.equal(result.status, 'pass');
  assert.doesNotMatch(result.output.stdout, /sk-abcdefghijklmnopqrstuvwxyz/);
  assert.match(result.output.stdout, /REDACTED/);
  assert.match(result.receipt.outputSha256, /^[a-f0-9]{64}$/);
});
