import { chmod, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { WorkspacePolicy } from '../security/path-policy.mjs';

const GENERATED = /(?:^|\/)(?:dist|build|generated|gen|vendor|node_modules)(?:\/|$)|(?:\.generated\.|\.g\.)/i;

function maskCode(source) {
  const chars = [...source];
  let state = 'code';
  let escaped = false;
  for (let index = 0; index < chars.length; index += 1) {
    const current = chars[index];
    const next = chars[index + 1];
    if (state === 'line') {
      if (current === '\n') state = 'code'; else chars[index] = ' ';
      continue;
    }
    if (state === 'block') {
      if (current === '*' && next === '/') { chars[index] = ' '; chars[index + 1] = ' '; index += 1; state = 'code'; }
      else if (current !== '\n') chars[index] = ' ';
      continue;
    }
    if (['single', 'double', 'template'].includes(state)) {
      if (escaped) { if (current !== '\n') chars[index] = ' '; escaped = false; continue; }
      if (current === '\\') { chars[index] = ' '; escaped = true; continue; }
      const quote = state === 'single' ? "'" : state === 'double' ? '"' : '`';
      if (current === quote) { chars[index] = ' '; state = 'code'; }
      else if (current !== '\n') chars[index] = ' ';
      continue;
    }
    if (current === '/' && next === '/') { chars[index] = ' '; chars[index + 1] = ' '; index += 1; state = 'line'; continue; }
    if (current === '/' && next === '*') { chars[index] = ' '; chars[index + 1] = ' '; index += 1; state = 'block'; continue; }
    if (current === "'") { chars[index] = ' '; state = 'single'; continue; }
    if (current === '"') { chars[index] = ' '; state = 'double'; continue; }
    if (current === '`') { chars[index] = ' '; state = 'template'; }
  }
  return chars.join('');
}

function matchingBrace(masked, open) {
  let depth = 0;
  for (let index = open; index < masked.length; index += 1) {
    if (masked[index] === '{') depth += 1;
    else if (masked[index] === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  throw new Error('Symbol body has an unmatched opening brace');
}

function lineOf(source, offset) { return source.slice(0, Math.max(0, offset)).split('\n').length; }
function lineEnd(masked, start) { const semi = masked.indexOf(';', start); const newline = masked.indexOf('\n', start); if (semi >= 0 && (newline < 0 || semi < newline)) return semi + 1; return newline < 0 ? masked.length : newline; }

function scanJavascript(source) {
  const masked = maskCode(source);
  const patterns = [
    { kind: 'function', re: /(^|\n)[ \t]*(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g, brace: true },
    { kind: 'class', re: /(^|\n)[ \t]*(?:export\s+(?:default\s+)?)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)\b/g, brace: true },
    { kind: 'interface', re: /(^|\n)[ \t]*(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)\b/g, brace: true },
    { kind: 'enum', re: /(^|\n)[ \t]*(?:export\s+)?(?:const\s+)?enum\s+([A-Za-z_$][\w$]*)\b/g, brace: true },
    { kind: 'type', re: /(^|\n)[ \t]*(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\s*=/g, brace: false },
    { kind: 'function', re: /(^|\n)[ \t]*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^\n)]*\)|[A-Za-z_$][\w$]*)\s*=>/g, brace: 'optional' },
  ];
  const found = [];
  for (const pattern of patterns) {
    for (const match of masked.matchAll(pattern.re)) {
      const start = match.index + match[1].length;
      let end;
      const open = masked.indexOf('{', match.index + match[0].length);
      if (pattern.brace === true) {
        if (open < 0) continue;
        end = matchingBrace(masked, open) + 1;
      } else if (pattern.brace === 'optional' && open >= 0 && open < lineEnd(masked, match.index + match[0].length)) end = matchingBrace(masked, open) + 1;
      else end = lineEnd(masked, match.index + match[0].length);
      if (masked[end] === ';') end += 1;
      found.push({ kind: pattern.kind, name: match[2], startOffset: start, endOffset: end, startLine: lineOf(source, start), endLine: lineOf(source, Math.max(start, end - 1)) });
    }
  }
  return found.sort((left, right) => left.startOffset - right.startOffset || left.endOffset - right.endOffset);
}

function scanPython(source) {
  const lines = source.split(/(?<=\n)/);
  const found = [];
  let offset = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(\s*)(?:async\s+)?(def|class)\s+([A-Za-z_]\w*)\b/);
    if (!match) { offset += lines[index].length; continue; }
    const indent = match[1].replace(/\t/g, '    ').length;
    let endIndex = index + 1;
    let endOffset = offset + lines[index].length;
    for (; endIndex < lines.length; endIndex += 1) {
      const line = lines[endIndex];
      if (!line.trim()) { endOffset += line.length; continue; }
      const nextIndent = (line.match(/^\s*/)?.[0] ?? '').replace(/\t/g, '    ').length;
      if (nextIndent <= indent) break;
      endOffset += line.length;
    }
    found.push({ kind: match[2] === 'def' ? 'function' : 'class', name: match[3], startOffset: offset, endOffset, startLine: index + 1, endLine: Math.max(index + 1, endIndex) });
    offset += lines[index].length;
  }
  return found;
}

function scan(source, extension) { return extension === '.py' ? scanPython(source) : scanJavascript(source); }
function selected(symbols, name, kind) {
  const matches = symbols.filter((item) => item.name === String(name) && (!kind || item.kind === String(kind)));
  if (!matches.length) throw Object.assign(new Error(`Symbol not found: ${name}`), { code: 'SYMBOL_NOT_FOUND' });
  if (matches.length > 1) throw Object.assign(new Error(`Symbol is ambiguous: ${name}`), { code: 'SYMBOL_AMBIGUOUS' });
  return matches[0];
}

export class SymbolEditService {
  constructor({ workspaceRoot, allowedPaths = ['**'], deniedPaths = [] } = {}) { this.policy = new WorkspacePolicy(workspaceRoot, { allowedPaths, deniedPaths }); }

  async #load(relativePath) {
    const file = await this.policy.resolveRead(relativePath);
    const buffer = await readFile(file);
    if (buffer.includes(0)) throw new Error('Symbol operations only support UTF-8 text files');
    const source = buffer.toString('utf8');
    return { file, path: this.policy.relative(file), source, sha256: canonicalSha256(source), mode: (await stat(file)).mode & 0o777, symbols: scan(source, path.extname(file).toLowerCase()) };
  }

  async list({ path: relativePath, query = '' } = {}) {
    const loaded = await this.#load(relativePath);
    const needle = String(query).toLowerCase();
    return Object.freeze(loaded.symbols.filter((item) => !needle || item.name.toLowerCase().includes(needle)).map((item) => Object.freeze({ ...item, path: loaded.path })));
  }

  async read({ path: relativePath, symbol, kind } = {}) {
    const loaded = await this.#load(relativePath);
    const item = selected(loaded.symbols, symbol, kind);
    return Object.freeze({ ...item, path: loaded.path, content: loaded.source.slice(item.startOffset, item.endOffset), fileSha256: loaded.sha256 });
  }

  async #mutate(operation, input) {
    const loaded = await this.#load(input.path);
    if (GENERATED.test(loaded.path)) throw Object.assign(new Error(`Generated code cannot be edited: ${loaded.path}`), { code: 'GENERATED_CODE_DENIED' });
    if (input.expectedSha256 !== undefined && String(input.expectedSha256) !== loaded.sha256) throw Object.assign(new Error(`File hash mismatch: expected ${input.expectedSha256}, got ${loaded.sha256}`), { code: 'STALE_SYMBOL_EDIT' });
    const item = selected(loaded.symbols, input.symbol, input.kind);
    const content = String(input.content ?? '');
    let after;
    if (operation === 'replace') after = loaded.source.slice(0, item.startOffset) + content + loaded.source.slice(item.endOffset);
    else if (operation === 'insert-before') after = loaded.source.slice(0, item.startOffset) + content + loaded.source.slice(item.startOffset);
    else if (operation === 'insert-after') after = loaded.source.slice(0, item.endOffset) + content + loaded.source.slice(item.endOffset);
    else throw new TypeError(`Unsupported symbol operation: ${operation}`);
    const destination = await this.policy.resolveWrite(loaded.path);
    const temp = path.join(path.dirname(destination), `.${path.basename(destination)}.${process.pid}.${randomUUID()}.tmp`);
    await mkdir(path.dirname(destination), { recursive: true });
    try { await writeFile(temp, after, { flag: 'wx' }); await chmod(temp, loaded.mode); await rename(temp, destination); }
    finally { await rm(temp, { force: true }).catch(() => {}); }
    const base = { schema: 'forge.symbol-edit.v1', operation, path: loaded.path, symbol: item.name, kind: item.kind, startLine: item.startLine, endLine: item.endLine, beforeSha256: loaded.sha256, afterSha256: canonicalSha256(after) };
    return Object.freeze({ ...base, operationSha256: canonicalSha256(base) });
  }

  replace(input) { return this.#mutate('replace', input); }
  insertBefore(input) { return this.#mutate('insert-before', input); }
  insertAfter(input) { return this.#mutate('insert-after', input); }
}
