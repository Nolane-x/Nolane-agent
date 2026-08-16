import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const PATCH_LINE = /^0\.0\.(0|[1-9]\d*)$/;
async function text(root, relative) { return readFile(path.join(root, relative), 'utf8'); }
async function json(root, relative) { return JSON.parse(await text(root, relative)); }
function capture(source, expression, label) { const match = source.match(expression); if (!match) throw new Error(`Cannot read ${label}`); return match[1]; }
function check(failures, id, actual, expected) { if (String(actual) !== String(expected)) failures.push(Object.freeze({ id, expected: String(expected), actual: String(actual) })); }

export function releaseArtifactNames(identity) {
  const version = String(identity.version);
  return Object.freeze([
    `NolaneAgent-${version}-source.zip`, `NolaneAgent-Setup-${version}-x64.exe`, `NolaneAgent-${version}-x64.dmg`,
    `NolaneAgent-${version}-x64.zip`, `NolaneAgent-${version}-x64.AppImage`, `NolaneAgent-${version}-x64.deb`,
    `NolaneAgent-VSCode-${version}.vsix`, 'RELEASE-MANIFEST.json', 'SHA256SUMS',
  ]);
}

export async function verifyVersionCoherence({ rootDirectory = process.cwd() } = {}) {
  const root = path.resolve(rootDirectory); const identity = await json(root, 'config/release-identity.json'); const failures = [];
  if (identity.schema !== 'nolane.agent.release-identity.v1') failures.push({ id: 'release-identity-schema', expected: 'nolane.agent.release-identity.v1', actual: identity.schema });
  if (identity.product !== 'Nolane Agent') failures.push({ id: 'release-product', expected: 'Nolane Agent', actual: identity.product });
  if (!PATCH_LINE.test(String(identity.version ?? ''))) failures.push({ id: 'version-policy', expected: '0.0.N', actual: identity.version });
  check(failures, 'channel', identity.channel, 'stable'); const version = String(identity.version);
  const pkg = await json(root, 'package.json'); const product = await json(root, 'config/product-identity.json');
  const vscode = await json(root, 'extensions/vscode/extension/package.json'); const tsSdk = await json(root, 'sdk/typescript/package.json');
  const python = await text(root, 'sdk/python/pyproject.toml'); const vsix = await text(root, 'extensions/vscode/extension.vsixmanifest');
  check(failures, 'package', pkg.version, version); check(failures, 'package-name', pkg.name, 'nolane-agent');
  check(failures, 'product-identity', product.version, version); check(failures, 'product-channel', product.channel, 'stable');
  check(failures, 'vscode-package', vscode.version, version); check(failures, 'typescript-sdk', tsSdk.version, version);
  check(failures, 'python-sdk', capture(python, /^version\s*=\s*"([^"]+)"/m, 'Python SDK version'), version);
  check(failures, 'vscode-manifest', capture(vsix, /<Identity\b[^>]*\bVersion="([^"]+)"/, 'VSIX version'), version);
  const readme = await text(root, 'README.md');
  if (!readme.includes(`# Nolane Agent ${version}`)) failures.push({ id: 'readme-heading', expected: `# Nolane Agent ${version}`, actual: readme.split('\n')[0] ?? '' });
  for (const relative of ['CHANGELOG.md','SECURITY.md','CONTRIBUTING.md','SUPPORT.md','docs/ARCHITECTURE.md','docs/DEVELOPMENT.md','docs/RELEASES.md','docs/PLATFORMS.md','docs/ROADMAP.md']) {
    try { await access(path.join(root, relative)); } catch { failures.push({ id: `required-doc:${relative}`, expected: 'present', actual: 'missing' }); }
  }
  try { const manifest = await json(root, 'project-manifest.json'); check(failures, 'project-manifest', manifest.version, version); }
  catch { failures.push({ id: 'project-manifest', expected: version, actual: 'missing' }); }
  const base = Object.freeze({ schema:'nolane.agent.version-coherence.v2', product:'Nolane Agent', version, channel:identity.channel, status:failures.length?'fail':'pass', artifactNames:releaseArtifactNames(identity), failures:Object.freeze(failures) });
  const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  if (failures.length) { const error = new Error(`Version coherence failed for ${failures.length} surface(s)`); error.code='VERSION_COHERENCE_FAILED'; error.report=report; error.failures=report.failures; throw error; }
  return report;
}
