import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildUiV3 } from '../scripts/build-ui-v3.mjs';

test('UI v3 build publishes a stable root entry backed by hashed assets', async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'nolane-ui-v3-stable-'));
  await buildUiV3({ sourceRoot: path.resolve('ui-v3'), outputRoot: output });
  const manifest = JSON.parse(await readFile(path.join(output, 'manifest.json'), 'utf8'));
  const stable = await readFile(path.join(output, 'index.html'), 'utf8');
  const hashed = await readFile(path.join(output, manifest.entry.html), 'utf8');
  assert.equal(manifest.entry.stableHtml, 'index.html');
  assert.equal(stable, hashed);
  assert.match(stable, new RegExp(manifest.entry.module.replaceAll('.', '\\.')));
  assert.match(stable, new RegExp(manifest.entry.stylesheet.replaceAll('.', '\\.')));
});
