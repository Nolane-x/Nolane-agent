import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const ROOT_FILES = new Set(['AGENTS.md', 'CLAUDE.md', 'FORGE.md']);
const SKIP_DIRECTORIES = new Set(['.git', 'node_modules', 'vendor', 'release', 'dist', '.forgeos-data', '.worktrees']);
const SCOPES = new Set(['global', 'repository', 'directory', 'language', 'task']);
const SECRET_NAMES = /(^|\/)(\.env(?:\..*)?|credentials?\.json|secrets?\.(?:json|ya?ml)|[^/]+\.(?:pem|key|p12|pfx))$/i;

function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function normalizedRelative(value) { return String(value).replaceAll('\\', '/').replace(/^\.\//, ''); }
function issue(code, message, field = null) { return Object.freeze({ code, message, field }); }
function cleanGlobs(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 64);
  const text = String(value ?? '').trim(); if (!text) return [];
  const inner = text.startsWith('[') && text.endsWith(']') ? text.slice(1, -1) : text;
  return inner.split(',').map((item) => item.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean).slice(0, 64);
}
function parseList(value) {
  if (Array.isArray(value)) return { value: value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 64), valid: true };
  const text = String(value ?? '').trim();
  if (!text) return { value: [], valid: true };
  if (!(text.startsWith('[') && text.endsWith(']'))) return { value: [], valid: false };
  return { value: cleanGlobs(text), valid: true };
}
function parseScalar(value) {
  const text = String(value ?? '').trim();
  if (/^true$/i.test(text)) return { value: true, valid: true };
  if (/^false$/i.test(text)) return { value: false, valid: true };
  if (/^null$/i.test(text)) return { value: null, valid: true };
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text)) return { value: Number(text), valid: true };
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) return { value: text.slice(1, -1), valid: true };
  if (text.startsWith('[') || text.startsWith('{')) return { value: null, valid: false };
  return { value: text, valid: Boolean(text) };
}

export function parseInstructionDocument(content, { defaultScope = 'repository', sourcePath = '' } = {}) {
  const text = String(content).replaceAll('\r\n', '\n');
  let metadataLines = [];
  let body = text;
  const issues = [];
  if (text.startsWith('---\n')) {
    const end = text.indexOf('\n---\n', 4);
    if (end < 0) issues.push(issue('INSTRUCTION_FRONTMATTER_UNTERMINATED', 'Instruction frontmatter is not terminated', 'frontmatter'));
    else {
      metadataLines = text.slice(4, end).split('\n');
      body = text.slice(end + 5);
    }
  }
  const metadata = {};
  const rules = {};
  let section = null;
  for (const rawLine of metadataLines) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith('#')) continue;
    const indented = /^\s+/.test(rawLine);
    const line = rawLine.trim();
    const at = line.indexOf(':');
    if (at < 1) { issues.push(issue('INSTRUCTION_FRONTMATTER_LINE_INVALID', `Invalid frontmatter line in ${sourcePath || 'instruction'}`, 'frontmatter')); continue; }
    const key = line.slice(0, at).trim();
    const rawValue = line.slice(at + 1).trim();
    if (indented && section === 'rules') {
      const parsed = parseScalar(rawValue);
      if (!parsed.valid) issues.push(issue('INSTRUCTION_RULE_VALUE_INVALID', `Rule ${key} must be a scalar value`, `rules.${key}`));
      else rules[key] = parsed.value;
      continue;
    }
    section = rawValue === '' ? key : null;
    if (key === 'rules') {
      if (rawValue) {
        try {
          const parsed = JSON.parse(rawValue);
          if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('rules must be an object');
          for (const [ruleKey, ruleValue] of Object.entries(parsed)) {
            if (ruleValue !== null && !['string', 'number', 'boolean'].includes(typeof ruleValue)) throw new Error(`rule ${ruleKey} must be scalar`);
            rules[ruleKey] = ruleValue;
          }
        } catch { issues.push(issue('INSTRUCTION_RULES_INVALID', 'rules must be an indented scalar mapping or JSON object', 'rules')); }
      }
      continue;
    }
    metadata[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }

  let scope = String(metadata.scope ?? defaultScope).trim().toLowerCase();
  if (!SCOPES.has(scope)) { issues.push(issue('INSTRUCTION_SCOPE_INVALID', `Unsupported instruction scope: ${scope}`, 'scope')); scope = defaultScope; }
  let priority = Number(metadata.priority ?? 0);
  if (!Number.isInteger(priority) || priority < -1000 || priority > 1000) { issues.push(issue('INSTRUCTION_PRIORITY_INVALID', 'priority must be an integer from -1000 through 1000', 'priority')); priority = 0; }
  const languagesParsed = parseList(metadata.languages);
  const tasksParsed = parseList(metadata.tasks);
  const importsParsed = parseList(metadata.imports);
  if (metadata.languages !== undefined && !languagesParsed.valid) issues.push(issue('INSTRUCTION_LANGUAGES_INVALID', 'languages must be a bounded list', 'languages'));
  if (metadata.tasks !== undefined && !tasksParsed.valid) issues.push(issue('INSTRUCTION_TASKS_INVALID', 'tasks must be a bounded list', 'tasks'));
  if (metadata.imports !== undefined && !importsParsed.valid) issues.push(issue('INSTRUCTION_IMPORTS_INVALID', 'imports must be a bounded list of relative paths', 'imports'));
  const globs = cleanGlobs(metadata.globs);
  return Object.freeze({
    metadata: Object.freeze({ ...metadata }),
    body,
    scope,
    priority,
    languages: Object.freeze(languagesParsed.value.map((item) => item.toLowerCase())),
    tasks: Object.freeze(tasksParsed.value.map((item) => item.toLowerCase())),
    imports: Object.freeze(importsParsed.value.map(normalizedRelative)),
    rules: Object.freeze({ ...rules }),
    globs: Object.freeze(globs),
    alwaysApply: /^true$/i.test(String(metadata.alwaysApply ?? '')) || !globs.length,
    issues: Object.freeze(issues),
    valid: issues.length === 0,
  });
}

function escapeRegex(value) { return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&'); }
function globRegex(glob) {
  const normalized = normalizedRelative(glob); let source = '^';
  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    if (char === '*') { if (normalized[i + 1] === '*') { i += 1; if (normalized[i + 1] === '/') { i += 1; source += '(?:.*/)?'; } else source += '.*'; } else source += '[^/]*'; }
    else if (char === '?') source += '[^/]'; else source += escapeRegex(char);
  }
  return new RegExp(`${source}$`);
}
export function instructionMatches(record, paths) {
  if (record.alwaysApply || !record.globs.length || record.globs.includes('**')) return true;
  const compiled = record.globs.map(globRegex);
  return paths.some((item) => compiled.some((regex) => regex.test(normalizedRelative(item))));
}

export async function safeInstructionRead(root, relative, maxBytes = 64 * 1024) {
  const normalized = normalizedRelative(relative);
  if (!normalized || path.isAbsolute(normalized) || normalized.split('/').includes('..') || SECRET_NAMES.test(normalized)) return Object.freeze({ file: null, reason: 'import-path-outside-root' });
  const absolute = path.resolve(root, normalized);
  const rel = path.relative(path.resolve(root), absolute);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return Object.freeze({ file: null, reason: 'import-path-outside-root' });
  let info;
  try { info = await lstat(absolute); } catch (error) { if (error?.code === 'ENOENT') return Object.freeze({ file: null, reason: 'instruction-file-missing' }); throw error; }
  if (info.isSymbolicLink()) return Object.freeze({ file: null, reason: 'instruction-symlink-rejected' });
  if (!info.isFile()) return Object.freeze({ file: null, reason: 'instruction-not-file' });
  if (info.size > maxBytes) return Object.freeze({ file: null, reason: 'instruction-file-too-large' });
  return Object.freeze({ file: Object.freeze({ relative: normalized, content: await readFile(absolute, 'utf8'), modifiedAt: info.mtime.toISOString(), bytes: info.size }), reason: null });
}

function defaultScopeFor(relative, fallback) {
  if (fallback === 'global') return 'global';
  const normalized = normalizedRelative(relative);
  if (ROOT_FILES.has(path.posix.basename(normalized)) && path.posix.dirname(normalized) !== '.') return 'directory';
  return fallback || 'repository';
}
function sourceName(relative) {
  if (relative.startsWith('.cursor/')) return 'cursor';
  if (relative.startsWith('.windsurf/')) return 'windsurf';
  return path.basename(relative, path.extname(relative)).toLowerCase();
}

export function createInstructionRecord({ rootKind = 'project', relative, content, modifiedAt, defaultScope = 'repository', kind = 'instruction', importedBy = null } = {}) {
  const normalized = normalizedRelative(relative);
  const parsed = parseInstructionDocument(content, { defaultScope: defaultScopeFor(normalized, defaultScope), sourcePath: normalized });
  const body = parsed.body.trim();
  if (!body) return null;
  const trust = rootKind === 'global' ? 'trusted-user-guidance' : 'untrusted-project-guidance';
  const prefix = kind === 'workflow' ? '[operator-invoked-template]' : `[${trust}]`;
  const sourceDirectory = path.posix.dirname(normalized) === '.' ? '' : path.posix.dirname(normalized);
  return Object.freeze({
    id: `instruction:${sha256(`${rootKind}\0${normalized}\0${content}`).slice(0, 24)}`,
    kind,
    rootKind,
    sourcePath: normalized,
    sourceDirectory,
    source: sourceName(normalized),
    description: String(parsed.metadata.description ?? '').slice(0, 300),
    globs: parsed.globs,
    alwaysApply: parsed.alwaysApply,
    scope: parsed.scope,
    priority: parsed.priority,
    languages: parsed.languages,
    tasks: parsed.tasks,
    imports: parsed.imports,
    rules: parsed.rules,
    valid: parsed.valid,
    issues: parsed.issues,
    importedBy,
    trust,
    executable: false,
    content: body,
    text: `${prefix}\n[source:${normalized}]\n${body}`,
    sha256: sha256(content),
    modifiedAt,
    bytes: Buffer.byteLength(content),
  });
}

export class InstructionDiscovery {
  constructor({ maxFileBytes = 64 * 1024, maxRecords = 128, maxDepth = 12 } = {}) {
    this.maxFileBytes = Math.max(1, Number(maxFileBytes) || 64 * 1024);
    this.maxRecords = Math.max(1, Number(maxRecords) || 128);
    this.maxDepth = Math.max(1, Math.min(64, Number(maxDepth) || 12));
  }
  async #files(root) {
    const found = [];
    const visit = async (relativeDirectory = '', depth = 0) => {
      if (depth > this.maxDepth || found.length >= this.maxRecords * 4) return;
      const absolute = path.join(root, relativeDirectory);
      let entries;
      try { entries = await readdir(absolute, { withFileTypes: true }); } catch (error) { if (error?.code === 'ENOENT') return; throw error; }
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (found.length >= this.maxRecords * 4 || entry.isSymbolicLink()) continue;
        const relative = normalizedRelative(path.posix.join(normalizedRelative(relativeDirectory), entry.name));
        if (entry.isDirectory()) {
          if (SKIP_DIRECTORIES.has(entry.name)) continue;
          if (relative === '.windsurf/workflows') {
            const workflowEntries = await readdir(path.join(root, relative), { withFileTypes: true }).catch(() => []);
            for (const workflow of workflowEntries) if (workflow.isFile() && !workflow.isSymbolicLink() && workflow.name.endsWith('.md')) found.push({ relative: `${relative}/${workflow.name}`, kind: 'workflow' });
            continue;
          }
          await visit(relative, depth + 1);
          continue;
        }
        if (!entry.isFile()) continue;
        if (ROOT_FILES.has(entry.name)) found.push({ relative, kind: 'instruction' });
        else if (relative.startsWith('.cursor/rules/') && (entry.name.endsWith('.mdc') || entry.name.endsWith('.md'))) found.push({ relative, kind: 'instruction' });
        else if (relative.startsWith('.windsurf/rules/') && entry.name.endsWith('.md')) found.push({ relative, kind: 'instruction' });
      }
    };
    await visit('', 0);
    return [...new Map(found.map((item) => [`${item.kind}:${item.relative}`, item])).values()].sort((a, b) => a.relative.localeCompare(b.relative)).slice(0, this.maxRecords * 2);
  }
  async readRecord(root, relative, { rootKind = 'project', defaultScope = 'repository', kind = 'instruction', importedBy = null } = {}) {
    const read = await safeInstructionRead(root, relative, this.maxFileBytes);
    if (!read.file) return Object.freeze({ record: null, reason: read.reason });
    const record = createInstructionRecord({ rootKind, relative: read.file.relative, content: read.file.content, modifiedAt: read.file.modifiedAt, defaultScope, kind, importedBy });
    return Object.freeze({ record, reason: record ? null : 'instruction-empty' });
  }
  async discover(workspaceRoot, { rootKind = 'project', defaultScope = rootKind === 'global' ? 'global' : 'repository' } = {}) {
    const root = path.resolve(String(workspaceRoot)); const records = [];
    for (const descriptor of await this.#files(root)) {
      if (records.length >= this.maxRecords) break;
      const loaded = await this.readRecord(root, descriptor.relative, { rootKind, defaultScope, kind: descriptor.kind });
      if (loaded.record) records.push(loaded.record);
    }
    return Object.freeze(records.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath)));
  }
  select(records, { paths = [], maxChars = 16_000, includeWorkflows = false } = {}) {
    const items = []; const omissions = []; let used = 0;
    for (const record of records ?? []) {
      if (record.kind === 'workflow' && !includeWorkflows) { omissions.push({ sourcePath: record.sourcePath, reason: 'workflow-not-invoked' }); continue; }
      if (!instructionMatches(record, paths)) { omissions.push({ sourcePath: record.sourcePath, reason: 'scope-mismatch' }); continue; }
      if (used + record.text.length > maxChars) { omissions.push({ sourcePath: record.sourcePath, reason: 'character-budget' }); continue; }
      used += record.text.length; items.push(record);
    }
    return Object.freeze({ items: Object.freeze(items), omissions: Object.freeze(omissions), chars: used });
  }
}
