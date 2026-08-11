import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const normalize = (value) => String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, '');
const SECRET_PATH = /(^|\/)(?:\.env(?:\..*)?|\.npmrc|\.pypirc|credentials(?:\.json)?|secrets?(?:\.[^/]*)?|id_(?:rsa|dsa|ecdsa|ed25519)|[^/]+\.(?:pem|key|p12|pfx))$/i;
const SKIP_DIRS = new Set(['.git', '.forge', '.forgeos-data', 'node_modules', 'dist', 'build', 'coverage', '.next', '.cache', '__pycache__']);
const SKIP_FILES = /(?:^|\/)(?:\.forge[^/]*\.db(?:-(?:wal|shm))?|[^/]+\.sqlite(?:3)?(?:-(?:wal|shm))?)$/i;
const EXT_LANGUAGE = new Map([
  ['.js', 'javascript'], ['.mjs', 'javascript'], ['.cjs', 'javascript'], ['.jsx', 'javascript'], ['.ts', 'typescript'], ['.mts', 'typescript'], ['.cts', 'typescript'], ['.tsx', 'typescript'],
  ['.py', 'python'], ['.go', 'go'], ['.rs', 'rust'], ['.java', 'java'], ['.kt', 'kotlin'], ['.sql', 'sql'], ['.prisma', 'prisma'], ['.json', 'json'], ['.yaml', 'yaml'], ['.yml', 'yaml'], ['.toml', 'toml'], ['.md', 'markdown'],
]);
const SOURCE_EXTENSIONS = new Set([...EXT_LANGUAGE.keys()]);
const TERMS = (query) => [...new Set(String(query ?? '').toLowerCase().match(/[\p{L}\p{N}_$.-]{2,}/gu) ?? [])].slice(0, 32);
const TEST_PATH = /(?:^|\/)(?:test|tests|spec|specs)(?:\/|$)|(?:\.test|\.spec)\.[^.]+$/i;

function publicMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const blocked = /(?:secret|password|credential|token|environment|argv|command|absolute|prompt)/i;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !blocked.test(key)));
}

function languageFor(relative) { return EXT_LANGUAGE.get(path.extname(relative).toLowerCase()) ?? 'text'; }
function isAdmittedPath(relative) {
  const normalized = normalize(relative);
  if (!normalized || normalized.startsWith('/') || normalized.includes('../')) return false;
  if (SECRET_PATH.test(normalized) || SKIP_FILES.test(normalized)) return false;
  if (normalized.split('/').some((part) => SKIP_DIRS.has(part))) return false;
  return SOURCE_EXTENSIONS.has(path.extname(normalized).toLowerCase()) || /(?:^|\/)(?:Dockerfile|Makefile|Procfile)$/i.test(normalized);
}

async function walk(root, dir = '') {
  const output = [];
  for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
    const relative = normalize(path.join(dir, entry.name));
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) output.push(...await walk(root, relative));
    } else if (entry.isFile()) output.push(relative);
  }
  return output;
}

async function listFiles(root) {
  try {
    const { stdout } = await execFileAsync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: root, encoding: 'buffer', maxBuffer: 32 * 1024 * 1024, timeout: 15_000 });
    return [...new Set(stdout.toString('utf8').split('\0').filter(Boolean).map(normalize))].sort();
  } catch {
    return (await walk(root)).sort();
  }
}

function lineOf(content, offset) { return content.slice(0, offset).split(/\r?\n/).length; }
function entityId(projectId, kind, filePath, name, line) { return sha256(`${projectId}\0${kind}\0${filePath}\0${name}\0${line}`); }
function edgeId(projectId, kind, fromId, toId, line) { return sha256(`${projectId}\0${kind}\0${fromId}\0${toId}\0${line}`); }

function functionRanges(content, language) {
  const lines = content.split(/\r?\n/); const out = [];
  if (language === 'python') {
    const starts = [];
    for (let index = 0; index < lines.length; index += 1) {
      const match = lines[index].match(/^(\s*)(?:async\s+)?def\s+([A-Za-z_$][\w$]*)\s*\(/);
      if (match) starts.push({ name: match[2], line: index + 1, indent: match[1].length, signature: lines[index].trim() });
    }
    for (let i = 0; i < starts.length; i += 1) {
      const start = starts[i]; let endLine = lines.length;
      for (let line = start.line; line < lines.length; line += 1) {
        if (!lines[line].trim()) continue;
        const indent = lines[line].match(/^\s*/)[0].length;
        if (indent <= start.indent) { endLine = line; break; }
      }
      out.push({ ...start, endLine });
    }
    return out;
  }
  const patterns = [
    /(?:^|\n)\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g,
    /(?:^|\n)\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/g,
  ];
  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      const open = content.indexOf('{', match.index); let depth = 0; let close = content.length - 1;
      for (let cursor = open; cursor < content.length; cursor += 1) {
        if (content[cursor] === '{') depth += 1;
        else if (content[cursor] === '}') { depth -= 1; if (depth === 0) { close = cursor; break; } }
      }
      const startLine = lineOf(content, match.index + match[0].indexOf(match[1]));
      out.push({ name: match[1], line: startLine, endLine: lineOf(content, close), signature: content.slice(match.index, content.indexOf('\n', match.index) === -1 ? open + 1 : content.indexOf('\n', match.index)).trim() });
    }
  }
  // Single-line declarations are still useful for conservative call edges.
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{.*\}\s*$/);
    if (match && !out.some((item) => item.name === match[1] && item.line === index + 1)) out.push({ name: match[1], line: index + 1, endLine: index + 1, signature: lines[index].trim() });
  }
  return out.sort((a, b) => a.line - b.line || a.name.localeCompare(b.name));
}

function extractEntities(projectId, filePath, content, language, sourceSha256) {
  const lines = content.split(/\r?\n/); const entities = [];
  const add = (kind, name, line, detector, confidence = 'exact-pattern', metadata = {}, endLine = line, signature = lines[line - 1]?.trim().slice(0, 500) ?? '') => {
    const id = entityId(projectId, kind, filePath, name, line);
    entities.push({ id, projectId, path: filePath, kind, name, line, endLine, signature, detector, confidence, metadata: publicMetadata(metadata), sourceSha256 });
  };
  for (const fn of functionRanges(content, language)) add('function', fn.name, fn.line, `${language}-function-declaration`, 'structural-pattern', {}, fn.endLine, fn.signature);
  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index]; const line = index + 1;
    let match;
    if ((match = text.match(/\b(?:app|router|server)\.(get|post|put|patch|delete|options|head)\(\s*['"]([^'"]+)['"]/i))) {
      const name = `${match[1].toUpperCase()} ${match[2]}`; add('route', name, line, 'js-router-method'); add('api_endpoint', name, line, 'js-router-method');
    }
    if ((match = text.match(/^\s*@(?:app|router)\.(get|post|put|patch|delete|options|head)\(\s*['"]([^'"]+)['"]/i))) {
      const name = `${match[1].toUpperCase()} ${match[2]}`; add('route', name, line, 'python-router-decorator'); add('api_endpoint', name, line, 'python-router-decorator');
    }
    if ((match = text.match(/\bhttp\.HandleFunc\(\s*['"]([^'"]+)['"]/))) {
      const name = `ANY ${match[1]}`; add('route', name, line, 'go-http-handlefunc'); add('api_endpoint', name, line, 'go-http-handlefunc');
    }
    if ((match = text.match(/^\s*model\s+([A-Za-z_$][\w$]*)\s*\{/))) add('database_model', match[1], line, 'prisma-model');
    if ((match = text.match(/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?([A-Za-z_$][\w$.-]*)/i))) add('database_model', match[1], line, 'sql-create-table');
    if ((match = text.match(/\b(?:mongoose\.model|sequelize\.define)\(\s*['"]([^'"]+)['"]/))) add('database_model', match[1], line, 'js-orm-model');
    if ((match = text.match(/^\s*class\s+([A-Za-z_$][\w$]*)\s*\(\s*models\.Model\s*\)\s*:/))) add('database_model', match[1], line, 'django-model');
  }
  return [...new Map(entities.map((entity) => [entity.id, entity])).values()];
}

const IMPORT_PATTERNS = [
  /\b(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g,
  /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
  /^\s*from\s+([A-Za-z0-9_./-]+)\s+import\b/gm,
  /^\s*import\s+([A-Za-z0-9_./-]+)\b/gm,
];
function importsOf(content) {
  const found = [];
  for (const pattern of IMPORT_PATTERNS) { pattern.lastIndex = 0; let match; while ((match = pattern.exec(content)) !== null) found.push({ specifier: match[1], line: lineOf(content, match.index) }); }
  return found;
}
function resolveImport(fromPath, specifier, paths) {
  if (!specifier.startsWith('.')) return null;
  const base = normalize(path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), specifier)));
  const candidates = [base, `${base}.mjs`, `${base}.js`, `${base}.cjs`, `${base}.ts`, `${base}.tsx`, `${base}.jsx`, `${base}.py`, `${base}.go`, `${base}.rs`, `${base}/index.mjs`, `${base}/index.js`, `${base}/index.ts`, `${base}/__init__.py`];
  return candidates.find((candidate) => paths.has(candidate)) ?? null;
}

function unsafeRegex(pattern) {
  const text = String(pattern);
  return text.length > 256 || /\([^)]*[+*][^)]*\)[+*{]/.test(text) || /\\[1-9]/.test(text);
}
function occurrences(text, needle) { let count = 0; let cursor = 0; while ((cursor = text.indexOf(needle, cursor)) !== -1) { count += 1; cursor += needle.length; } return count; }

async function gitHistory(root, maxBytes) {
  try {
    const { stdout } = await execFileAsync('git', ['log', '--format=@@%H%x09%cI', '--name-only', '--', '.'], { cwd: root, timeout: 20_000, maxBuffer: maxBytes });
    const map = new Map(); let commit = null;
    for (const raw of stdout.split(/\r?\n/)) {
      const line = raw.trim(); if (!line) continue;
      if (line.startsWith('@@')) { const [hash, at] = line.slice(2).split('\t'); commit = { hash, at }; continue; }
      if (!commit) continue;
      const filePath = normalize(line); const current = map.get(filePath) ?? { path: filePath, commitCount: 0, lastCommitAt: null, lastCommitHash: null };
      current.commitCount += 1;
      if (!current.lastCommitAt) { current.lastCommitAt = commit.at; current.lastCommitHash = commit.hash; }
      map.set(filePath, current);
    }
    return map;
  } catch { return new Map(); }
}

export class CodebaseKnowledgeGraphService {
  constructor({ store, maxFileBytes = 256_000, maxFiles = 20_000, maxGitBytes = 16 * 1024 * 1024, now = () => new Date().toISOString() } = {}) {
    if (!store?.db) throw new TypeError('CodebaseKnowledgeGraphService requires a StudioStore');
    this.store = store; this.maxFileBytes = Math.max(1_024, Number(maxFileBytes) || 256_000); this.maxFiles = Math.max(1, Number(maxFiles) || 20_000); this.maxGitBytes = Math.max(64_000, Number(maxGitBytes) || 16 * 1024 * 1024); this.now = now;
    this.store.db.exec(`
      CREATE TABLE IF NOT EXISTS codebase_knowledge_files(project_id TEXT NOT NULL,path TEXT NOT NULL,sha256 TEXT NOT NULL,language TEXT NOT NULL,line_count INTEGER NOT NULL,content TEXT NOT NULL,indexed_at TEXT NOT NULL,last_commit_at TEXT,last_commit_hash TEXT,commit_count INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(project_id,path));
      CREATE TABLE IF NOT EXISTS codebase_knowledge_entities(project_id TEXT NOT NULL,id TEXT NOT NULL,path TEXT NOT NULL,kind TEXT NOT NULL,name TEXT NOT NULL,line INTEGER NOT NULL,end_line INTEGER NOT NULL,signature TEXT NOT NULL,detector TEXT NOT NULL,confidence TEXT NOT NULL,metadata_json TEXT NOT NULL,source_sha256 TEXT NOT NULL,PRIMARY KEY(project_id,id));
      CREATE INDEX IF NOT EXISTS codebase_knowledge_entities_kind ON codebase_knowledge_entities(project_id,kind,name);
      CREATE TABLE IF NOT EXISTS codebase_knowledge_edges(project_id TEXT NOT NULL,id TEXT NOT NULL,kind TEXT NOT NULL,from_id TEXT NOT NULL,to_id TEXT NOT NULL,from_path TEXT NOT NULL,to_path TEXT NOT NULL,from_name TEXT,to_name TEXT,line INTEGER NOT NULL,detector TEXT NOT NULL,confidence TEXT NOT NULL,metadata_json TEXT NOT NULL,PRIMARY KEY(project_id,id));
      CREATE INDEX IF NOT EXISTS codebase_knowledge_edges_kind ON codebase_knowledge_edges(project_id,kind,from_path,to_path);
    `);
  }

  async signature(project) {
    const files = (await listFiles(project.workspaceRoot)).filter(isAdmittedPath).slice(0, this.maxFiles);
    const rows = [];
    for (const relative of files) {
      try { const info = await stat(path.join(project.workspaceRoot, relative)); if (info.isFile() && !info.isSymbolicLink() && info.size <= this.maxFileBytes) rows.push(`${relative}\0${info.size}\0${Math.floor(info.mtimeMs)}`); } catch {}
    }
    return sha256(rows.sort().join('\n'));
  }

  async index(project, { includeGitHistory = true } = {}) {
    if (!project?.id || !project?.workspaceRoot) throw new TypeError('project with workspaceRoot is required');
    const candidates = (await listFiles(project.workspaceRoot)).slice(0, this.maxFiles);
    const existing = new Map(this.store.db.prepare('SELECT path,sha256 FROM codebase_knowledge_files WHERE project_id=?').all(project.id).map((row) => [row.path, row.sha256]));
    const seen = new Set(); const changedPaths = []; let indexed = 0; let reused = 0; let ignored = 0;
    const upsertFile = this.store.db.prepare(`INSERT INTO codebase_knowledge_files(project_id,path,sha256,language,line_count,content,indexed_at,last_commit_at,last_commit_hash,commit_count) VALUES(?,?,?,?,?,?,?,NULL,NULL,0) ON CONFLICT(project_id,path) DO UPDATE SET sha256=excluded.sha256,language=excluded.language,line_count=excluded.line_count,content=excluded.content,indexed_at=excluded.indexed_at`);
    const deleteEntities = this.store.db.prepare('DELETE FROM codebase_knowledge_entities WHERE project_id=? AND path=?');
    const insertEntity = this.store.db.prepare('INSERT INTO codebase_knowledge_entities(project_id,id,path,kind,name,line,end_line,signature,detector,confidence,metadata_json,source_sha256) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
    for (const relative of candidates) {
      if (!isAdmittedPath(relative)) { ignored += 1; continue; }
      const absolute = path.resolve(project.workspaceRoot, relative);
      if (!absolute.startsWith(`${path.resolve(project.workspaceRoot)}${path.sep}`)) { ignored += 1; continue; }
      let info; try { info = await stat(absolute); } catch { ignored += 1; continue; }
      if (!info.isFile() || info.isSymbolicLink() || info.size > this.maxFileBytes) { ignored += 1; continue; }
      const buffer = await readFile(absolute); if (buffer.includes(0)) { ignored += 1; continue; }
      seen.add(relative); const digest = sha256(buffer);
      if (existing.get(relative) === digest) { reused += 1; continue; }
      const content = buffer.toString('utf8'); const language = languageFor(relative); const entities = extractEntities(project.id, relative, content, language, digest);
      this.store.transaction(() => {
        upsertFile.run(project.id, relative, digest, language, content ? content.split(/\r?\n/).length : 0, content, this.now());
        deleteEntities.run(project.id, relative);
        for (const entity of entities) insertEntity.run(project.id, entity.id, entity.path, entity.kind, entity.name, entity.line, entity.endLine, entity.signature, entity.detector, entity.confidence, JSON.stringify(entity.metadata), entity.sourceSha256);
      });
      indexed += 1; changedPaths.push(relative);
    }
    let removed = 0;
    for (const relative of existing.keys()) if (!seen.has(relative)) { this.store.db.prepare('DELETE FROM codebase_knowledge_files WHERE project_id=? AND path=?').run(project.id, relative); this.store.db.prepare('DELETE FROM codebase_knowledge_entities WHERE project_id=? AND path=?').run(project.id, relative); removed += 1; changedPaths.push(relative); }
    await this.#rebuildEdges(project.id);
    if (includeGitHistory) {
      const history = await gitHistory(project.workspaceRoot, this.maxGitBytes);
      const historyUpdate = this.store.db.prepare('UPDATE codebase_knowledge_files SET last_commit_at=?,last_commit_hash=?,commit_count=? WHERE project_id=? AND path=?');
      this.store.transaction(() => { for (const [filePath, item] of history) historyUpdate.run(item.lastCommitAt, item.lastCommitHash, item.commitCount, project.id, filePath); });
    }
    return Object.freeze({ schema: 'forge.codebase-knowledge-index.v1', projectId: project.id, scanned: candidates.length, indexed, reused, ignored, removed, changedPaths: Object.freeze(changedPaths.sort()), limited: candidates.length >= this.maxFiles, graphSha256: this.graphSha256(project.id) });
  }

  async #rebuildEdges(projectId) {
    const files = this.store.db.prepare('SELECT path,sha256,content FROM codebase_knowledge_files WHERE project_id=? ORDER BY path').all(projectId);
    const paths = new Set(files.map((row) => row.path));
    const entities = this.store.db.prepare('SELECT id,path,kind,name,line,end_line FROM codebase_knowledge_entities WHERE project_id=? ORDER BY path,line,name').all(projectId);
    const definitions = new Map(); for (const entity of entities) if (['function', 'database_model'].includes(entity.kind)) { if (!definitions.has(entity.name)) definitions.set(entity.name, []); definitions.get(entity.name).push(entity); }
    const fileIds = new Map(files.map((row) => [row.path, entityId(projectId, 'file', row.path, row.path, 1)]));
    const edges = [];
    const add = ({ kind, fromId, toId, fromPath, toPath, fromName = null, toName = null, line = 1, detector, confidence, metadata = {} }) => edges.push({ id: edgeId(projectId, kind, fromId, toId, line), projectId, kind, fromId, toId, fromPath, toPath, fromName, toName, line, detector, confidence, metadata: publicMetadata(metadata) });
    for (const row of files) {
      const imports = importsOf(row.content);
      for (const item of imports) {
        const target = resolveImport(row.path, item.specifier, paths); if (!target) continue;
        add({ kind: 'import', fromId: fileIds.get(row.path), toId: fileIds.get(target), fromPath: row.path, toPath: target, line: item.line, detector: 'relative-import-resolver', confidence: 'exact-path' });
        if (TEST_PATH.test(row.path) && !TEST_PATH.test(target)) add({ kind: 'test_relation', fromId: fileIds.get(row.path), toId: fileIds.get(target), fromPath: row.path, toPath: target, line: item.line, detector: 'test-import-relation', confidence: 'exact-path' });
      }
      const lines = row.content.split(/\r?\n/);
      for (const [name, targets] of definitions) {
        const regex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'); let match;
        while ((match = regex.exec(row.content)) !== null) {
          const line = lineOf(row.content, match.index); const target = targets[0];
          if (targets.length !== 1 || (row.path === target.path && line === target.line)) continue;
          const container = entities.filter((entity) => entity.path === row.path && entity.kind === 'function' && line >= entity.line && line <= entity.end_line).sort((a, b) => (a.end_line - a.line) - (b.end_line - b.line))[0];
          const fromId = container?.id ?? fileIds.get(row.path); const fromName = container?.name ?? null;
          add({ kind: 'reference', fromId, toId: target.id, fromPath: row.path, toPath: target.path, fromName, toName: target.name, line, detector: 'unique-symbol-occurrence', confidence: 'conservative-lexical' });
          const after = row.content.slice(match.index + match[0].length).match(/^\s*\(/);
          if (after && container) add({ kind: 'call', fromId, toId: target.id, fromPath: row.path, toPath: target.path, fromName, toName: target.name, line, detector: 'function-body-call-pattern', confidence: 'conservative-lexical' });
        }
      }
      // Preserve a file node as evidence without polluting the entity index exposed to users.
      void lines;
    }
    const unique = new Map(edges.map((edge) => [edge.id, edge]));
    const insert = this.store.db.prepare('INSERT INTO codebase_knowledge_edges(project_id,id,kind,from_id,to_id,from_path,to_path,from_name,to_name,line,detector,confidence,metadata_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)');
    this.store.transaction(() => {
      this.store.db.prepare('DELETE FROM codebase_knowledge_edges WHERE project_id=?').run(projectId);
      for (const edge of unique.values()) insert.run(projectId, edge.id, edge.kind, edge.fromId, edge.toId, edge.fromPath, edge.toPath, edge.fromName, edge.toName, edge.line, edge.detector, edge.confidence, JSON.stringify(edge.metadata));
    });
  }

  graphSha256(projectId) {
    const entities = this.store.db.prepare('SELECT id,path,kind,name,line,source_sha256 FROM codebase_knowledge_entities WHERE project_id=? ORDER BY id').all(projectId);
    const edges = this.store.db.prepare('SELECT id,kind,from_id,to_id,line FROM codebase_knowledge_edges WHERE project_id=? ORDER BY id').all(projectId);
    return sha256(JSON.stringify({ entities, edges }));
  }

  snapshot(projectId, { limit = 500 } = {}) {
    const capped = Math.max(1, Math.min(5_000, Number(limit) || 500));
    const entities = this.store.db.prepare('SELECT id,path,kind,name,line,end_line,signature,detector,confidence,metadata_json,source_sha256 FROM codebase_knowledge_entities WHERE project_id=? ORDER BY path,line,kind,name LIMIT ?').all(projectId, capped).map((row) => Object.freeze({ id: row.id, path: row.path, kind: row.kind, name: row.name, line: row.line, endLine: row.end_line, signature: row.signature, detector: row.detector, confidence: row.confidence, metadata: publicMetadata(JSON.parse(row.metadata_json)), sourceSha256: row.source_sha256 }));
    const edges = this.store.db.prepare('SELECT id,kind,from_id,to_id,from_path,to_path,from_name,to_name,line,detector,confidence,metadata_json FROM codebase_knowledge_edges WHERE project_id=? ORDER BY kind,from_path,line,to_path LIMIT ?').all(projectId, capped).map((row) => Object.freeze({ id: row.id, kind: row.kind, fromId: row.from_id, toId: row.to_id, fromPath: row.from_path, toPath: row.to_path, fromName: row.from_name, toName: row.to_name, line: row.line, detector: row.detector, confidence: row.confidence, metadata: publicMetadata(JSON.parse(row.metadata_json)) }));
    const history = this.store.db.prepare('SELECT path,last_commit_at,last_commit_hash,commit_count FROM codebase_knowledge_files WHERE project_id=? AND commit_count>0 ORDER BY last_commit_at DESC,path LIMIT ?').all(projectId, capped).map((row) => Object.freeze({ path: row.path, lastCommitAt: row.last_commit_at, lastCommitHash: row.last_commit_hash, commitCount: row.commit_count }));
    const counts = Object.fromEntries(this.store.db.prepare('SELECT kind,COUNT(*) AS count FROM codebase_knowledge_entities WHERE project_id=? GROUP BY kind').all(projectId).map((row) => [row.kind, row.count]));
    return Object.freeze({ schema: 'forge.codebase-knowledge.v1', projectId: String(projectId), counts: Object.freeze(counts), entities: Object.freeze(entities), edges: Object.freeze(edges), history: Object.freeze(history), graphSha256: this.graphSha256(projectId) });
  }

  searchRegex(projectId, pattern, { flags = 'g', limit = 100, pathPrefix = null } = {}) {
    if (unsafeRegex(pattern)) throw new Error('Unsafe regex pattern');
    const allowedFlags = [...new Set(String(flags).split('').filter((flag) => 'gimu'.includes(flag)))].join('');
    let regex; try { regex = new RegExp(String(pattern), allowedFlags.includes('g') ? allowedFlags : `${allowedFlags}g`); } catch (error) { throw new Error(`Invalid regex: ${error.message}`); }
    const capped = Math.max(1, Math.min(1_000, Number(limit) || 100)); const prefix = pathPrefix ? normalize(pathPrefix) : null;
    const rows = this.store.db.prepare('SELECT path,sha256,content FROM codebase_knowledge_files WHERE project_id=? ORDER BY path').all(projectId); const out = [];
    const started = Date.now();
    for (const row of rows) {
      if (prefix && !row.path.startsWith(prefix)) continue;
      regex.lastIndex = 0; let match;
      while ((match = regex.exec(row.content)) !== null) {
        const line = lineOf(row.content, match.index); const lineText = row.content.split(/\r?\n/)[line - 1]?.slice(0, 500) ?? '';
        out.push(Object.freeze({ path: row.path, line, column: match.index - row.content.lastIndexOf('\n', match.index - 1), match: match[0].slice(0, 500), preview: lineText, sourceSha256: row.sha256 }));
        if (out.length >= capped) return Object.freeze(out);
        if (match[0] === '') regex.lastIndex += 1;
        if (Date.now() - started > 250) throw new Error('Regex search time budget exceeded');
      }
    }
    return Object.freeze(out);
  }

  rank(projectId, query, { seedPaths = [], limit = 20 } = {}) {
    const needles = TERMS(query); const capped = Math.max(1, Math.min(200, Number(limit) || 20));
    const files = this.store.db.prepare('SELECT path,sha256,language,content,last_commit_at,commit_count FROM codebase_knowledge_files WHERE project_id=?').all(projectId);
    const edges = this.store.db.prepare("SELECT kind,from_path,to_path FROM codebase_knowledge_edges WHERE project_id=? AND kind IN ('import','test_relation')").all(projectId);
    const adjacency = new Map(files.map((row) => [row.path, new Set()])); const testPaths = new Set();
    for (const edge of edges) { adjacency.get(edge.from_path)?.add(edge.to_path); adjacency.get(edge.to_path)?.add(edge.from_path); if (edge.kind === 'test_relation') { testPaths.add(edge.from_path); testPaths.add(edge.to_path); } }
    const distances = new Map(); const queue = [];
    for (const seed of seedPaths.map(normalize)) if (adjacency.has(seed)) { distances.set(seed, 0); queue.push(seed); }
    while (queue.length) { const current = queue.shift(); for (const next of adjacency.get(current) ?? []) if (!distances.has(next)) { distances.set(next, distances.get(current) + 1); queue.push(next); } }
    const latest = Math.max(0, ...files.map((row) => Date.parse(row.last_commit_at || 0)).filter(Number.isFinite));
    const items = files.map((row) => {
      const lower = `${row.path}\n${row.content}`.toLowerCase(); let lexical = 0; for (const needle of needles) lexical += Math.min(10, occurrences(lower, needle)) * 2 + (row.path.toLowerCase().includes(needle) ? 10 : 0);
      const distance = distances.get(row.path); const dependencyDistance = distance == null ? 0 : Math.max(0, 18 - distance * 4);
      const timestamp = Date.parse(row.last_commit_at || 0); const ageDays = latest && timestamp ? Math.max(0, (latest - timestamp) / 86_400_000) : 365; const gitRecency = timestamp ? Math.max(0, 12 - Math.log2(ageDays + 1) * 2) : 0;
      const testRelation = TEST_PATH.test(row.path) ? 8 : (testPaths.has(row.path) ? 5 : 0);
      const scoreBreakdown = { lexical, dependencyDistance, gitRecency: Number(gitRecency.toFixed(4)), testRelation, commitFrequency: Math.min(6, Number(row.commit_count) || 0) };
      const score = Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0);
      return { path: row.path, sha256: row.sha256, language: row.language, score: Number(score.toFixed(4)), scoreBreakdown };
    }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, capped).map((item) => Object.freeze({ ...item, scoreBreakdown: Object.freeze(item.scoreBreakdown) }));
    return Object.freeze({ schema: 'forge.codebase-ranking.v1', projectId: String(projectId), query: String(query), seedPaths: Object.freeze(seedPaths.map(normalize)), items: Object.freeze(items), graphSha256: this.graphSha256(projectId) });
  }
}
