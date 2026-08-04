import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { PRODUCT_IDENTITY } from '../src/product-identity.mjs';
import { VERSION } from '../src/version.mjs';
const execFileAsync = promisify(execFile);

function required(condition, message) {
  if (!condition) throw new Error(message);
}

export async function validateVsCodeExtension({ root = 'extensions/vscode', expectedVersion = null } = {}) {
  const base = path.resolve(root);
  const packagePath = path.join(base, 'extension', 'package.json');
  const manifestPath = path.join(base, 'extension.vsixmanifest');
  const clientPath = path.join(base, 'extension', 'dist', 'client.js');
  const extensionPath = path.join(base, 'extension', 'dist', 'extension.js');
  const localWorktreePath = path.join(base, 'extension', 'dist', 'local-worktree.js');
  const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
  const activityIcon = pkg.contributes?.viewsContainers?.activitybar?.[0]?.icon;
  required(typeof activityIcon === 'string' && activityIcon.length > 0, 'VS Code extension activity icon is missing');
  const requiredFiles = [
    path.join(base, '[Content_Types].xml'), manifestPath, packagePath, clientPath, extensionPath, localWorktreePath,
    path.join(base, 'extension', activityIcon), path.join(base, 'extension', 'README.md'),
  ];
  for (const file of requiredFiles) await access(file);
  const manifest = await readFile(manifestPath, 'utf8');
  const client = await readFile(clientPath, 'utf8');
  const extension = await readFile(extensionPath, 'utf8');
  const localWorktree = await readFile(localWorktreePath, 'utf8');
  required(pkg.name === PRODUCT_IDENTITY.packageName, `Unexpected VS Code extension package name: expected ${PRODUCT_IDENTITY.packageName}, got ${pkg.name}`);
  required(pkg.displayName === PRODUCT_IDENTITY.product, `Unexpected VS Code extension display name: ${pkg.displayName}`);
  required(!expectedVersion || pkg.version === expectedVersion, `Expected VS Code extension ${expectedVersion}, got ${pkg.version}`);
  required(manifest.includes(`Version="${pkg.version}"`), 'VSIX manifest and extension package versions differ');
  required(pkg.main === './dist/extension.js', 'VS Code extension main must use the recovered compiled entry point');
  const commands = new Set((pkg.contributes?.commands ?? []).map((entry) => entry.command));
  for (const command of ['nolane.connect', 'nolane.runTask', 'nolane.pause', 'nolane.resume', 'nolane.stop', 'nolane.approve', 'nolane.reject', 'nolane.showDiff', 'nolane.showLogs', 'nolane.transferTaskLocal', 'nolane.openWorktree']) {
    required(commands.has(command), `Missing VS Code command: ${command}`);
  }
  const defaultUrl = pkg.contributes?.configuration?.properties?.['nolaneAgent.baseUrl']?.default;
  required(defaultUrl === 'http://127.0.0.1:8787', 'Default VS Code endpoint must be loopback');
  const httpsOrLoopbackEnforced = /requires HTTPS except for a loopback endpoint/i.test(client);
  const secretStorageUsed = /context\.secrets/.test(extension) && /(?:TOKEN_KEY\s*=\s*['"]nolaneAgent\.token['"]|secrets\.store\(TOKEN_KEY)/.test(client);
  required(httpsOrLoopbackEnforced, 'VS Code client does not enforce HTTPS or loopback transport');
  required(secretStorageUsed, 'VS Code client does not use SecretStorage for its bearer token');
  const safeLocalWorktreeOpen = /vscode\.openFolder/.test(localWorktree) && !/(?:child_process|execFile|spawn\()/.test(localWorktree);
  required(safeLocalWorktreeOpen, 'VS Code local worktree helper must open folders without shell execution');
  for (const file of [clientPath, extensionPath, localWorktreePath]) await execFileAsync(process.execPath, ['--check', file], { timeout: 30_000, windowsHide: true });
  return Object.freeze({
    schema: 'nolane.agent.vscode-validation.v1',
    product: PRODUCT_IDENTITY.product,
    version: pkg.version,
    protocolVersion: String(pkg.nolaneAgentProtocolVersion ?? ''),
    compiledJavaScriptFiles: 3,
    commands: commands.size,
    httpsOrLoopbackEnforced,
    secretStorageUsed,
    sourceAvailability: 'tracked-typescript-source',
    safeLocalWorktreeOpen,
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const report = await validateVsCodeExtension({ expectedVersion: process.argv[2] ?? VERSION });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
