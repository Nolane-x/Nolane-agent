#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_TARGETS = Object.freeze([
  'desktop',
  'ui-v3',
  'ui',
  'extensions/vscode/src',
  'cli',
  'src/client',
  'sdk/typescript',
  'sdk/python/nolane_agent',
]);
const FILE_TARGETS = Object.freeze([
  'extensions/vscode/extension/package.json',
  'extensions/vscode/extension.vsixmanifest',
  'extensions/vscode/extension/README.md',
]);
const EXTENSIONS = new Set(['.cjs', '.js', '.mjs', '.ts', '.json', '.html', '.css', '.md', '.xml']);
const PATTERNS = Object.freeze([
  { id: 'legacy-product', expression: /ForgeStudio|Forge Studio/g },
  { id: 'legacy-brand-word', expression: /\bForge\b(?! OS)/g },
  { id: 'legacy-symbol', expression: /\bForgeStudio[A-Za-z0-9_]*/g },
  { id: 'legacy-command', expression: /['"`]forge\.[a-zA-Z0-9_.-]+['"`]/g },
  { id: 'legacy-config', expression: /\bforgeStudio(?:\.[a-zA-Z0-9_.-]+)?\b/g },
]);

async function walk(directory, output) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); } catch { return; }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.name === 'dist' || entry.name === 'node_modules' || entry.name.startsWith('legacy-migration.')) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(absolute, output);
    else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name))) output.push(absolute);
  }
}

export async function scanProductSurfaceLeakage({ projectRoot = process.cwd() } = {}) {
  const root = path.resolve(projectRoot);
  const files = [];
  for (const target of ROOT_TARGETS) await walk(path.join(root, target), files);
  for (const target of FILE_TARGETS) files.push(path.join(root, target));
  const legacyWrappers = new Set(['cli/forge-studio.mjs', 'src/client/forge-studio-client.mjs']);
  const unique = [...new Set(files)].filter((absolute) => !legacyWrappers.has(path.relative(root, absolute).replaceAll('\\', '/'))).sort();
  const violations = [];
  for (const absolute of unique) {
    let content;
    try { content = await readFile(absolute, 'utf8'); } catch { continue; }
    const lines = content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index++) {
      for (const pattern of PATTERNS) {
        pattern.expression.lastIndex = 0;
        const matches = [...lines[index].matchAll(pattern.expression)];
        for (const match of matches) violations.push({ file: path.relative(root, absolute).replaceAll('\\', '/'), line: index + 1, rule: pattern.id, match: match[0] });
      }
    }
  }
  return Object.freeze({ scannedFiles: unique.length, violations: Object.freeze(violations) });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  scanProductSurfaceLeakage().then((report) => {
    console.log(JSON.stringify(report, null, 2));
    if (report.violations.length) process.exitCode = 1;
  }).catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
}
