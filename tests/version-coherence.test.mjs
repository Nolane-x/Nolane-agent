import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { verifyVersionCoherence } from '../src/release/version-coherence.mjs';

async function write(root, relative, content) {
  const file = path.join(root, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}

async function coherentFixture(root, version = '1.0.0') {
  await write(root, 'config/release-identity.json', JSON.stringify({ schema: 'forge.studio.release-identity.v1', product: 'Forge Studio', version, channel: 'stable', artifactPrefix: 'ForgeStudio', vscodeArtifactPrefix: 'ForgeStudio-VSCode', components: { nolane_native: '2.29.0' } }));
  await write(root, 'package.json', JSON.stringify({ name: 'forge-studio', version }));
  await write(root, 'src/version.mjs', `export const PRODUCT_NAME = 'Forge Studio';\nexport const VERSION = '${version}';\nexport const LAUNCHER_VERSION = '${version}';\n`);
  await write(root, 'extensions/vscode/extension/package.json', JSON.stringify({ version }));
  await write(root, 'extensions/vscode/extension.vsixmanifest', `<PackageManifest><Metadata><Identity Version="${version}" /></Metadata></PackageManifest>`);
  await write(root, 'vendor/nolane_native-agent/NOLANE_NATIVE-PACK.json', JSON.stringify({ version: '2.29.0' }));
  await write(root, 'sdk/typescript/package.json', JSON.stringify({ version }));
  await write(root, 'sdk/python/pyproject.toml', `[project]\nversion = "${version}"\n`);
  await write(root, 'project-manifest.json', JSON.stringify({ schema: 'forge.studio.project-manifest.v1', product: 'Forge Studio', version, files: [{ relativePath: 'package.json', version }] }));
  await write(root, 'README.md', `# Forge Studio ${version} — Adaptive Coding-Agent Platform\n\nSee docs/RELEASE-${version}.md, docs/LIMITATIONS-${version}.md, docs/VERIFICATION-REPORT-${version}.md, and docs/REMAINING-GAPS-${version}.md.\n`);
  await write(root, `docs/RELEASE-${version}.md`, `# Forge Studio ${version} release notes\n`);
  await write(root, `docs/LIMITATIONS-${version}.md`, `# Forge Studio ${version} — remaining limits\n\nThe item-level source of truth is \`docs/feature-audit-${version}.json\`. The exhaustive open-item report is \`docs/REMAINING-GAPS-${version}.md\`.\n`);
  await write(root, `docs/VERIFICATION-REPORT-${version}.md`, `# Forge Studio ${version} verification contract\n`);
  await write(root, `docs/FEATURE-COMPLETENESS-AUDIT-${version}.md`, `# Forge Studio ${version} — audit\n`);
  await write(root, `docs/feature-audit-${version}.json`, JSON.stringify({ productVersion: version }));
  await write(root, `docs/REMAINING-GAPS-${version}.md`, `# Forge Studio ${version} remaining gaps\n`);
}


async function coherentNolaneFixture(root, version = '5.0.0-alpha.2') {
  await write(root, 'config/release-identity.json', JSON.stringify({ schema: 'nolane.agent.release-identity.v1', product: 'Nolane Agent', version, channel: 'alpha', artifactPrefix: 'NolaneAgent', vscodeArtifactPrefix: 'NolaneAgent-VSCode', components: {} }));
  await write(root, 'config/product-identity.json', JSON.stringify({ schema: 'nolane.agent.product-identity.v1', product: 'Nolane Agent', packageName: 'nolane-agent', version, channel: 'alpha', artifactPrefix: 'NolaneAgent', vscodeArtifactPrefix: 'NolaneAgent-VSCode', environmentPrefix: 'NOLANE_AGENT_', canonicalCore: 'Nolane Agent Core', legacyProductNames: ['Forge Studio'], components: {} }));
  await write(root, 'package.json', JSON.stringify({ name: 'nolane-agent', version }));
  await write(root, 'src/version.mjs', "import { PRODUCT_IDENTITY } from './product-identity.mjs';\nexport const PRODUCT_NAME = PRODUCT_IDENTITY.product;\nexport const VERSION = PRODUCT_IDENTITY.version;\nexport const LAUNCHER_VERSION = PRODUCT_IDENTITY.version;\n");
  await write(root, 'src/product-identity.mjs', "export const PRODUCT_IDENTITY = {};\n");
  await write(root, 'extensions/vscode/extension/package.json', JSON.stringify({ name: 'nolane-agent', displayName: 'Nolane Agent', version }));
  await write(root, 'extensions/vscode/extension.vsixmanifest', `<PackageManifest><Metadata><Identity Version="${version}" /></Metadata></PackageManifest>`);
  await write(root, 'sdk/typescript/package.json', JSON.stringify({ name: '@nolane/agent-sdk', version }));
  await write(root, 'sdk/python/pyproject.toml', `[project]\nname = "nolane-agent-sdk"\nversion = "5.0.0a2"\n`);
  await write(root, 'project-manifest.json', JSON.stringify({ schema: 'nolane.agent.project-manifest.v1', product: 'Nolane Agent', version, files: [{ relativePath: 'package.json', version }] }));
  await write(root, 'README.md', `# Nolane Agent ${version} — Development Snapshot\n\nSee docs/RELEASE-${version}.md, docs/LIMITATIONS-${version}.md, docs/VERIFICATION-REPORT-${version}.md, and docs/REMAINING-GAPS-${version}.md.\n`);
  await write(root, `docs/RELEASE-${version}.md`, `# Nolane Agent ${version} release notes\n`);
  await write(root, `docs/LIMITATIONS-${version}.md`, `# Nolane Agent ${version} — remaining limits\n\nThe item-level source of truth is \`docs/feature-audit-${version}.json\`. The exhaustive open-item report is \`docs/REMAINING-GAPS-${version}.md\`.\n`);
  await write(root, `docs/VERIFICATION-REPORT-${version}.md`, `# Nolane Agent ${version} verification contract\n`);
  await write(root, `docs/FEATURE-COMPLETENESS-AUDIT-${version}.md`, `# Nolane Agent ${version} — audit\n`);
  await write(root, `docs/feature-audit-${version}.json`, JSON.stringify({ productVersion: version }));
  await write(root, `docs/REMAINING-GAPS-${version}.md`, `# Nolane Agent ${version} remaining gaps\n`);
}

test('version coherence accepts a complete Forge Studio 1.0.0 identity', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-version-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await coherentFixture(root);
  const report = await verifyVersionCoherence({ rootDirectory: root });
  assert.equal(report.status, 'pass');
  assert.equal(report.version, '1.0.0');
  assert.deepEqual(report.artifactNames, [
    'ForgeStudio-1.0.0-source.zip',
    'ForgeStudio-1.0.0-electron-windows-x64.zip',
    'ForgeStudio-1.0.0-update-payload.zip',
    'ForgeStudio-VSCode-1.0.0.vsix',
    'ForgeStudio-LegacyExternalRuntime-2.29.0.zip',
  ]);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
});


test('version coherence accepts Nolane Agent prerelease identity without rewriting legacy fixtures', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-version-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await coherentNolaneFixture(root);
  const report = await verifyVersionCoherence({ rootDirectory: root });
  assert.equal(report.status, 'pass');
  assert.equal(report.product, 'Nolane Agent');
  assert.deepEqual(report.artifactNames, [
    'NolaneAgent-5.0.0-alpha.2-source.zip',
    'NolaneAgent-5.0.0-alpha.2-electron-windows-x64.zip',
    'NolaneAgent-5.0.0-alpha.2-update-payload.zip',
    'NolaneAgent-VSCode-5.0.0-alpha.2.vsix',
  ]);
});

test('version coherence fails closed when any public surface drifts', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-version-drift-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await coherentFixture(root);
  await write(root, 'extensions/vscode/extension/package.json', JSON.stringify({ version: '1.0.1' }));
  await assert.rejects(
    () => verifyVersionCoherence({ rootDirectory: root }),
    (error) => error.code === 'VERSION_COHERENCE_FAILED' && error.failures.some((failure) => failure.id === 'vscode-package'),
  );
});


test('version coherence rejects stale audit and remaining-gap references inside the current limitations document', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-version-limitations-drift-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await coherentFixture(root);
  await write(root, 'docs/LIMITATIONS-1.0.0.md', '# Forge Studio 1.0.0 — remaining limits\n\nThe item-level source of truth is `docs/feature-audit-0.9.0.json`. The exhaustive open-item report is `docs/REMAINING-GAPS-0.9.0.md`.\n');
  await assert.rejects(
    () => verifyVersionCoherence({ rootDirectory: root }),
    (error) => error.code === 'VERSION_COHERENCE_FAILED'
      && error.failures.some((failure) => failure.id === 'limitations-audit-reference')
      && error.failures.some((failure) => failure.id === 'limitations-gaps-reference'),
  );
});

test('the checked-in release identity matches the configured release source of truth', async () => {
  const identity = JSON.parse(await readFile('config/release-identity.json', 'utf8'));
  const report = await verifyVersionCoherence({ rootDirectory: process.cwd() });
  assert.equal(report.version, identity.version);
  assert.equal(report.status, 'pass');
});
