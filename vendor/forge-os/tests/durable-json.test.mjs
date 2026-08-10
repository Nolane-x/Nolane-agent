import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { atomicWriteJson } from '../src/storage/durable-json.mjs';

test('atomic JSON write persists content when directory sync is unsupported', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'forge-durable-json-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'state.json');

  const receipt = await atomicWriteJson(file, { b: 2, a: 1 }, {
    syncDirectory: async () => {
      const error = new Error('directory sync is unsupported');
      error.code = 'EPERM';
      throw error;
    },
  });

  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), { a: 1, b: 2 });
  assert.match(receipt.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(receipt.durability, { fileSync: 'completed', directorySync: 'unsupported' });
});

test('atomic JSON write fails for a directory sync error that is not platform unsupported', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'forge-durable-json-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'state.json');

  await assert.rejects(() => atomicWriteJson(file, { ok: true }, {
    syncDirectory: async () => {
      const error = new Error('durability device failure');
      error.code = 'EIO';
      throw error;
    },
  }), /durability device failure/);
});
