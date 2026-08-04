import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { loadReleaseNaming, releaseArtifactNames } from '../src/release/release-naming.mjs';

test('Nolane release identity produces canonical artifact, root and schema names', async () => {
  const naming = await loadReleaseNaming({ rootDirectory: path.resolve('.') });
  assert.equal(naming.product, 'Nolane Agent');
  assert.equal(naming.channel, 'beta');
  assert.equal(naming.manifestSchema, 'nolane.agent.release-manifest.v1');
  const names = releaseArtifactNames(naming, '5.0.0-beta.1');
  assert.deepEqual(names, {
    sourceRoot: 'NolaneAgent-5.0.0-beta.1-source',
    sourceArchive: 'NolaneAgent-5.0.0-beta.1-source.zip',
    windowsRoot: 'NolaneAgent-5.0.0-beta.1-electron-windows-x64',
    windowsArchive: 'NolaneAgent-5.0.0-beta.1-electron-windows-x64.zip',
    updateArchive: 'NolaneAgent-5.0.0-beta.1-update-payload.zip',
    vscodeArchive: 'NolaneAgent-VSCode-5.0.0-beta.1.vsix',
    launcher: 'NolaneAgent.exe',
  });
});

test('legacy release identity remains readable without rewriting historical artifact names', () => {
  const naming = Object.freeze({ product: 'Forge Studio', channel: 'stable', artifactPrefix: 'ForgeStudio', vscodeArtifactPrefix: 'ForgeStudio-VSCode', manifestSchema: 'forge.studio.release-manifest.v1', integritySchema: 'forge.studio.release-integrity.v1', optionalPackSchema: 'forge.studio.optional-pack.v1', launcher: 'ForgeStudio.exe' });
  const names = releaseArtifactNames(naming, '1.0.0', '2.29.0');
  assert.equal(names.sourceArchive, 'ForgeStudio-1.0.0-source.zip');
  assert.equal(names.legacyExternalRuntimeArchive, 'ForgeStudio-LegacyExternalRuntime-2.29.0.zip');
  assert.equal(names.launcher, 'ForgeStudio.exe');
});
