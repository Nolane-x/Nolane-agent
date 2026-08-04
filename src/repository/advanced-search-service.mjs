import { execFile } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { WorkspacePolicy } from '../security/path-policy.mjs';

const execFileAsync = promisify(execFile);
const KINDS = new Set(['import', 'todo', 'compiler', 'commit', 'time', 'diff', 'log', 'content']);
const SKIP = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.cache', '__pycache__']);
const LANGUAGE_EXTENSIONS = Object.freeze({
  javascript: ['.js', '.mjs', '.cjs', '.jsx'], typescript: ['.ts', '.mts', '.cts', '.tsx'], python: ['.py'],
  go: ['.go'], rust: ['.rs'], java: ['.java'], kotlin: ['.kt', '.kts'], c: ['.c', '.h'], cpp: ['.cpp', '.cc', '.cxx', '.hpp'],
  csharp: ['.cs'], json: ['.json'], yaml: ['.yaml', '.yml'], markdown: ['.md'], shell: ['.sh'], powershell: ['.ps1'],
});
const IMPORT = /^\s*(?:import\b|export\s+.+\s+from\b|(?:const|let|var)\s+.+?=\s*require\s*\(|from\s+\S+\s+import\b|use\s+\S+|#include\s*[<"])/;
const TODO = /\b(?:TODO|FIXME|HACK|XXX)\b/i;
const COMPILER = /(?:\berror\b.*\b(?:TS\d+|[A-Z]\d{3,}|CS\d+)|:\d+(?::\d+)?\s*(?:-|:)\s*error\b|\b(?:SyntaxError|TypeError|ReferenceError|Compilation failed)\b)/i;
const LOG_EXTENSIONS = new Set(['.log', '.out', '.trace']);

function coded(code, message) { const error = new Error(message); error.code = code; return error; }
function normalize(value) { return String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, ''); }
function safeLimit(value) { return Math.max(1, Math.min(1_000, Number(value) || 100)); }
function safeRegex(query, enabled) {
  const source = String(query ?? '');
  if (!source.trim() || source.length > 2_000) throw coded('ADVANCED_SEARCH_QUERY_INVALID', 'Search query must contain 1 to 2000 characters');
  try { return enabled ? new RegExp(source, 'i') : new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); }
  catch (error) { throw coded('ADVANCED_SEARCH_QUERY_INVALID', `Invalid search regular expression: ${error.message}`); }
}
function parseDate(value, label) {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw coded('ADVANCED_SEARCH_TIME_INVALID', `${label} must be a valid date`);
  return date;
}
function matchesFilters(relative, info, { extensions, directories, languageExtensions, since, until }) {
  const ext = path.extname(relative).toLowerCase();
  if (extensions.length && !extensions.includes(ext)) return false;
  if (languageExtensions && !languageExtensions.includes(ext)) return false;
  if (directories.length && !directories.some((directory) => relative === directory || relative.startsWith(`${directory}/`))) return false;
  if (since && info.mtime < since) return false;
  if (until && info.mtime > until) return false;
  return true;
}
function lineItem(kind, relative, line, text, matcher, extra = {}) {
  const match = text.match(matcher);
  if (!match) return null;
  return Object.freeze({ kind, path: relative, line, column: (match.index ?? 0) + 1, snippet: text.slice(0, 1_000), ...extra });
}

export class AdvancedSearchService {
  constructor({ workspaceRoot, allowedPaths = ['**'], deniedPaths = [], maxFileBytes = 2_000_000, maxFiles = 20_000, gitExecutable = 'git' } = {}) {
    if (!workspaceRoot) throw new TypeError('workspaceRoot is required');
    this.root = path.resolve(workspaceRoot);
    this.policy = new WorkspacePolicy(this.root, { allowedPaths, deniedPaths });
    this.maxFileBytes = Math.max(1_024, Number(maxFileBytes) || 2_000_000);
    this.maxFiles = Math.max(1, Number(maxFiles) || 20_000);
    this.gitExecutable = String(gitExecutable);
  }

  async #walk(relative = '.', output = []) {
    const absolute = await this.policy.resolveRead(relative);
    const entries = await readdir(absolute, { withFileTypes: true });
    for (const entry of entries) {
      if (output.length >= this.maxFiles) break;
      const child = normalize(path.posix.join(relative === '.' ? '' : relative, entry.name));
      if (entry.isDirectory()) {
        if (!SKIP.has(entry.name)) await this.#walk(child, output);
      } else if (entry.isFile()) output.push(child);
    }
    return output;
  }

  async #git(args, { allowFailure = false } = {}) {
    try {
      const result = await execFileAsync(this.gitExecutable, args, { cwd: this.root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, windowsHide: true, timeout: 20_000 });
      return { status: 'pass', stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
    } catch (error) {
      if (allowFailure) return { status: 'fail', stdout: String(error.stdout ?? ''), stderr: String(error.stderr ?? error.message ?? '') };
      throw coded('ADVANCED_SEARCH_GIT_FAILED', `Git search failed: ${String(error.stderr ?? error.message).slice(0, 500)}`);
    }
  }

  async #commits(matcher, limit) {
    const run = await this.#git(['log', `--max-count=${Math.min(limit, 200)}`, '--date=iso-strict', '--pretty=format:%H%x09%aI%x09%s'], { allowFailure: true });
    if (run.status !== 'pass') return [];
    return run.stdout.split(/\r?\n/).filter(Boolean).map((line) => {
      const [commit, authoredAt, ...subjectParts] = line.split('\t');
      const subject = subjectParts.join('\t');
      if (!matcher.test(`${commit} ${subject}`)) return null;
      return Object.freeze({ kind: 'commit', path: null, line: null, column: null, snippet: subject.slice(0, 1_000), commit, authoredAt });
    }).filter(Boolean);
  }

  async #diff(matcher, limit) {
    const run = await this.#git(['diff', '--no-ext-diff', '--unified=0', '--no-color'], { allowFailure: true });
    if (run.status !== 'pass') return [];
    const items = []; let currentPath = null; let currentLine = 0;
    for (const line of run.stdout.split(/\r?\n/)) {
      const file = line.match(/^\+\+\+ b\/(.+)$/); if (file) { currentPath = normalize(file[1]); continue; }
      const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)/); if (hunk) { currentLine = Number(hunk[1]); continue; }
      if (!currentPath || line.startsWith('+++')) continue;
      if (line.startsWith('+')) {
        const text = line.slice(1); const match = text.match(matcher);
        if (match) items.push(Object.freeze({ kind: 'diff', path: currentPath, line: currentLine, column: (match.index ?? 0) + 1, snippet: text.slice(0, 1_000) }));
        currentLine += 1;
      } else if (!line.startsWith('-')) currentLine += 1;
      if (items.length >= limit) break;
    }
    return items;
  }

  async search(input = {}) {
    const kinds = [...new Set((Array.isArray(input.kinds) && input.kinds.length ? input.kinds : ['content']).map(String))];
    const invalid = kinds.find((kind) => !KINDS.has(kind));
    if (invalid) throw coded('ADVANCED_SEARCH_KIND_INVALID', `Unsupported advanced-search kind: ${invalid}`);
    const matcher = safeRegex(input.query, input.regex === true);
    const limit = safeLimit(input.limit);
    const extensions = [...new Set((input.extensions ?? []).map((value) => { const ext = String(value).toLowerCase(); return ext.startsWith('.') ? ext : `.${ext}`; }))];
    const directories = [...new Set((input.directories ?? []).map(normalize).filter(Boolean))];
    for (const directory of directories) await this.policy.resolveRead(directory);
    const language = input.language ? String(input.language).toLowerCase() : null;
    const languageExtensions = language ? LANGUAGE_EXTENSIONS[language] : null;
    if (language && !languageExtensions) throw coded('ADVANCED_SEARCH_LANGUAGE_INVALID', `Unsupported language filter: ${language}`);
    const since = parseDate(input.since, 'since'); const until = parseDate(input.until, 'until');
    if (since && until && since > until) throw coded('ADVANCED_SEARCH_TIME_INVALID', 'since must not be after until');
    const filters = { extensions, directories, languageExtensions, since, until };
    const items = [];

    if (kinds.includes('commit') && items.length < limit) items.push(...await this.#commits(matcher, limit - items.length));
    if (kinds.includes('diff') && items.length < limit) {
      const diff = await this.#diff(matcher, limit - items.length);
      for (const item of diff) {
        const info = await stat(path.join(this.root, item.path)).catch(() => null);
        if (info && matchesFilters(item.path, info, filters)) items.push(item);
      }
    }

    const roots = directories.length ? directories : ['.'];
    const files = [];
    for (const root of roots) await this.#walk(root, files);
    for (const relative of [...new Set(files)].sort()) {
      if (items.length >= limit) break;
      const absolute = await this.policy.resolveRead(relative);
      const info = await stat(absolute);
      if (!matchesFilters(relative, info, filters) || info.size > this.maxFileBytes) continue;
      const buffer = await readFile(absolute); if (buffer.includes(0)) continue;
      const text = buffer.toString('utf8'); const lines = text.split(/\r?\n/); const ext = path.extname(relative).toLowerCase();
      for (let index = 0; index < lines.length && items.length < limit; index += 1) {
        const line = lines[index]; const number = index + 1;
        if (kinds.includes('import') && IMPORT.test(line)) { const item = lineItem('import', relative, number, line, matcher); if (item) items.push(item); }
        if (kinds.includes('todo') && TODO.test(line)) { const item = lineItem('todo', relative, number, line, matcher); if (item) items.push(item); }
        if (kinds.includes('compiler') && COMPILER.test(line)) { const item = lineItem('compiler', relative, number, line, matcher); if (item) items.push(item); }
        if (kinds.includes('log') && LOG_EXTENSIONS.has(ext)) { const item = lineItem('log', relative, number, line, matcher); if (item) items.push(item); }
        if (kinds.includes('content')) { const item = lineItem('content', relative, number, line, matcher); if (item) items.push(item); }
        if (kinds.includes('time') && matcher.test(relative)) items.push(Object.freeze({ kind: 'time', path: relative, line: null, column: null, snippet: info.mtime.toISOString(), modifiedAt: info.mtime.toISOString() }));
      }
    }
    const request = { kinds, query: String(input.query), regex: input.regex === true, extensions, directories, language, since: since?.toISOString() ?? null, until: until?.toISOString() ?? null, limit };
    return Object.freeze({ schema: 'forge.repository-advanced-search.v1', items: Object.freeze(items.slice(0, limit)), truncated: items.length >= limit, scannedFiles: Math.min(files.length, this.maxFiles), querySha256: canonicalSha256(request) });
  }
}
