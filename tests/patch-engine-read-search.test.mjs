import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ToolBroker } from '../src/execution/tool-broker.mjs';

async function brokerFixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-patch-read-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src', 'alpha.mjs'), 'export const alpha = 1;\nexport function beta() { return alpha; }\n');
  await writeFile(path.join(root, 'src', 'beta.txt'), 'alpha\nbeta\ngamma\n');
  return new ToolBroker({ workspaceRoot: root, allowedCommands: [], maxOutputBytes: 4096 });
}

test('patch read-search compatibility reads exact ranges with line metadata', async (t) => {
  const broker = await brokerFixture(t);
  const result = await broker.execute({ tool: 'fs.read', input: { path: 'src/beta.txt', startLine: 2, endLine: 3 } });
  assert.equal(result.output.content, 'beta\ngamma\n');
  assert.equal(result.output.startLine, 2);
  assert.equal(result.output.endLine, 3);
});

test('patch read-search compatibility finds bounded content and rejects invalid ranges', async (t) => {
  const broker = await brokerFixture(t);
  const result = await broker.execute({ tool: 'fs.search', input: { query: 'alpha', path: 'src', limit: 10 } });
  assert.ok(result.output.matches.length >= 2);
  assert.ok(result.output.matches.every((item) => Number.isInteger(item.line)));
  await assert.rejects(() => broker.execute({ tool: 'fs.read', input: { path: 'src/beta.txt', startLine: 99 } }), /outside file/i);
});
