import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { stableForensicId } from '../stable-id.mjs';
import { extractJavaScriptSymbols } from './javascript-symbol-extractor.mjs';

const EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.jsx']);
const DEFAULT_EXCLUDES = new Set(['.git', '.worktrees', 'worktrees', 'node_modules', 'release', 'dist', 'ui-dist', 'requirements', 'docs', 'test', 'tests', 'vendor', '.cache']);

function freeze(value) {
  if (value && typeof value === 'object' && Object.isFrozen(value)) return value;
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) value[key] = freeze(entry);
    return Object.freeze(value);
  }
  return value;
}

async function walk(root, relative, files, excludes) {
  const absolute = path.join(root, relative);
  let value;
  try { value = await stat(absolute); } catch (error) { if (error?.code === 'ENOENT') return; throw error; }
  if (value.isFile()) {
    if (EXTENSIONS.has(path.extname(relative).toLowerCase())) files.push(relative.replaceAll('\\', '/'));
    return;
  }
  if (!value.isDirectory()) return;
  const name = path.basename(relative);
  if (relative && excludes.has(name)) return;
  const entries = await readdir(absolute, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    await walk(root, path.join(relative, entry.name), files, excludes);
  }
}

const VM_PARSER = String.raw`
const fs=require('fs'); const vm=require('vm');
const files=JSON.parse(fs.readFileSync(0,'utf8'));
const failures=[];
for (const file of files) {
  try { new vm.SourceTextModule(fs.readFileSync(file,'utf8'), { identifier:file }); }
  catch (error) { failures.push({ file, name:error.name, message:String(error.message).split('\n')[0] }); }
}
process.stdout.write(JSON.stringify(failures));
`;

async function syntaxFailures(root, relativePaths) {
  if (relativePaths.length === 0) return [];
  const absolutePaths = relativePaths.map((relativePath) => path.join(root, relativePath));
  const stdout = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--experimental-vm-modules', '-e', VM_PARSER], {
      cwd: root,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let output = '';
    let errorOutput = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { errorOutput += chunk; });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`Syntax validation worker failed with exit ${code}: ${errorOutput.trim()}`));
    });
    child.stdin.end(JSON.stringify(absolutePaths));
  });
  const raw = JSON.parse(stdout || '[]');
  return raw.map((failure) => ({ relativePath: path.relative(root, failure.file).replaceAll('\\', '/'), name: failure.name, message: failure.message })).sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export async function inventoryRepositorySymbols({ root = process.cwd(), include = ['src', 'ui', 'ui-v3', 'extensions', 'scripts'], exclude = [] } = {}) {
  const files = [];
  const excludes = new Set([...DEFAULT_EXCLUDES, ...exclude]);
  for (const item of include) await walk(root, item, files, excludes);
  files.sort();
  const parseFailures = await syntaxFailures(root, files);
  const failed = new Set(parseFailures.map((item) => item.relativePath));
  const fileRecords = [];
  const symbols = [];
  const surfaces = [];
  for (const relativePath of files) {
    const sourceText = await readFile(path.join(root, relativePath), 'utf8');
    const fileSha256 = createHash('sha256').update(sourceText).digest('hex');
    const lines = sourceText.length === 0 ? 0 : sourceText.split(/\r?\n/).length;
    fileRecords.push(Object.freeze({ schema: 'nolane.forensics.file.v1', id: stableForensicId('file', `${relativePath}:${fileSha256}`), relativePath, fileSha256, bytes: Buffer.byteLength(sourceText), lines, parseStatus: failed.has(relativePath) ? 'failed' : 'parsed', parserMode: 'node-vm-source-text-module+lexical-structural-v1' }));
    if (failed.has(relativePath)) continue;
    const extracted = extractJavaScriptSymbols({ sourceText, relativePath, fileSha256, parserMode: 'node-vm-source-text-module+lexical-structural-v1' });
    symbols.push(...extracted.symbols);
    surfaces.push(...extracted.surfaces);
  }
  symbols.sort((a, b) => a.id.localeCompare(b.id));
  surfaces.sort((a, b) => a.id.localeCompare(b.id));
  return freeze({
    schema: 'nolane.forensics.repository-symbol-inventory.v1',
    root: path.resolve(root),
    files: fileRecords,
    symbols,
    surfaces,
    parseFailures,
    summary: {
      files: fileRecords.length,
      parsedFiles: fileRecords.filter((item) => item.parseStatus === 'parsed').length,
      parseFailures: parseFailures.length,
      symbols: symbols.length,
      surfaces: surfaces.length,
      kinds: Object.fromEntries([...new Set([...symbols.map((item) => item.kind), ...surfaces.map((item) => item.kind)])].sort().map((kind) => [kind, symbols.filter((item) => item.kind === kind).length + surfaces.filter((item) => item.kind === kind).length])),
    },
  });
}
