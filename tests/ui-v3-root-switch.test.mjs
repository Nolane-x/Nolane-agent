import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveUiRoot } from '../src/ui/ui-root-resolver.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

test('production v3 selection fails closed when ui-dist is missing', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-ui-root-'));
  await mkdir(path.join(root, 'ui'));
  assert.throws(() => resolveUiRoot({ appRoot: root, requestedVersion: 'v3', production: true }), /ui-dist/);
});

test('development can fall back to legacy UI but reports the fallback', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-ui-root-'));
  await mkdir(path.join(root, 'ui'));
  const result = resolveUiRoot({ appRoot: root, requestedVersion: 'v3', production: false });
  assert.equal(result.version, 'v2');
  assert.equal(result.fallback, true);
  assert.equal(result.root, path.join(root, 'ui'));
});

test('production root serves a receipt-bound home module that submits registered provider IDs', async () => {
  const selected = resolveUiRoot({ appRoot: projectRoot, requestedVersion: 'v3', production: true });
  assert.equal(selected.root, path.join(projectRoot, 'ui-dist'));

  const manifest = JSON.parse(await readFile(path.join(selected.root, 'manifest.json'), 'utf8'));
  const release = JSON.parse(await readFile(path.join(selected.root, 'source-release.json'), 'utf8'));
  const homeModule = manifest.modules['views/home/home-view.mjs'];
  const homeBuffer = await readFile(path.join(selected.root, homeModule));
  const canonicalHomeBuffer = Buffer.from(homeBuffer.toString('utf8').replaceAll('\r\n', '\n'));
  const { receiptSha256: manifestReceipt, ...manifestBase } = manifest;
  const { receiptSha256: releaseReceipt, ...releaseBase } = release;

  assert.equal(sha256(JSON.stringify(manifestBase)), manifestReceipt);
  assert.equal(sha256(JSON.stringify(releaseBase)), releaseReceipt);
  assert.equal(release.manifestReceiptSha256, manifestReceipt);
  assert.equal(canonicalHomeBuffer.length, manifest.files[homeModule].bytes);
  assert.equal(sha256(canonicalHomeBuffer), manifest.files[homeModule].sha256);

  const servedHome = await import(pathToFileURL(path.join(selected.root, homeModule)).href);
  const html = servedHome.renderHomeView(servedHome.buildHomeViewModel({
    models: [{ key: 'codex/cli-selected', providerId: 'codex', displayName: 'Codex CLI' }],
  }));
  assert.match(html, /<strong>Codex CLI<\/strong><small>codex · cli-selected<\/small>/);
  assert.match(html, /data-picker-value="codex\/cli-selected"/);
  assert.doesNotMatch(html, /<select\b/);
});

test('startup only creates a CLI-selected fallback when a provider has no exact model profile', async () => {
  const app = await readFile(path.join(projectRoot, 'src', 'app.mjs'), 'utf8');

  assert.match(app, /const hasExactModel = providerProfiles\.some\(\(profile\) => profile\.providerId === connection\.id\);/);
  assert.match(app, /!hasExactModel && \(connection\.kind === 'cli' \|\| connection\.kind === 'codex-app-server'\) \? 'cli-selected' : null/);
});
