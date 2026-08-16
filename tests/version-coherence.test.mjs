import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { verifyVersionCoherence } from '../src/release/version-coherence.mjs';

async function write(root, relative, content) {
  const file = path.join(root, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}
async function json(root, relative, value) { await write(root, relative, `${JSON.stringify(value, null, 2)}\n`); }
async function fixture(t, { version = '0.0.0', packageVersion = version } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-version-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await json(root, 'config/release-identity.json', { schema:'nolane.agent.release-identity.v1', product:'Nolane Agent', version, channel:'stable', artifactPrefix:'NolaneAgent', vscodeArtifactPrefix:'NolaneAgent-VSCode' });
  await json(root, 'config/product-identity.json', { schema:'nolane.agent.product-identity.v1', product:'Nolane Agent', packageName:'nolane-agent', version, channel:'stable' });
  await json(root, 'package.json', { name:'nolane-agent', version:packageVersion });
  await json(root, 'extensions/vscode/extension/package.json', { name:'nolane-agent', version });
  await write(root, 'extensions/vscode/extension.vsixmanifest', `<PackageManifest Version="4.0.0"><Metadata><Identity Version="${version}" /></Metadata></PackageManifest>`);
  await json(root, 'sdk/typescript/package.json', { name:'@nolane/agent-sdk', version });
  await write(root, 'sdk/python/pyproject.toml', `[project]\nname = "nolane-agent-sdk"\nversion = "${version}"\n`);
  await write(root, 'README.md', `# Nolane Agent ${version}\n`);
  for (const relative of ['CHANGELOG.md','SECURITY.md','CONTRIBUTING.md','SUPPORT.md','docs/ARCHITECTURE.md','docs/DEVELOPMENT.md','docs/RELEASES.md','docs/PLATFORMS.md','docs/ROADMAP.md']) await write(root, relative, `# ${relative}\n`);
  return root;
}

test('version coherence accepts a complete Nolane Agent 0.0.x identity without generated source manifests', async (t) => {
  const root = await fixture(t, { version: '0.0.7' });
  const report = await verifyVersionCoherence({ rootDirectory: root });
  assert.equal(report.status, 'pass');
  assert.equal(report.version, '0.0.7');
  assert.ok(report.artifactNames.includes('NolaneAgent-0.0.7-source.zip'));
});

test('version coherence rejects versions outside the 0.0.x line', async (t) => {
  const root = await fixture(t, { version: '0.1.0' });
  await assert.rejects(() => verifyVersionCoherence({ rootDirectory: root }), (error) => {
    assert.equal(error.code, 'VERSION_COHERENCE_FAILED');
    assert.ok(error.failures.some((failure) => failure.id === 'version-policy'));
    return true;
  });
});

test('version coherence fails closed when a public version surface drifts', async (t) => {
  const root = await fixture(t, { version: '0.0.3', packageVersion: '0.0.2' });
  await assert.rejects(() => verifyVersionCoherence({ rootDirectory: root }), (error) => {
    assert.ok(error.failures.some((failure) => failure.id === 'package' && failure.expected === '0.0.3' && failure.actual === '0.0.2'));
    return true;
  });
});
