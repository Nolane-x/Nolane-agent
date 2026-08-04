import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { WorkspacePolicy } from './path-policy.mjs';

const SCRIPT_PATTERNS = Object.freeze([
  { type: 'download-pipe-shell', severity: 'critical', expression: /\b(?:curl|wget)\b[^\n|]{0,500}\|\s*(?:sh|bash|zsh|powershell|pwsh)\b/i },
  { type: 'encoded-powershell', severity: 'critical', expression: /\b(?:powershell|pwsh)(?:\.exe)?\b[^\n]{0,300}\s-(?:enc|encodedcommand)\b/i },
  { type: 'dynamic-shell-eval', severity: 'high', expression: /\b(?:Invoke-Expression|\beval\s*\(|child_process\.(?:exec|execSync)\s*\()/i },
  { type: 'credential-harvesting-pattern', severity: 'high', expression: /(?:\.ssh[\\/]id_(?:rsa|ed25519)|\.aws[\\/]credentials|Login Data|Cookies)[^\n]{0,300}(?:upload|fetch|curl|request)/i },
]);

function executableType(buffer) {
  if (buffer.length >= 4 && buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) return 'elf';
  if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) return 'pe';
  if (buffer.length >= 4) {
    const magic = buffer.readUInt32BE(0);
    if ([0xfeedface, 0xfeedfacf, 0xcafebabe, 0xcefaedfe, 0xcffaedfe].includes(magic)) return 'mach-o';
  }
  return null;
}

function safeFinding(value) { return Object.freeze({ type: value.type, severity: value.severity, path: value.path, detail: value.detail }); }
function report(schema, payload) {
  const base = { schema, generatedAt: new Date().toISOString(), ...payload };
  return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
}

export class ArtifactSecurityScanner {
  constructor({ workspaceRoot, allowedPaths = ['**'], deniedPaths = ['.env', '.env.*', '**/*.pem', '**/*.key'], deniedSha256 = [], allowedRegistryHosts = ['registry.npmjs.org'], maxFiles = 10_000, maxTotalBytes = 1_000_000_000, maxFileBytes = 100_000_000, textScanBytes = 1_000_000 } = {}) {
    this.policy = new WorkspacePolicy(workspaceRoot, { allowedPaths, deniedPaths });
    this.deniedSha256 = new Set(deniedSha256.map((value) => String(value).toLowerCase()));
    this.allowedRegistryHosts = new Set(allowedRegistryHosts.map((value) => String(value).toLowerCase()));
    this.maxFiles = Number(maxFiles); this.maxTotalBytes = Number(maxTotalBytes); this.maxFileBytes = Number(maxFileBytes); this.textScanBytes = Number(textScanBytes);
    if (![this.maxFiles, this.maxTotalBytes, this.maxFileBytes, this.textScanBytes].every((value) => Number.isInteger(value) && value > 0)) throw new TypeError('Artifact security scanner limits must be positive integers');
  }

  async #collect(relative, output) {
    const absolute = await this.policy.resolveRead(relative);
    const info = await lstat(absolute);
    if (info.isSymbolicLink()) throw new Error(`Artifact path contains a symlink: ${relative}`);
    if (info.isDirectory()) {
      for (const entry of await readdir(absolute, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) throw new Error(`Artifact path contains a symlink: ${path.posix.join(relative.replaceAll('\\', '/'), entry.name)}`);
        await this.#collect(path.join(relative, entry.name), output);
      }
      return;
    }
    if (!info.isFile()) throw new Error(`Unsupported artifact entry: ${relative}`);
    if (info.size > this.maxFileBytes) throw new Error(`Artifact file exceeds ${this.maxFileBytes} bytes: ${relative}`);
    output.push({ absolute, relative: this.policy.relative(absolute).replaceAll('\\', '/'), bytes: info.size });
    if (output.length > this.maxFiles) throw new Error(`Artifact scan exceeds ${this.maxFiles} files`);
    if (output.reduce((sum, item) => sum + item.bytes, 0) > this.maxTotalBytes) throw new Error(`Artifact scan exceeds ${this.maxTotalBytes} total bytes`);
  }

  async scanArtifacts({ paths, allowExecutables = false } = {}) {
    if (!Array.isArray(paths) || paths.length === 0 || paths.some((item) => typeof item !== 'string')) throw new TypeError('Artifact paths are required');
    const files = [];
    for (const relative of [...new Set(paths)]) await this.#collect(relative, files);
    files.sort((left, right) => left.relative.localeCompare(right.relative));
    const findings = [];
    const manifest = [];
    for (const file of files) {
      const content = await readFile(file.absolute);
      const digest = createHash('sha256').update(content).digest('hex');
      manifest.push({ path: file.relative, bytes: file.bytes, sha256: digest });
      if (this.deniedSha256.has(digest)) findings.push(safeFinding({ type: 'denied-content-hash', severity: 'critical', path: file.relative, detail: digest.slice(0, 16) }));
      const executable = executableType(content.subarray(0, 16));
      if (executable && !allowExecutables) findings.push(safeFinding({ type: 'unexpected-executable', severity: 'critical', path: file.relative, detail: executable }));
      const sample = content.subarray(0, this.textScanBytes).toString('utf8');
      if (!sample.includes('\u0000')) {
        for (const pattern of SCRIPT_PATTERNS) if (pattern.expression.test(sample)) findings.push(safeFinding({ type: pattern.type, severity: pattern.severity, path: file.relative, detail: 'matched bounded static rule' }));
      }
    }
    return report('forge.artifact-security-scan.v1', {
      status: findings.some((item) => item.severity === 'critical' || item.severity === 'high') ? 'blocked' : 'pass',
      filesScanned: files.length, totalBytes: files.reduce((sum, item) => sum + item.bytes, 0),
      allowExecutables: allowExecutables === true, findings: Object.freeze(findings), manifestSha256: canonicalSha256(manifest),
    });
  }

  async scanDependencies({ lockfilePath = 'package-lock.json' } = {}) {
    const absolute = await this.policy.resolveRead(lockfilePath);
    const raw = await readFile(absolute, 'utf8');
    if (Buffer.byteLength(raw) > this.maxFileBytes) throw new Error('Dependency lockfile is too large');
    const lock = JSON.parse(raw);
    if (![2, 3].includes(Number(lock.lockfileVersion)) || !lock.packages || typeof lock.packages !== 'object' || Array.isArray(lock.packages)) throw new Error('Only npm package-lock v2/v3 is supported');
    const findings = [];
    const dependencies = [];
    for (const [name, entry] of Object.entries(lock.packages)) {
      if (!name || !entry || typeof entry !== 'object' || entry.link === true) continue;
      const resolved = String(entry.resolved ?? '');
      const integrity = String(entry.integrity ?? '');
      dependencies.push({ name, version: String(entry.version ?? ''), resolved, integrity: integrity ? createHash('sha256').update(integrity).digest('hex') : null, hasInstallScript: entry.hasInstallScript === true });
      if (resolved) {
        if (/^(?:git\+|git:|file:|link:|workspace:)/i.test(resolved)) findings.push(safeFinding({ type: 'non-registry-dependency-source', severity: 'critical', path: name, detail: resolved.split(':')[0] }));
        else {
          let url;
          try { url = new URL(resolved); } catch { findings.push(safeFinding({ type: 'invalid-dependency-source', severity: 'critical', path: name, detail: 'unparseable URL' })); }
          if (url) {
            if (url.protocol !== 'https:') findings.push(safeFinding({ type: 'insecure-dependency-transport', severity: 'critical', path: name, detail: url.protocol }));
            if (!this.allowedRegistryHosts.has(url.hostname.toLowerCase())) findings.push(safeFinding({ type: 'unapproved-dependency-registry', severity: 'critical', path: name, detail: url.hostname }));
            if (url.username || url.password) findings.push(safeFinding({ type: 'dependency-url-credential', severity: 'critical', path: name, detail: 'embedded credentials' }));
          }
        }
        if (!/^sha(?:256|384|512)-[A-Za-z0-9+/=_-]+$/.test(integrity)) findings.push(safeFinding({ type: 'missing-dependency-integrity', severity: 'critical', path: name, detail: 'SRI sha256/384/512 required' }));
      }
      if (entry.hasInstallScript === true) findings.push(safeFinding({ type: 'dependency-install-script', severity: 'high', path: name, detail: 'lifecycle script requires explicit review' }));
      if (dependencies.length > this.maxFiles) throw new Error(`Dependency scan exceeds ${this.maxFiles} packages`);
    }
    return report('forge.dependency-security-scan.v1', {
      status: findings.some((item) => item.severity === 'critical' || item.severity === 'high') ? 'blocked' : 'pass',
      lockfilePath: this.policy.relative(absolute).replaceAll('\\', '/'), packageCount: dependencies.length,
      findings: Object.freeze(findings), dependencyManifestSha256: canonicalSha256(dependencies),
    });
  }
}
