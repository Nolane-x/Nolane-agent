import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const INCLUDED_ROOTS = Object.freeze(['src', 'tests', 'ui-v3', 'scripts']);
const INCLUDED_FILES = Object.freeze(['package.json']);
const IGNORED = new Set(['node_modules', '.git', 'release', 'ui-dist']);

async function walk(root, relative = '') {
  const directory = path.join(root, relative);
  const entries = await readdir(directory, { withFileTypes: true });
  const output = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (IGNORED.has(entry.name)) continue;
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) output.push(...await walk(root, child));
    else if (entry.isFile()) output.push(child.replaceAll(path.sep, '/'));
  }
  return output;
}

export async function checkpoint12SourceFingerprint(rootDirectory = process.cwd()) {
  const root = path.resolve(rootDirectory);
  const files = [...INCLUDED_FILES];
  for (const folder of INCLUDED_ROOTS) {
    const children = await walk(path.join(root, folder));
    files.push(...children.map((item) => `${folder}/${item}`));
  }
  files.sort();
  const digest = createHash('sha256');
  for (const relative of files) {
    const bytes = await readFile(path.join(root, relative));
    const fileHash = createHash('sha256').update(bytes).digest('hex');
    digest.update(relative); digest.update('\0'); digest.update(fileHash); digest.update('\n');
  }
  return Object.freeze({ schema: 'nolane.checkpoint-12.source-fingerprint.v1', sha256: digest.digest('hex'), files: files.length, roots: [...INCLUDED_ROOTS], generatedAt: new Date().toISOString() });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) process.stdout.write(`${JSON.stringify(await checkpoint12SourceFingerprint(process.argv[2] ?? process.cwd()), null, 2)}\n`);
