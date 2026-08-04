import { readFile, access } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const STABLE_SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

async function text(root, relative) { return readFile(path.join(root, relative), 'utf8'); }
async function json(root, relative) { return JSON.parse(await text(root, relative)); }
function capture(source, expression, label) { const match = source.match(expression); if (!match) throw new Error(`Cannot read ${label}`); return match[1]; }

function validPrefix(value) { return /^[A-Za-z][A-Za-z0-9-]{2,63}$/.test(String(value ?? '')); }
function isNolaneIdentity(identity) { return identity?.schema === 'nolane.agent.release-identity.v1'; }
function componentVersion(identity) { return String(identity.components?.nolane_nativeReference ?? identity.components?.nolane_native ?? ''); }

function assertIdentity(identity) {
  const nolane = isNolaneIdentity(identity);
  if (!nolane && identity?.schema !== 'forge.studio.release-identity.v1') throw new Error('Release identity schema is invalid');
  if (nolane) {
    if (identity.product !== 'Nolane Agent') throw new Error('Release identity product is invalid');
    if (!SEMVER.test(String(identity.version ?? ''))) throw new Error('Nolane release identity version must be semantic version');
    if (!['alpha', 'beta', 'stable', 'nightly'].includes(String(identity.channel ?? ''))) throw new Error('Release identity channel is invalid');
    if (identity.channel === 'stable' && !STABLE_SEMVER.test(String(identity.version))) throw new Error('Stable Nolane release must use stable semantic version');
  } else {
    if (identity.product !== 'Forge Studio') throw new Error('Release identity product is invalid');
    if (!STABLE_SEMVER.test(String(identity.version ?? ''))) throw new Error('Release identity version must be stable semantic version');
    if (!['stable', 'beta', 'nightly'].includes(String(identity.channel ?? ''))) throw new Error('Release identity channel is invalid');
  }
  if (!validPrefix(identity.artifactPrefix)) throw new Error('Release artifact prefix is invalid');
  if (!validPrefix(identity.vscodeArtifactPrefix)) throw new Error('VS Code artifact prefix is invalid');
  const legacyExternalRuntimeVersion = componentVersion(identity);
  if (!nolane && !STABLE_SEMVER.test(legacyExternalRuntimeVersion)) throw new Error('Legacy external runtime component version must be stable semantic version');
  return Object.freeze({ ...identity, identityKind: nolane ? 'nolane' : 'legacy-forge', legacyExternalRuntimeVersion: nolane ? null : legacyExternalRuntimeVersion });
}

function check(failures, id, actual, expected) {
  if (String(actual) !== String(expected)) failures.push(Object.freeze({ id, expected: String(expected), actual: String(actual) }));
}

function pythonVersionFor(version) {
  const match = String(version).match(SEMVER);
  if (!match) return String(version);
  const base = `${match[1]}.${match[2]}.${match[3]}`;
  const pre = match[4];
  if (!pre) return base;
  const parts = pre.split('.');
  const label = parts[0].toLowerCase();
  const number = parts[1] ?? '0';
  if (label === 'alpha') return `${base}a${number}`;
  if (label === 'beta') return `${base}b${number}`;
  if (label === 'rc') return `${base}rc${number}`;
  return `${base}.dev0`;
}

export function releaseArtifactNames(identityInput) {
  const identity = assertIdentity(identityInput);
  const version = String(identity.version);
  const artifacts = [
    `${identity.artifactPrefix}-${version}-source.zip`,
    `${identity.artifactPrefix}-${version}-electron-windows-x64.zip`,
    `${identity.artifactPrefix}-${version}-update-payload.zip`,
    `${identity.vscodeArtifactPrefix}-${version}.vsix`,
  ];
  if (identity.identityKind === 'legacy-forge') artifacts.push(`${identity.artifactPrefix}-LegacyExternalRuntime-${identity.legacyExternalRuntimeVersion}.zip`);
  return Object.freeze(artifacts);
}

export async function verifyVersionCoherence({ rootDirectory = process.cwd() } = {}) {
  const root = path.resolve(rootDirectory);
  const identity = assertIdentity(await json(root, 'config/release-identity.json'));
  const version = String(identity.version);
  const failures = [];
  const nolane = identity.identityKind === 'nolane';

  const packageMetadata = await json(root, 'package.json');
  check(failures, 'package', packageMetadata.version, version);
  if (nolane) check(failures, 'package-name', packageMetadata.name, 'nolane-agent');

  const versionSource = await text(root, 'src/version.mjs');
  if (nolane) {
    const productIdentity = await json(root, 'config/product-identity.json');
    check(failures, 'product-identity-schema', productIdentity.schema, 'nolane.agent.product-identity.v1');
    check(failures, 'product-identity-product', productIdentity.product, identity.product);
    check(failures, 'product-identity-version', productIdentity.version, version);
    check(failures, 'product-identity-package', productIdentity.packageName, 'nolane-agent');
    if (!/PRODUCT_IDENTITY/.test(versionSource) || !/VERSION\s*=\s*PRODUCT_IDENTITY\.version/.test(versionSource)) {
      failures.push(Object.freeze({ id: 'runtime-version-source', expected: 'PRODUCT_IDENTITY-backed runtime version', actual: 'missing' }));
    }
  } else {
    check(failures, 'runtime-version', capture(versionSource, /export const VERSION = ['"]([^'"]+)['"];/, 'runtime VERSION'), version);
    check(failures, 'launcher-version', capture(versionSource, /export const LAUNCHER_VERSION = ['"]([^'"]+)['"];/, 'launcher VERSION'), version);
    check(failures, 'product-name', capture(versionSource, /export const PRODUCT_NAME = ['"]([^'"]+)['"];/, 'product name'), identity.product);
  }

  const vscodePackage = await json(root, 'extensions/vscode/extension/package.json');
  check(failures, 'vscode-package', vscodePackage.version, version);
  if (nolane) check(failures, 'vscode-display-name', vscodePackage.displayName, 'Nolane Agent');
  const vsixManifest = await text(root, 'extensions/vscode/extension.vsixmanifest');
  check(failures, 'vscode-manifest', capture(vsixManifest, /<Identity\b[^>]*\bVersion="([^"]+)"/, 'VSIX version'), version);

  if (!nolane) {
    const nolane_nativePack = await json(root, 'vendor/nolane_native-agent/NOLANE_NATIVE-PACK.json');
    check(failures, 'legacy-external-runtime-component-version', nolane_nativePack.version, identity.legacyExternalRuntimeVersion);
  }

  const typescriptSdk = await json(root, 'sdk/typescript/package.json');
  check(failures, 'typescript-sdk', typescriptSdk.version, version);
  if (nolane) check(failures, 'typescript-sdk-name', typescriptSdk.name, '@nolane/agent-sdk');
  const pythonMetadata = await text(root, 'sdk/python/pyproject.toml');
  check(failures, 'python-sdk', capture(pythonMetadata, /^version\s*=\s*"([^"]+)"/m, 'Python SDK version'), nolane ? pythonVersionFor(version) : version);
  if (nolane) check(failures, 'python-sdk-name', capture(pythonMetadata, /^name\s*=\s*"([^"]+)"/m, 'Python SDK name'), 'nolane-agent-sdk');

  const projectManifest = await json(root, 'project-manifest.json');
  check(failures, 'project-manifest', projectManifest.version, version);
  if (nolane) {
    check(failures, 'project-manifest-schema', projectManifest.schema, 'nolane.agent.project-manifest.v1');
    check(failures, 'project-manifest-product', projectManifest.product, 'Nolane Agent');
  }
  for (const entry of projectManifest.files ?? []) check(failures, `project-manifest-file:${entry.relativePath ?? '?'}`, entry.version, version);

  const readme = await text(root, 'README.md');
  const heading = `${identity.product} ${version}`;
  if (!readme.includes(heading)) failures.push(Object.freeze({ id: 'readme-heading', expected: heading, actual: readme.split('\n')[0] ?? '' }));

  const requiredDocs = [
    `docs/RELEASE-${version}.md`, `docs/LIMITATIONS-${version}.md`, `docs/VERIFICATION-REPORT-${version}.md`,
    `docs/FEATURE-COMPLETENESS-AUDIT-${version}.md`, `docs/feature-audit-${version}.json`, `docs/REMAINING-GAPS-${version}.md`,
  ];
  for (const relative of requiredDocs) { try { await access(path.join(root, relative)); } catch { failures.push(Object.freeze({ id: `required-doc:${relative}`, expected: 'present', actual: 'missing' })); } }
  for (const relative of [requiredDocs[0], requiredDocs[1], requiredDocs[2], requiredDocs[5]]) if (!readme.includes(relative)) failures.push(Object.freeze({ id: `readme-link:${relative}`, expected: 'linked', actual: 'missing' }));
  try { const audit = await json(root, `docs/feature-audit-${version}.json`); check(failures, 'feature-audit-version', audit.productVersion, version); } catch {}
  try {
    const limitations = await text(root, `docs/LIMITATIONS-${version}.md`);
    const auditReference = `docs/feature-audit-${version}.json`; const gapsReference = `docs/REMAINING-GAPS-${version}.md`;
    if (!limitations.includes(auditReference)) failures.push(Object.freeze({ id: 'limitations-audit-reference', expected: auditReference, actual: 'missing-or-stale' }));
    if (!limitations.includes(gapsReference)) failures.push(Object.freeze({ id: 'limitations-gaps-reference', expected: gapsReference, actual: 'missing-or-stale' }));
  } catch {}

  const artifactNames = releaseArtifactNames(identity);
  const reportBase = {
    schema: nolane ? 'nolane.agent.version-coherence.v1' : 'forge.studio.version-coherence.v1', product: identity.product, version,
    channel: identity.channel, status: failures.length === 0 ? 'pass' : 'fail', artifactNames,
    checkedSurfaces: Object.freeze(['release-identity', 'package', 'runtime', 'launcher', 'vscode', ...(nolane ? [] : ['nolane_native-component']), 'typescript-sdk', 'python-sdk', 'project-manifest', 'readme', 'release-docs', 'feature-audit', 'remaining-gaps', 'limitations-references', 'artifact-names']),
    failures: Object.freeze(failures),
  };
  const report = Object.freeze({ ...reportBase, receiptSha256: canonicalSha256(reportBase) });
  if (failures.length > 0) { const error = new Error(`Version coherence failed for ${failures.length} surface(s)`); error.code = 'VERSION_COHERENCE_FAILED'; error.failures = report.failures; error.report = report; throw error; }
  return report;
}
