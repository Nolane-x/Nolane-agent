import { readFile } from 'node:fs/promises';
import path from 'node:path';

const LEGACY = Object.freeze({
  product: 'Forge Studio', channel: 'stable', artifactPrefix: 'ForgeStudio', vscodeArtifactPrefix: 'ForgeStudio-VSCode',
  manifestSchema: 'forge.studio.release-manifest.v1', integritySchema: 'forge.studio.release-integrity.v1',
  optionalPackSchema: 'forge.studio.optional-pack.v1', launcher: 'ForgeStudio.exe', environmentPrefix: 'FORGE_STUDIO_',
});

function validatePrefix(value, label) {
  const result = String(value ?? '');
  if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(result)) throw new Error(`${label} is invalid`);
  return result;
}

export async function loadReleaseNaming({ rootDirectory = process.cwd() } = {}) {
  const root = path.resolve(rootDirectory);
  let identity;
  try { identity = JSON.parse(await readFile(path.join(root, 'config', 'release-identity.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return LEGACY; throw error; }
  const nolane = identity.schema === 'nolane.agent.release-identity.v1';
  const legacy = identity.schema === 'forge.studio.release-identity.v1';
  if (!nolane && !legacy) throw new Error('Unsupported release identity schema');
  const artifactPrefix = validatePrefix(identity.artifactPrefix, 'artifactPrefix');
  const vscodeArtifactPrefix = validatePrefix(identity.vscodeArtifactPrefix, 'vscodeArtifactPrefix');
  return Object.freeze({
    product: String(identity.product), channel: String(identity.channel), artifactPrefix, vscodeArtifactPrefix,
    manifestSchema: nolane ? 'nolane.agent.release-manifest.v1' : 'forge.studio.release-manifest.v1',
    integritySchema: nolane ? 'nolane.agent.release-integrity.v1' : 'forge.studio.release-integrity.v1',
    optionalPackSchema: nolane ? 'nolane.agent.optional-pack.v1' : 'forge.studio.optional-pack.v1',
    launcher: nolane ? 'NolaneAgent.exe' : 'ForgeStudio.exe',
    environmentPrefix: nolane ? 'NOLANE_AGENT_' : 'FORGE_STUDIO_',
  });
}

export function releaseArtifactNames(naming, version, legacyExternalRuntimeVersion = null) {
  const prefix = validatePrefix(naming.artifactPrefix, 'artifactPrefix');
  const vscode = validatePrefix(naming.vscodeArtifactPrefix, 'vscodeArtifactPrefix');
  const releaseVersion = String(version);
  const names = {
    sourceRoot: `${prefix}-${releaseVersion}-source`, sourceArchive: `${prefix}-${releaseVersion}-source.zip`,
    windowsRoot: `${prefix}-${releaseVersion}-electron-windows-x64`, windowsArchive: `${prefix}-${releaseVersion}-electron-windows-x64.zip`,
    updateArchive: `${prefix}-${releaseVersion}-update-payload.zip`, vscodeArchive: `${vscode}-${releaseVersion}.vsix`,
    launcher: naming.launcher,
  };
  if (naming.product === 'Forge Studio' && legacyExternalRuntimeVersion) {
    const componentVersion = String(legacyExternalRuntimeVersion);
    names.legacyExternalRuntimeRoot = `${prefix}-LegacyExternalRuntime-${componentVersion}`;
    names.legacyExternalRuntimeArchive = `${prefix}-LegacyExternalRuntime-${componentVersion}.zip`;
  }
  return Object.freeze(names);
}
