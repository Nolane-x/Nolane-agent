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

test('UI v3 fingerprints are invariant to CRLF and LF source checkout line endings', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-ui-line-endings-'));
  const sourceRoot = path.join(root, 'ui-v3');
  const outputRoot = path.join(root, 'ui-dist');
  try {
    await mkdir(sourceRoot, { recursive: true });
    const sources = new Map([
      ['index.html', '<!doctype html>\n<script type="module" src="./app.mjs"></script>\n'],
      ['app.mjs', "import './dependency.mjs';\nexport const app = true;\n"],
      ['dependency.mjs', "export const version = 'one';\n"],
    ]);
    for (const [relative, source] of sources) await writeFile(path.join(sourceRoot, relative), source.replaceAll('\n', '\r\n'));
    await buildUiV3({ sourceRoot, outputRoot });
    const crlf = JSON.parse(await readFile(path.join(outputRoot, 'manifest.json'), 'utf8'));
    for (const [relative, source] of sources) await writeFile(path.join(sourceRoot, relative), source);
    await buildUiV3({ sourceRoot, outputRoot });
    const lf = JSON.parse(await readFile(path.join(outputRoot, 'manifest.json'), 'utf8'));
    assert.deepEqual(lf, crlf);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('UI v3 build rejects invalid JavaScript before replacing a prior distribution', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-ui-syntax-'));
  const sourceRoot = path.join(root, 'ui-v3');
  const outputRoot = path.join(root, 'ui-dist');
  try {
    await mkdir(sourceRoot, { recursive: true });
    await writeFile(path.join(sourceRoot, 'index.html'), '<!doctype html><script type="module" src="./app.mjs"></script>');
    await writeFile(path.join(sourceRoot, 'app.mjs'), 'export const ready = true;\n');
    await buildUiV3({ sourceRoot, outputRoot });
    const priorManifest = await readFile(path.join(outputRoot, 'manifest.json'), 'utf8');
    await writeFile(path.join(sourceRoot, 'app.mjs'), 'export const broken = ;\n');

    await assert.rejects(buildUiV3({ sourceRoot, outputRoot }), /UI v3 JavaScript syntax is invalid: app\.mjs/);
    assert.equal(await readFile(path.join(outputRoot, 'manifest.json'), 'utf8'), priorManifest);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
