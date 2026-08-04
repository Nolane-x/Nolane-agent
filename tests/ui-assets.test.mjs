import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { UiAssetInstaller, parseTar } from '../src/assets/ui-asset-installer.mjs';

function tarEntry(name, body, { type = '0', mode = 0o644 } = {}) {
  const content = Buffer.from(body);
  const header = Buffer.alloc(512, 0);
  header.write(name, 0, 100, 'utf8');
  header.write(mode.toString(8).padStart(7, '0') + '\0', 100, 8, 'ascii');
  header.write('0000000\0', 108, 8, 'ascii');
  header.write('0000000\0', 116, 8, 'ascii');
  header.write(content.length.toString(8).padStart(11, '0') + '\0', 124, 12, 'ascii');
  header.write(Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0', 136, 12, 'ascii');
  header.fill(0x20, 148, 156);
  header.write(type, 156, 1, 'ascii');
  header.write('ustar\0', 257, 6, 'ascii');
  header.write('00', 263, 2, 'ascii');
  let sum = 0; for (const byte of header) sum += byte;
  header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
  const padding = Buffer.alloc((512 - (content.length % 512)) % 512, 0);
  return Buffer.concat([header, content, padding]);
}
function tgz(entries) { return gzipSync(Buffer.concat([...entries.map(([name, body, options]) => tarEntry(name, body, options)), Buffer.alloc(1024)])); }
function sri(buffer) { return `sha512-${createHash('sha512').update(buffer).digest('base64')}`; }

const packages = [
  {
    id: 'xterm', version: '6.0.0', url: 'https://registry.npmjs.org/@xterm/xterm/-/xterm-6.0.0.tgz',
    files: [
      { from: 'package/lib/xterm.mjs', to: 'xterm/xterm.mjs' },
      { from: 'package/css/xterm.css', to: 'xterm/xterm.css' },
    ],
  },
  {
    id: 'monaco', version: '0.55.1', url: 'https://registry.npmjs.org/monaco-editor/-/monaco-editor-0.55.1.tgz',
    includePrefix: 'package/min/vs/', stripPrefix: 'package/min/', toPrefix: 'monaco/',
  },
];

test('parseTar yields bounded regular files and rejects traversal and links', () => {
  const archive = Buffer.concat([tarEntry('package/lib/a.js', 'ok'), Buffer.alloc(1024)]);
  assert.deepEqual([...parseTar(archive)].map((entry) => [entry.path, entry.data.toString()]), [['package/lib/a.js', 'ok']]);
  assert.throws(() => [...parseTar(Buffer.concat([tarEntry('../escape', 'bad'), Buffer.alloc(1024)]))], /unsafe tar path/i);
  assert.throws(() => [...parseTar(Buffer.concat([tarEntry('package/link', 'x', { type: '2' }), Buffer.alloc(1024)]))], /unsupported tar entry/i);
});

test('UiAssetInstaller verifies SRI, extracts only pinned production assets, and writes an immutable manifest', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-ui-assets-')); t.after(() => rm(root, { recursive: true, force: true }));
  const xterm = tgz([
    ['package/lib/xterm.mjs', 'export const Terminal = 1;'],
    ['package/css/xterm.css', '.xterm{}'],
    ['package/lib/xterm.mjs.map', 'not-copied'],
  ]);
  const monaco = tgz([
    ['package/min/vs/loader.js', 'loader'],
    ['package/min/vs/editor/editor.main.js', 'editor'],
    ['package/min/vs/editor/editor.main.js.map', 'not-copied'],
    ['package/esm/vs/editor/editor.api.js', 'not-copied'],
  ]);
  const bodies = new Map([[packages[0].url, xterm], [packages[1].url, monaco]]);
  const installer = new UiAssetInstaller({
    root,
    packages: packages.map((item, index) => ({ ...item, integrity: sri(index === 0 ? xterm : monaco) })),
    fetchImpl: async (url) => new Response(bodies.get(url), { status: 200, headers: { 'content-length': String(bodies.get(url).length) } }),
  });
  const result = await installer.install();
  assert.equal(result.ready, true);
  assert.equal(await readFile(path.join(root, 'xterm/xterm.mjs'), 'utf8'), 'export const Terminal = 1;');
  assert.equal(await readFile(path.join(root, 'monaco/vs/loader.js'), 'utf8'), 'loader');
  await assert.rejects(() => stat(path.join(root, 'monaco/vs/editor/editor.main.js.map')), /ENOENT/);
  const manifest = JSON.parse(await readFile(path.join(root, 'asset-manifest.json'), 'utf8'));
  assert.equal(manifest.schema, 'forge.studio.ui-assets.v1');
  assert.deepEqual(manifest.packages.map((item) => item.id), ['xterm', 'monaco']);
  assert.ok(manifest.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256)));
  assert.equal((await installer.status()).ready, true);
  const newerInstaller = new UiAssetInstaller({
    root,
    packages: [
      { ...packages[0], version: '6.0.1', integrity: sri(xterm) },
      { ...packages[1], integrity: sri(monaco) },
    ],
    fetchImpl: async () => { throw new Error('not needed'); },
  });
  assert.deepEqual(await newerInstaller.status(), { ready: false, reason: 'asset-version', package: 'xterm' });
  await writeFile(path.join(root, 'xterm/xterm.mjs'), 'export const Terminal = 2;');
  assert.equal((await installer.status()).ready, false);
});

test('UiAssetInstaller fails closed on integrity mismatch, oversize, insecure URL, and partial install', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-ui-assets-fail-')); t.after(() => rm(root, { recursive: true, force: true }));
  const body = tgz([['package/lib/xterm.mjs', 'x']]);
  const base = { root, packages: [{ ...packages[0], integrity: 'sha512-AAAA' }], fetchImpl: async () => new Response(body, { status: 200 }) };
  await assert.rejects(() => new UiAssetInstaller(base).install(), /integrity/i);
  await assert.rejects(() => new UiAssetInstaller({ ...base, packages: [{ ...base.packages[0], url: 'http://example.test/x.tgz' }] }).install(), /https/i);
  await assert.rejects(() => new UiAssetInstaller({ ...base, maxPackageBytes: 8, packages: [{ ...base.packages[0], integrity: sri(body) }] }).install(), /too large/i);
  assert.equal((await new UiAssetInstaller(base).status()).ready, false);
});
