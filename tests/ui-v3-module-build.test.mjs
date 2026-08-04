import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildUiV3 } from '../scripts/build-ui-v3.mjs';

test('UI v3 build emits deterministic hashed local assets and a verified module map', async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'nolane-ui-v3-'));
  const first = await buildUiV3({ sourceRoot: path.resolve('ui-v3'), outputRoot: output });
  const firstManifest = JSON.parse(await readFile(path.join(output, 'manifest.json'), 'utf8'));
  assert.equal(firstManifest.product, 'Nolane Agent');
  assert.equal(firstManifest.uiVersion, 3);
  assert.match(firstManifest.entry.html, /index\.[a-f0-9]{12}\.html$/);
  assert.match(firstManifest.entry.module, /app\.[a-f0-9]{12}\.mjs$/);
  assert.ok(Object.keys(firstManifest.modules).length >= 6);
  for (const item of Object.values(firstManifest.files)) {
    assert.match(item.sha256, /^[a-f0-9]{64}$/);
    assert.equal(/^https?:\/\//.test(item.path), false);
  }
  const second = await buildUiV3({ sourceRoot: path.resolve('ui-v3'), outputRoot: output });
  assert.equal(first.receiptSha256, second.receiptSha256);
  const outputs = await readdir(output, { recursive: true });
  assert.equal(outputs.some((name) => /\.map$/.test(name)), false);
});
