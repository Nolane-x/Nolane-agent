import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { enumerateRepositoryFiles } from './repository-file-enumerator.mjs';

const SECRET_PATH = /(^|\/)(?:\.env(?:\..*)?|\.npmrc|\.pypirc|credentials(?:\.json)?|secrets?(?:\.[^/]*)?|id_(?:rsa|dsa|ecdsa|ed25519)|[^/]+\.(?:pem|key|p12|pfx))$/i;
const SKIP_DIRS = new Set(['.git', '.forge', 'node_modules', 'dist', 'build', 'coverage', '.next', '.cache', '__pycache__']);
const EXT_LANGUAGE = new Map([
  ['.js', 'javascript'], ['.mjs', 'javascript'], ['.cjs', 'javascript'], ['.jsx', 'javascript'],
  ['.ts', 'typescript'], ['.mts', 'typescript'], ['.cts', 'typescript'], ['.tsx', 'typescript'],
  ['.py', 'python'], ['.go', 'go'], ['.rs', 'rust'], ['.java', 'java'], ['.kt', 'kotlin'],
  ['.c', 'c'], ['.h', 'c'], ['.cpp', 'cpp'], ['.hpp', 'cpp'], ['.cs', 'csharp'],
  ['.json', 'json'], ['.yaml', 'yaml'], ['.yml', 'yaml'], ['.toml', 'toml'], ['.md', 'markdown'],
  ['.html', 'html'], ['.css', 'css'], ['.scss', 'scss'], ['.sql', 'sql'], ['.sh', 'shell'], ['.ps1', 'powershell'],
]);

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const normalize = (value) => String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, '');
const terms = (query) => [...new Set(String(query ?? '').toLowerCase().match(/[\p{L}\p{N}_$.-]{2,}/gu) ?? [])].slice(0, 24);

function isSecretPath(relative) {
  return SECRET_PATH.test(relative) || relative.split('/').some((part) => SKIP_DIRS.has(part));
}

function languageFor(relative) { return EXT_LANGUAGE.get(path.extname(relative).toLowerCase()) ?? 'text'; }

function extractSymbols(content, language) {
  const found = [];
  const lines = content.split(/\r?\n/);
  const patterns = language === 'python'
    ? [
        ['class', /^\s*class\s+([A-Za-z_$][\w$]*)\b/],
        ['function', /^\s*(?:async\s+)?def\s+([A-Za-z_$][\w$]*)\s*\(/],
        ['constant', /^\s*([A-Z][A-Z0-9_]*)\s*=/],
      ]
    : [
        ['class', /^\s*(?:export\s+)?(?:default\s+)?class\s+([A-Za-z_$][\w$]*)\b/],
        ['function', /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/],
        ['function', /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/],
        ['constant', /^\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=/],
        ['type', /^\s*(?:export\s+)?(?:interface|type|enum)\s+([A-Za-z_$][\w$]*)\b/],
      ];
  for (let index = 0; index < lines.length; index += 1) {
    for (const [kind, regex] of patterns) {
      const match = lines[index].match(regex);
      if (match) { found.push({ kind, name: match[1], line: index + 1, signature: lines[index].trim().slice(0, 500) }); break; }
    }
  }
  return found;
}

function occurrences(haystack, needle) {
  let count = 0; let offset = 0;
  while ((offset = haystack.indexOf(needle, offset)) !== -1) { count += 1; offset += needle.length; }
  return count;
}

export class RepositoryIndex {
  constructor({ store, maxFileBytes = 256_000, maxFiles = 20_000 } = {}) {
    if (!store?.db) throw new TypeError('RepositoryIndex requires a StudioStore');
    this.store = store;
    this.maxFileBytes = Math.max(1_024, Number(maxFileBytes) || 256_000);
    this.maxFiles = Math.max(1, Number(maxFiles) || 20_000);
  }

  async index(project) {
    if (!project?.id || !project?.workspaceRoot) throw new TypeError('project with workspaceRoot is required');
    const enumeration = await enumerateRepositoryFiles(project.workspaceRoot, { maxFiles: this.maxFiles, skipDirs: SKIP_DIRS });
    const files = enumeration.files;
    const existing = new Map(this.store.db.prepare('SELECT path,sha256 FROM repository_files WHERE project_id=?').all(project.id).map((row) => [row.path, row.sha256]));
    const seen = new Set(); let indexed = 0; let reused = 0; let ignored = 0;
    const upsert = this.store.db.prepare(`INSERT INTO repository_files(project_id,path,sha256,language,size_bytes,line_count,content,indexed_at)
      VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(project_id,path) DO UPDATE SET sha256=excluded.sha256,language=excluded.language,size_bytes=excluded.size_bytes,line_count=excluded.line_count,content=excluded.content,indexed_at=excluded.indexed_at`);
    const deleteSymbols = this.store.db.prepare('DELETE FROM repository_symbols WHERE project_id=? AND path=?');
    const insertSymbol = this.store.db.prepare('INSERT INTO repository_symbols(project_id,path,kind,name,line,signature) VALUES(?,?,?,?,?,?)');
    for (const relative of files) {
      seen.add(relative);
      if (isSecretPath(relative)) { ignored += 1; continue; }
      const absolute = path.join(project.workspaceRoot, relative);
      let info; try { info = await stat(absolute); } catch { ignored += 1; continue; }
      if (!info.isFile() || info.size > this.maxFileBytes) { ignored += 1; continue; }
      const buffer = await readFile(absolute);
      if (buffer.includes(0)) { ignored += 1; continue; }
      const digest = sha256(buffer);
      if (existing.get(relative) === digest) { reused += 1; continue; }
      const content = buffer.toString('utf8');
      const language = languageFor(relative);
      const stamp = new Date().toISOString();
      this.store.transaction(() => {
        upsert.run(project.id, relative, digest, language, buffer.length, content ? content.split(/\r?\n/).length : 0, content, stamp);
        deleteSymbols.run(project.id, relative);
        for (const symbol of extractSymbols(content, language)) insertSymbol.run(project.id, relative, symbol.kind, symbol.name, symbol.line, symbol.signature);
      });
      indexed += 1;
    }
    let removed = 0;
    for (const relative of existing.keys()) {
      if (!seen.has(relative) || isSecretPath(relative)) {
        this.store.db.prepare('DELETE FROM repository_files WHERE project_id=? AND path=?').run(project.id, relative);
        removed += 1;
      }
    }
    return Object.freeze({ projectId: project.id, scanned: files.length, indexed, reused, ignored, removed, discoveryMode: enumeration.mode, warnings: enumeration.warnings, enumerationReceiptSha256: enumeration.receiptSha256, limited: enumeration.limited });
  }

  symbols(projectId, { path: filePath = null, query = null, limit = 200 } = {}) {
    const clauses = ['project_id=?']; const values = [projectId];
    if (filePath) { clauses.push('path=?'); values.push(normalize(filePath)); }
    if (query) { clauses.push('LOWER(name) LIKE ?'); values.push(`%${String(query).toLowerCase()}%`); }
    return this.store.db.prepare(`SELECT path,kind,name,line,signature FROM repository_symbols WHERE ${clauses.join(' AND ')} ORDER BY path,line,kind,name LIMIT ?`).all(...values, Math.max(1, Math.min(2_000, Number(limit) || 200)));
  }

  search(projectId, query, { limit = 20, changedPaths = [] } = {}) {
    const needles = terms(query); const changed = new Set(changedPaths.map(normalize));
    if (!needles.length) return [];
    const rows = this.store.db.prepare('SELECT path,sha256,language,size_bytes,line_count,content,indexed_at FROM repository_files WHERE project_id=?').all(projectId);
    const symbolRows = this.store.db.prepare('SELECT path,name FROM repository_symbols WHERE project_id=?').all(projectId);
    const symbolMap = new Map();
    for (const row of symbolRows) symbolMap.set(row.path, `${symbolMap.get(row.path) ?? ''} ${row.name.toLowerCase()}`);
    return rows.map((row) => {
      const lowerPath = row.path.toLowerCase(); const lower = row.content.toLowerCase(); const symbolText = symbolMap.get(row.path) ?? '';
      let score = changed.has(row.path) ? 100 : 0;
      let matchedTerms = 0;
      for (const needle of needles) {
        const pathHits = occurrences(lowerPath, needle);
        const symbolHits = occurrences(symbolText, needle);
        const contentHits = Math.min(8, occurrences(lower, needle));
        if (pathHits || symbolHits || contentHits) matchedTerms += 1;
        score += pathHits * 15 + symbolHits * 10 + contentHits * 2;
      }
      score += Math.round((matchedTerms / needles.length) * 20);
      if (/^(?:test|tests|spec|specs)\//i.test(row.path)) score += matchedTerms === needles.length ? 4 : 0;
      return { path: row.path, sha256: row.sha256, language: row.language, sizeBytes: row.size_bytes, lineCount: row.line_count, indexedAt: row.indexed_at, score, content: row.content };
    }).filter((row) => row.score > 0).sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, Math.max(1, Math.min(200, Number(limit) || 20)));
  }

  contextForTask(projectId, { objective, changedPaths = [], maxChars = 24_000, maxFiles = 12 } = {}) {
    const candidates = this.search(projectId, objective, { limit: Math.max(maxFiles * 4, 20), changedPaths });
    const items = []; const omissions = []; let totalChars = 0;
    for (const candidate of candidates) {
      if (items.length >= maxFiles) { omissions.push({ path: candidate.path, reason: 'file-limit', score: candidate.score }); continue; }
      const header = `// repository:${candidate.path} sha256=${candidate.sha256}\n`;
      const available = Math.max(0, maxChars - totalChars - header.length);
      if (available < 80) { omissions.push({ path: candidate.path, reason: 'character-budget', score: candidate.score }); continue; }
      const content = candidate.content.slice(0, available);
      items.push(Object.freeze({ path: candidate.path, sha256: candidate.sha256, language: candidate.language, score: candidate.score, text: `${header}${content}`, truncated: content.length < candidate.content.length }));
      totalChars += header.length + content.length;
    }
    return Object.freeze({ items: Object.freeze(items), omissions: Object.freeze(omissions), totalChars, maxChars, maxFiles });
  }
}
