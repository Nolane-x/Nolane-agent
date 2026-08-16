import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const json = async (relative) => JSON.parse(await readFile(path.join(root, relative), 'utf8'));
const text = async (relative) => readFile(path.join(root, relative), 'utf8');
const missing = async (relative) => {
  try { await access(path.join(root, relative)); return false; } catch { return true; }
};

test('0.0.0 is the single canonical public version across product surfaces', async () => {
  const pkg = await json('package.json');
  const product = await json('config/product-identity.json');
  const release = await json('config/release-identity.json');
  const vscode = await json('extensions/vscode/extension/package.json');
  const sdk = await json('sdk/typescript/package.json');
  assert.equal(pkg.version, '0.0.0');
  assert.equal(product.version, '0.0.0');
  assert.equal(release.version, '0.0.0');
  assert.equal(release.channel, 'stable');
  assert.equal(vscode.version, '0.0.0');
  assert.equal(sdk.version, '0.0.0');
  assert.match(await text('sdk/python/pyproject.toml'), /^version = "0\.0\.0"$/m);
  assert.match(await text('README.md'), /^# Nolane Agent 0\.0\.0$/m);
});

test('0.0.0 source tree does not ship historical or generated process residue', async () => {
  for (const relative of ['checkpoints', 'recovered-artifacts', '.superpowers', 'requirements', 'models', 'MILESTONE-VERIFICATION-MANIFEST.json', 'project-manifest.json', 'docs/checkpoints', 'docs/product-perfection', 'docs/superpowers']) {
    assert.equal(await missing(relative), true, `${relative} must not ship in the clean baseline`);
  }
  const readme = await text('README.md');
  assert.doesNotMatch(readme, /Product Perfection|Task 1[0-3]|checkpoint/i);
});

test('release configuration targets the canonical repository and publishes 0.0.x from main exactly once', async () => {
  const builder = await text('electron-builder.config.cjs');
  const workflow = await text('.github/workflows/release.yml');
  const update = await json('config/update.example.json');
  assert.match(builder, /Nolane-x\/Nolane-agent/);
  assert.equal(update.repository, 'Nolane-x/Nolane-agent');
  assert.equal(update.channel, 'stable');
  assert.match(workflow, /branches:\s*\[main\]/);
  assert.match(workflow, /tag="v\$\{version\}"/);
  assert.match(workflow, /\^v0\\\.0\\\.\[0-9\]\+\$/);
  assert.doesNotMatch(workflow, /tags:\s*\n/);
  assert.match(workflow, /SHA256SUMS/);
  assert.doesNotMatch(workflow, /product-perfection|external-gate-evidence|checkpoint/i);
});
