import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const TEXT_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.md', '.mjs', '.svg', '.txt', '.ts', '.tsx', '.yaml', '.yml']);
const normalizePath = (value) => String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, '');
const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const item of Object.values(value)) deepFreeze(item);
  return Object.freeze(value);
};
const canonical = (value) => JSON.stringify(value, Object.keys(value).sort());
const sha256 = (value) => createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');

async function collectPath(root, relativePath) {
  const normalized = normalizePath(relativePath);
  const absolute = path.resolve(root, normalized);
  if (!absolute.startsWith(`${path.resolve(root)}${path.sep}`) && absolute !== path.resolve(root)) throw new Error(`Brand audit path escapes root: ${normalized}`);
  let info;
  try { info = await stat(absolute); } catch { return []; }
  if (info.isFile()) return TEXT_EXTENSIONS.has(path.extname(normalized).toLowerCase()) || path.basename(normalized) === 'README' ? [normalized] : [];
  if (!info.isDirectory()) return [];
  const output = [];
  for (const entry of await readdir(absolute, { withFileTypes: true })) {
    const child = normalizePath(path.join(normalized, entry.name));
    if (entry.isDirectory()) output.push(...await collectPath(root, child));
    else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) output.push(child);
  }
  return output.sort();
}

function lineForOffset(content, offset) {
  return content.slice(0, offset).split('\n').length;
}

export class BrandMigrationAuditor {
  constructor({ legacyNames = ['ForgeStudio', 'Forge Studio'] } = {}) {
    const names = [...new Set(legacyNames.map((value) => String(value).trim()).filter(Boolean))];
    if (!names.length) throw new TypeError('BrandMigrationAuditor requires at least one legacy name');
    this.legacyNames = Object.freeze(names);
  }

  async audit({ root, activePaths = [], allowedLegacyPaths = [] } = {}) {
    if (!root) throw new TypeError('Brand audit root is required');
    const allowed = new Set(allowedLegacyPaths.map(normalizePath));
    const files = [...new Set((await Promise.all(activePaths.map((item) => collectPath(root, item)))).flat())].sort();
    const findings = [];
    for (const relative of files) {
      if (allowed.has(relative)) continue;
      const content = await readFile(path.join(root, relative), 'utf8');
      for (const name of this.legacyNames) {
        let offset = content.indexOf(name);
        while (offset >= 0) {
          findings.push(Object.freeze({ path: relative, legacyName: name, line: lineForOffset(content, offset) }));
          offset = content.indexOf(name, offset + name.length);
        }
      }
    }
    findings.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.legacyName.localeCompare(b.legacyName));
    const base = {
      schema: 'nolane.brand-migration-audit.v1',
      product: 'Nolane Agent',
      complete: findings.length === 0,
      filesScanned: files.length,
      activePaths: Object.freeze([...activePaths].map(normalizePath).sort()),
      allowedLegacyPaths: Object.freeze([...allowed].sort()),
      findings: Object.freeze(findings),
    };
    return deepFreeze({ ...base, receiptSha256: sha256(base) });
  }
}

export async function auditCurrentBranding({ root } = {}) {
  const currentDocs = Object.freeze([
    'docs/NOLANE-AGENT-ONBOARDING.md',
    'docs/NOLANE-AGENT-EXAMPLES.md',
  ]);
  const screenshots = Object.freeze([
    'docs/screenshots/nolane-agent-ui-v3.svg',
    'docs/screenshots/nolane-agent-ui-v3.json',
  ]);
  const activePaths = [
    'package.json',
    'ui-v3',
    'desktop',
    'cli/nolane-agent.mjs',
    ...currentDocs,
    ...screenshots,
  ];
  const allowedLegacyPaths = Object.freeze([
    'cli/forge-studio.mjs',
  ]);
  const auditor = new BrandMigrationAuditor();
  const report = await auditor.audit({ root, activePaths, allowedLegacyPaths });
  const base = { ...report, currentDocs, screenshots };
  const { receiptSha256: _ignored, ...withoutReceipt } = base;
  return deepFreeze({ ...withoutReceipt, receiptSha256: sha256(withoutReceipt) });
}
