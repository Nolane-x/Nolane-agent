import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { loadReleaseNaming, releaseArtifactNames } from '../src/release/release-naming.mjs';

test('Nolane Agent 0.0.0 release identity produces canonical stable artifact names', async () => {
  const naming = await loadReleaseNaming({ rootDirectory: path.resolve('.') });
  assert.equal(naming.product, 'Nolane Agent');
  assert.equal(naming.channel, 'stable');
  assert.equal(naming.manifestSchema, 'nolane.agent.release-manifest.v1');
  const names = releaseArtifactNames(naming, '0.0.0');
  assert.deepEqual(names, {
    sourceRoot: 'NolaneAgent-0.0.0-source',
    sourceArchive: 'NolaneAgent-0.0.0-source.zip',
    windowsRoot: 'NolaneAgent-0.0.0-electron-windows-x64',
    windowsArchive: 'NolaneAgent-0.0.0-electron-windows-x64.zip',
    updateArchive: 'NolaneAgent-0.0.0-update-payload.zip',
    vscodeArchive: 'NolaneAgent-VSCode-0.0.0.vsix',
    launcher: 'NolaneAgent.exe',
  });
});
