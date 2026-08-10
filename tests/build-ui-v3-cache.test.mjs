import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { buildUiV3 } from '../scripts/build-ui-v3.mjs';

test('UI v3 fingerprints invalidate entry caches when a dependency changes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-ui-cache-'));
  const sourceRoot = path.join(root, 'ui-v3');
  const outputRoot = path.join(root, 'ui-dist');
  try {
    await mkdir(sourceRoot, { recursive: true });
    await writeFile(path.join(sourceRoot, 'index.html'), '<!doctype html><script type="module" src="./app.mjs"></script>');
    await writeFile(path.join(sourceRoot, 'app.mjs'), "import './dependency.mjs';\nexport const app = true;\n");
    await writeFile(path.join(sourceRoot, 'dependency.mjs'), "export const version = 'one';\n");
    await buildUiV3({ sourceRoot, outputRoot });
    const first = JSON.parse(await readFile(path.join(outputRoot, 'manifest.json'), 'utf8'));
    await writeFile(path.join(sourceRoot, 'dependency.mjs'), "export const version = 'two';\n");
    await buildUiV3({ sourceRoot, outputRoot });
    const second = JSON.parse(await readFile(path.join(outputRoot, 'manifest.json'), 'utf8'));
    assert.notEqual(first.entry.module, second.entry.module);
    assert.notEqual(first.modules['dependency.mjs'], second.modules['dependency.mjs']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
