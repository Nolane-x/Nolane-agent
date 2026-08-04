import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { FeatureHashEmbeddingProvider, cosineSimilarity } from './embedding-provider.mjs';
import { buildChunkMerkleTree, buildMerkleTree, similarityHash } from './merkle-index.mjs';
import { SyntaxChunker } from './syntax-chunker.mjs';
import { HybridCodeReranker } from './hybrid-code-reranker.mjs';
import { decodeQuantizedVector, encodeQuantizedVector, QUANTIZED_VECTOR_REVISION } from './quantized-vector-codec.mjs';

const execFileAsync = promisify(execFile);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const SECRET_PATH = /(^|\/)(?:\.env(?:\..*)?|\.npmrc|\.pypirc|credentials(?:\.json)?|secrets?(?:\.[^/]*)?|id_(?:rsa|dsa|ecdsa|ed25519)|[^/]+\.(?:pem|key|p12|pfx))$/i;
const SKIP_DIRS = new Set(['.git', '.forge', 'node_modules', 'dist', 'build', 'coverage', '.next', '.cache', '__pycache__', 'release']);
const EXT_LANGUAGE = new Map([
  ['.js', 'javascript'], ['.mjs', 'javascript'], ['.cjs', 'javascript'], ['.jsx', 'javascript'],
  ['.ts', 'typescript'], ['.mts', 'typescript'], ['.cts', 'typescript'], ['.tsx', 'typescript'],
  ['.py', 'python'], ['.go', 'go'], ['.rs', 'rust'], ['.java', 'java'], ['.kt', 'kotlin'],
  ['.c', 'c'], ['.h', 'c'], ['.cpp', 'cpp'], ['.hpp', 'cpp'], ['.cs', 'csharp'],
  ['.json', 'json'], ['.yaml', 'yaml'], ['.yml', 'yaml'], ['.toml', 'toml'], ['.md', 'markdown'],
  ['.html', 'html'], ['.css', 'css'], ['.scss', 'scss'], ['.sql', 'sql'], ['.sh', 'shell'], ['.ps1', 'powershell'],
]);

function normalize(value) { return String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, ''); }
function languageFor(relative) { return EXT_LANGUAGE.get(path.extname(relative).toLowerCase()) ?? 'text'; }
function queryTerms(query) { return [...new Set(String(query ?? '').toLowerCase().match(/[\p{L}\p{N}_$.-]{2,}/gu) ?? [])].slice(0, 32); }
function parseJson(value, fallback) { try { return value == null ? fallback : JSON.parse(value); } catch { return fallback; } }

async function walk(root, dir = '') {
  const output = [];
  for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
    const relative = normalize(path.join(dir, entry.name));
    if (entry.isDirectory()) { if (!SKIP_DIRS.has(entry.name)) output.push(...await walk(root, relative)); }
    else if (entry.isFile()) output.push(relative);
  }
  return output;
}

async function listFiles(root) {
  try {
    const { stdout } = await execFileAsync('git', ['ls-files', '-z'], { cwd: root, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
    return stdout.toString('utf8').split('\0').filter(Boolean).map(normalize).sort();
  } catch { return (await walk(root)).sort(); }
}

function importsFor(content, sourcePath) {
  const imports = [];
  const regexes = [/\bfrom\s+['"]([^'"]+)['"]/g, /\bimport\s+['"]([^'"]+)['"]/g, /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g];
  for (const regex of regexes) {
    let match;
    while ((match = regex.exec(content))) {
      const specifier = match[1];
      if (!specifier.startsWith('.')) continue;
      const base = normalize(path.join(path.dirname(sourcePath), specifier));
      imports.push(base);
    }
  }
  return [...new Set(imports)];
}

function lexicalScore(text, filePath, query, terms) {
  const lower = text.toLowerCase(); const pathLower = filePath.toLowerCase(); const phrase = String(query).toLowerCase().trim();
  let matches = 0;
  for (const term of terms) {
    let offset = 0; let count = 0;
    while ((offset = lower.indexOf(term, offset)) !== -1) { count += 1; offset += term.length; }
    matches += Math.min(4, count);
  }
  const lexical = terms.length ? Math.min(1, matches / Math.max(1, terms.length * 2)) : 0;
  const exact = phrase && lower.includes(phrase) ? 0.35 : 0;
  const pathScore = terms.length ? Math.min(1, terms.filter((term) => pathLower.includes(term)).length / terms.length) : 0;
  return { lexical: Math.min(1, lexical + exact), path: pathScore };
}

function resolveImport(importPath, knownPaths) {
  const candidates = [importPath, `${importPath}.js`, `${importPath}.mjs`, `${importPath}.cjs`, `${importPath}.ts`, `${importPath}.tsx`, `${importPath}/index.js`, `${importPath}/index.mjs`, `${importPath}/index.ts`];
  return candidates.find((candidate) => knownPaths.has(candidate)) ?? null;
}

export class SecureSemanticIndex {
  constructor({ store, embeddingProvider = new FeatureHashEmbeddingProvider(), chunker = new SyntaxChunker(), reranker = new HybridCodeReranker(), maxFileBytes = 512_000, maxFiles = 50_000, maxSearchCandidates = 300, toolSchemaRevision = 'forge-tools-v1' } = {}) {
    if (!store?.db) throw new TypeError('SecureSemanticIndex requires a StudioStore');
    if (!embeddingProvider?.id || typeof embeddingProvider.embed !== 'function') throw new TypeError('embeddingProvider with id and embed() is required');
    this.store = store; this.embeddingProvider = embeddingProvider; this.chunker = chunker; this.reranker = reranker;
    this.maxSearchCandidates = Math.max(1, Math.min(1_000, Number(maxSearchCandidates) || 300));
    this.toolSchemaRevision = String(toolSchemaRevision);
    this.maxFileBytes = Math.max(1_024, Number(maxFileBytes) || 512_000); this.maxFiles = Math.max(1, Number(maxFiles) || 50_000);
    this.#migrate();
  }

  #migrate() {
    this.store.db.exec(`
      CREATE TABLE IF NOT EXISTS semantic_files(project_id TEXT NOT NULL,path TEXT NOT NULL,sha256 TEXT NOT NULL,language TEXT NOT NULL,bytes INTEGER NOT NULL,indexed_at TEXT NOT NULL,PRIMARY KEY(project_id,path));
      CREATE TABLE IF NOT EXISTS semantic_chunks(project_id TEXT NOT NULL,chunk_id TEXT NOT NULL,path TEXT NOT NULL,start_line INTEGER NOT NULL,end_line INTEGER NOT NULL,kind TEXT NOT NULL,symbol TEXT,text TEXT NOT NULL,sha256 TEXT NOT NULL,embedding_provider TEXT,embedding_json TEXT,indexed_at TEXT NOT NULL,PRIMARY KEY(project_id,chunk_id));
      CREATE INDEX IF NOT EXISTS semantic_chunks_project_path ON semantic_chunks(project_id,path,start_line);
      CREATE INDEX IF NOT EXISTS semantic_chunks_sha ON semantic_chunks(sha256,embedding_provider);
      CREATE TABLE IF NOT EXISTS semantic_embedding_cache(sha256 TEXT NOT NULL,provider_id TEXT NOT NULL,embedding_json TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(sha256,provider_id));
      CREATE TABLE IF NOT EXISTS semantic_vector_cache(chunk_sha256 TEXT NOT NULL,provider_id TEXT NOT NULL,model_sha256 TEXT NOT NULL,revision TEXT NOT NULL,dimensions INTEGER NOT NULL,scale REAL NOT NULL,vector_blob BLOB NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(chunk_sha256,provider_id,model_sha256,revision));
      CREATE TABLE IF NOT EXISTS semantic_imports(project_id TEXT NOT NULL,source_path TEXT NOT NULL,target_path TEXT NOT NULL,PRIMARY KEY(project_id,source_path,target_path));
      CREATE TABLE IF NOT EXISTS semantic_index_state(project_id TEXT PRIMARY KEY,root_sha256 TEXT NOT NULL,similarity_hash TEXT NOT NULL,phase TEXT NOT NULL,total_files INTEGER NOT NULL,total_chunks INTEGER NOT NULL,embedded_chunks INTEGER NOT NULL,updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS semantic_feedback(project_id TEXT NOT NULL,query_key TEXT NOT NULL,chunk_sha256 TEXT NOT NULL,successes INTEGER NOT NULL DEFAULT 0,failures INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL,PRIMARY KEY(project_id,query_key,chunk_sha256));
      CREATE TABLE IF NOT EXISTS semantic_index_provenance(project_id TEXT PRIMARY KEY,chunk_root_sha256 TEXT NOT NULL,branch TEXT,head_sha TEXT,dirty_hash TEXT,branch_fingerprint TEXT NOT NULL,provider_model_sha256 TEXT,tool_schema_revision TEXT NOT NULL,updated_at TEXT NOT NULL);
    `);
  }

  state(projectId) {
    const id = String(projectId);
    const row = this.store.db.prepare('SELECT * FROM semantic_index_state WHERE project_id=?').get(id);
    const provenance = this.store.db.prepare('SELECT * FROM semantic_index_provenance WHERE project_id=?').get(id);
    return row ? Object.freeze({ projectId: row.project_id, rootSha256: row.root_sha256, chunkRootSha256: provenance?.chunk_root_sha256 ?? null, similarityHash: row.similarity_hash, phase: row.phase, totalFiles: Number(row.total_files), totalChunks: Number(row.total_chunks), embeddedChunks: Number(row.embedded_chunks), provenance: provenance ? Object.freeze({ branch: provenance.branch, headSha: provenance.head_sha, dirtyHash: provenance.dirty_hash, branchFingerprint: provenance.branch_fingerprint, providerModelSha256: provenance.provider_model_sha256, toolSchemaRevision: provenance.tool_schema_revision }) : null, updatedAt: row.updated_at }) : Object.freeze({ projectId: id, rootSha256: null, chunkRootSha256: null, similarityHash: null, phase: 'empty', totalFiles: 0, totalChunks: 0, embeddedChunks: 0, provenance: null, updatedAt: null });
  }

  async index(project, { deferEmbeddings = false, branchContext = null } = {}) {
    if (!project?.id || !project?.workspaceRoot) throw new TypeError('project with id and workspaceRoot is required');
    const files = (await listFiles(project.workspaceRoot)).slice(0, this.maxFiles);
    const existing = new Map(this.store.db.prepare('SELECT path,sha256 FROM semantic_files WHERE project_id=?').all(project.id).map((row) => [row.path, row.sha256]));
    const seen = new Set(); let changedFiles = 0; let reusedFiles = 0; let ignoredFiles = 0; let secretFilesIgnored = 0;
    const stamp = new Date().toISOString();
    for (const relative of files) {
      const clean = normalize(relative); seen.add(clean);
      if (SECRET_PATH.test(clean) || clean.split('/').some((part) => SKIP_DIRS.has(part))) { secretFilesIgnored += SECRET_PATH.test(clean) ? 1 : 0; ignoredFiles += 1; continue; }
      const absolute = path.join(project.workspaceRoot, clean);
      let info; try { info = await stat(absolute); } catch { ignoredFiles += 1; continue; }
      if (!info.isFile() || info.size > this.maxFileBytes) { ignoredFiles += 1; continue; }
      const buffer = await readFile(absolute);
      if (buffer.includes(0)) { ignoredFiles += 1; continue; }
      const digest = sha256(buffer);
      if (existing.get(clean) === digest) { reusedFiles += 1; continue; }
      const content = buffer.toString('utf8'); const language = languageFor(clean); const chunks = this.chunker.chunk({ path: clean, language, content });
      this.store.transaction(() => {
        this.store.db.prepare(`INSERT INTO semantic_files(project_id,path,sha256,language,bytes,indexed_at) VALUES(?,?,?,?,?,?) ON CONFLICT(project_id,path) DO UPDATE SET sha256=excluded.sha256,language=excluded.language,bytes=excluded.bytes,indexed_at=excluded.indexed_at`).run(project.id, clean, digest, language, buffer.length, stamp);
        this.store.db.prepare('DELETE FROM semantic_chunks WHERE project_id=? AND path=?').run(project.id, clean);
        this.store.db.prepare('DELETE FROM semantic_imports WHERE project_id=? AND source_path=?').run(project.id, clean);
        const insert = this.store.db.prepare('INSERT INTO semantic_chunks(project_id,chunk_id,path,start_line,end_line,kind,symbol,text,sha256,embedding_provider,embedding_json,indexed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
        for (const chunk of chunks) insert.run(project.id, chunk.id, clean, chunk.startLine, chunk.endLine, chunk.kind, chunk.symbol, chunk.text, chunk.sha256, null, null, stamp);
        const importInsert = this.store.db.prepare('INSERT OR IGNORE INTO semantic_imports(project_id,source_path,target_path) VALUES(?,?,?)');
        for (const target of importsFor(content, clean)) importInsert.run(project.id, clean, target);
      });
      changedFiles += 1;
    }
    for (const relative of existing.keys()) {
      if (!seen.has(relative) || SECRET_PATH.test(relative)) {
        this.store.db.prepare('DELETE FROM semantic_files WHERE project_id=? AND path=?').run(project.id, relative);
        this.store.db.prepare('DELETE FROM semantic_chunks WHERE project_id=? AND path=?').run(project.id, relative);
        this.store.db.prepare('DELETE FROM semantic_imports WHERE project_id=? AND source_path=?').run(project.id, relative);
      }
    }
    const fileRows = this.store.db.prepare('SELECT path,sha256,bytes FROM semantic_files WHERE project_id=? ORDER BY path').all(project.id);
    const knownPaths = new Set(fileRows.map((row) => row.path));
    const imports = this.store.db.prepare('SELECT source_path,target_path FROM semantic_imports WHERE project_id=?').all(project.id);
    this.store.transaction(() => {
      this.store.db.prepare('DELETE FROM semantic_imports WHERE project_id=?').run(project.id);
      const insert = this.store.db.prepare('INSERT OR IGNORE INTO semantic_imports(project_id,source_path,target_path) VALUES(?,?,?)');
      for (const edge of imports) { const resolved = resolveImport(edge.target_path, knownPaths); if (resolved) insert.run(project.id, edge.source_path, resolved); }
    });
    const tree = buildMerkleTree(fileRows); const simhash = similarityHash(fileRows);
    const chunkRows = this.store.db.prepare('SELECT chunk_id AS chunkId,path,sha256 FROM semantic_chunks WHERE project_id=? ORDER BY path,start_line').all(project.id);
    const chunkTree = buildChunkMerkleTree(chunkRows);
    const totalChunks = chunkRows.length;
    const embeddedChunks = Number(this.store.db.prepare('SELECT COUNT(*) AS n FROM semantic_chunks WHERE project_id=? AND embedding_json IS NOT NULL').get(project.id).n);
    const phase = deferEmbeddings && embeddedChunks < totalChunks ? 'lexical-ready' : (embeddedChunks === totalChunks && totalChunks > 0 ? 'ready' : 'lexical-ready');
    const branch = branchContext?.branch == null ? null : String(branchContext.branch);
    const headSha = branchContext?.headSha == null ? null : String(branchContext.headSha);
    const dirtyHash = branchContext?.dirtyHash == null ? null : String(branchContext.dirtyHash);
    const branchFingerprint = sha256(JSON.stringify({ branch, headSha, dirtyHash }));
    this.store.db.prepare(`INSERT INTO semantic_index_state(project_id,root_sha256,similarity_hash,phase,total_files,total_chunks,embedded_chunks,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(project_id) DO UPDATE SET root_sha256=excluded.root_sha256,similarity_hash=excluded.similarity_hash,phase=excluded.phase,total_files=excluded.total_files,total_chunks=excluded.total_chunks,embedded_chunks=excluded.embedded_chunks,updated_at=excluded.updated_at`).run(project.id, tree.rootSha256, simhash, phase, fileRows.length, totalChunks, embeddedChunks, stamp);
    this.store.db.prepare(`INSERT INTO semantic_index_provenance(project_id,chunk_root_sha256,branch,head_sha,dirty_hash,branch_fingerprint,provider_model_sha256,tool_schema_revision,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(project_id) DO UPDATE SET chunk_root_sha256=excluded.chunk_root_sha256,branch=excluded.branch,head_sha=excluded.head_sha,dirty_hash=excluded.dirty_hash,branch_fingerprint=excluded.branch_fingerprint,provider_model_sha256=excluded.provider_model_sha256,tool_schema_revision=excluded.tool_schema_revision,updated_at=excluded.updated_at`).run(project.id, chunkTree.rootSha256, branch, headSha, dirtyHash, branchFingerprint, this.embeddingProvider.modelSha256 ?? null, this.toolSchemaRevision, stamp);
    let completion = { ...this.state(project.id), reusedEmbeddings: embeddedChunks };
    if (!deferEmbeddings) completion = await this.completeEmbeddings(project.id);
    return Object.freeze({ ...completion, scannedFiles: files.length, changedFiles, reusedFiles, ignoredFiles, secretFilesIgnored, limited: files.length >= this.maxFiles });
  }

  async completeEmbeddings(projectId) {
    const id = String(projectId); const providerId = String(this.embeddingProvider.id);
    const modelSha256 = String(this.embeddingProvider.modelSha256 ?? 'none');
    const providerKey = `${providerId}@${modelSha256}@${QUANTIZED_VECTOR_REVISION}`;
    const rows = this.store.db.prepare('SELECT chunk_id,sha256,text FROM semantic_chunks WHERE project_id=? AND (embedding_json IS NULL OR embedding_provider<>?) ORDER BY path,start_line').all(id, providerKey);
    let reusedEmbeddings = Number(this.store.db.prepare('SELECT COUNT(*) AS n FROM semantic_chunks WHERE project_id=? AND embedding_provider=? AND embedding_json IS NOT NULL').get(id, providerKey).n); let generatedEmbeddings = 0;
    const missing = [];
    for (const row of rows) {
      const cached = this.store.db.prepare('SELECT revision,dimensions,scale,vector_blob FROM semantic_vector_cache WHERE chunk_sha256=? AND provider_id=? AND model_sha256=? AND revision=?').get(row.sha256, providerId, modelSha256, QUANTIZED_VECTOR_REVISION);
      if (cached) {
        const vector = decodeQuantizedVector({ revision: cached.revision, dimensions: Number(cached.dimensions), scale: Number(cached.scale), bytes: cached.vector_blob });
        this.store.db.prepare('UPDATE semantic_chunks SET embedding_provider=?,embedding_json=? WHERE project_id=? AND chunk_id=?').run(providerKey, JSON.stringify(vector), id, row.chunk_id);
        reusedEmbeddings += 1;
      } else missing.push(row);
    }
    const batchSize = 64;
    for (let offset = 0; offset < missing.length; offset += batchSize) {
      const batch = missing.slice(offset, offset + batchSize);
      const vectors = await this.embeddingProvider.embed(batch.map((row) => row.text));
      if (!Array.isArray(vectors) || vectors.length !== batch.length) throw new Error('Embedding provider returned an invalid batch');
      this.store.transaction(() => {
        const cache = this.store.db.prepare('INSERT OR REPLACE INTO semantic_vector_cache(chunk_sha256,provider_id,model_sha256,revision,dimensions,scale,vector_blob,created_at) VALUES(?,?,?,?,?,?,?,?)');
        const legacyCache = this.store.db.prepare('INSERT OR REPLACE INTO semantic_embedding_cache(sha256,provider_id,embedding_json,created_at) VALUES(?,?,?,?)');
        const update = this.store.db.prepare('UPDATE semantic_chunks SET embedding_provider=?,embedding_json=? WHERE project_id=? AND chunk_id=?');
        for (let index = 0; index < batch.length; index += 1) {
          const vector = vectors[index].map(Number); const json = JSON.stringify(vector); const encoded = encodeQuantizedVector(vector); const stamp = new Date().toISOString();
          cache.run(batch[index].sha256, providerId, modelSha256, encoded.revision, encoded.dimensions, encoded.scale, encoded.bytes, stamp);
          legacyCache.run(batch[index].sha256, providerKey, json, stamp);
          update.run(providerKey, json, id, batch[index].chunk_id); generatedEmbeddings += 1;
        }
      });
    }
    const totalChunks = Number(this.store.db.prepare('SELECT COUNT(*) AS n FROM semantic_chunks WHERE project_id=?').get(id).n);
    const embeddedChunks = Number(this.store.db.prepare('SELECT COUNT(*) AS n FROM semantic_chunks WHERE project_id=? AND embedding_json IS NOT NULL').get(id).n);
    this.store.db.prepare('UPDATE semantic_index_state SET phase=?,total_chunks=?,embedded_chunks=?,updated_at=? WHERE project_id=?').run(embeddedChunks === totalChunks ? 'ready' : 'lexical-ready', totalChunks, embeddedChunks, new Date().toISOString(), id);
    return Object.freeze({ ...this.state(id), reusedEmbeddings, generatedEmbeddings });
  }

  async search(projectId, query, { limit = 20, pathPrefix = null, language = null } = {}) {
    const id = String(projectId); const terms = queryTerms(query);
    const clauses = ['project_id=?']; const values = [id];
    if (pathPrefix) { clauses.push('path LIKE ?'); values.push(`${normalize(pathPrefix)}%`); }
    const rows = this.store.db.prepare(`SELECT * FROM semantic_chunks WHERE ${clauses.join(' AND ')} ORDER BY path,start_line`).all(...values);
    const indegree = new Map();
    for (const edge of this.store.db.prepare('SELECT target_path,COUNT(*) AS n FROM semantic_imports WHERE project_id=? GROUP BY target_path').all(id)) indegree.set(edge.target_path, Number(edge.n));
    const queryKey = sha256(String(query).trim().toLowerCase());
    const feedback = new Map(this.store.db.prepare('SELECT chunk_sha256,successes,failures FROM semantic_feedback WHERE project_id=? AND query_key=?').all(id, queryKey).map((row) => [row.chunk_sha256, row]));
    const providerId = String(this.embeddingProvider.id);
    const modelSha256 = String(this.embeddingProvider.modelSha256 ?? 'none');
    const providerKey = `${providerId}@${modelSha256}@${QUANTIZED_VECTOR_REVISION}`;
    const queryVector = (await this.embeddingProvider.embed([String(query)]))[0];
    const queryLower = String(query).toLowerCase();
    const preliminary = [];
    for (const row of rows) {
      const fileLanguage = this.store.db.prepare('SELECT language FROM semantic_files WHERE project_id=? AND path=?').get(id, row.path)?.language ?? 'text';
      if (language && fileLanguage !== language) continue;
      const lex = lexicalScore(row.text, row.path, query, terms);
      const symbolLower = String(row.symbol ?? '').toLowerCase();
      const symbolMatch = symbolLower ? Math.min(1, terms.filter((term) => symbolLower.includes(term) || term.includes(symbolLower)).length / Math.max(1, terms.length)) : 0;
      const graph = Math.min(1, Math.log1p(indegree.get(row.path) ?? 0) / 3);
      const prior = feedback.get(row.sha256); const feedbackScore = prior ? Math.max(-0.25, Math.min(0.25, (Number(prior.successes) - Number(prior.failures)) / 20)) : 0;
      const testRelation = /test|spec/.test(queryLower) && /(?:test|spec)/i.test(row.path) ? 1 : 0;
      const existingVector = row.embedding_provider === providerKey ? parseJson(row.embedding_json, null) : null;
      const preliminarySemantic = existingVector ? Math.max(0, cosineSimilarity(queryVector, existingVector)) : 0;
      const preliminaryScore = preliminarySemantic * 0.5 + lex.lexical * 0.28 + lex.path * 0.06 + symbolMatch * 0.12 + graph * 0.03 + testRelation * 0.01;
      if (preliminaryScore <= 0 && terms.length) continue;
      preliminary.push({ row, fileLanguage, lex, symbolMatch, graph, feedbackScore, testRelation, preliminarySemantic, preliminaryScore });
    }
    preliminary.sort((left, right) => right.preliminaryScore - left.preliminaryScore || left.row.path.localeCompare(right.row.path) || Number(left.row.start_line) - Number(right.row.start_line));
    const candidates = preliminary.slice(0, this.maxSearchCandidates);
    let embeddedCandidates = 0;
    const missing = candidates.filter(({ row }) => row.embedding_json == null || row.embedding_provider !== providerKey);
    if (missing.length) {
      const vectors = await this.embeddingProvider.embed(missing.map(({ row }) => row.text));
      this.store.transaction(() => {
        const cache = this.store.db.prepare('INSERT OR REPLACE INTO semantic_vector_cache(chunk_sha256,provider_id,model_sha256,revision,dimensions,scale,vector_blob,created_at) VALUES(?,?,?,?,?,?,?,?)');
        const update = this.store.db.prepare('UPDATE semantic_chunks SET embedding_provider=?,embedding_json=? WHERE project_id=? AND chunk_id=?');
        for (let index = 0; index < missing.length; index += 1) {
          const vector = vectors[index].map(Number); const encoded = encodeQuantizedVector(vector); const stamp = new Date().toISOString();
          cache.run(missing[index].row.sha256, providerId, modelSha256, encoded.revision, encoded.dimensions, encoded.scale, encoded.bytes, stamp);
          update.run(providerKey, JSON.stringify(vector), id, missing[index].row.chunk_id);
          missing[index].row.embedding_provider = providerKey; missing[index].row.embedding_json = JSON.stringify(vector); embeddedCandidates += 1;
        }
      });
    }
    const ranked = this.reranker.rank(query, candidates.map(({ row, fileLanguage, lex, symbolMatch, graph, feedbackScore, testRelation }) => {
      const vector = parseJson(row.embedding_json, null);
      return {
        chunkId: row.chunk_id, path: row.path, language: fileLanguage, kind: row.kind, symbol: row.symbol,
        startLine: Number(row.start_line), endLine: Number(row.end_line), preview: row.text.slice(0, 4_000), contentSha256: row.sha256,
        semantic: vector ? Math.max(0, cosineSimilarity(queryVector, vector)) : 0,
        lexical: lex.lexical, pathScore: lex.path, symbolMatch, definition: row.kind === 'function' || row.kind === 'class' || row.kind === 'method',
        graph, feedback: feedbackScore, testRelation, freshness: 1,
      };
    }), { provider: { id: providerId, degraded: this.embeddingProvider.degraded === true } });
    const items = ranked.slice(0, Math.max(1, Math.min(200, Number(limit) || 20))).map((item) => Object.freeze({
      chunkId: item.chunkId, path: item.path, language: item.language, kind: item.kind, symbol: item.symbol,
      startLine: item.startLine, endLine: item.endLine, preview: item.preview, contentSha256: item.contentSha256,
      score: item.score, scoreBreakdown: item.scoreBreakdown,
    }));
    return Object.freeze({
      schema: 'forge.semantic-search.v2', query: String(query), indexState: this.state(id), items: Object.freeze(items),
      retrieval: Object.freeze({ candidateCount: candidates.length, scannedChunks: rows.length, embeddedCandidates, maxCandidates: this.maxSearchCandidates, providerId, modelSha256: this.embeddingProvider.modelSha256 ?? null, degraded: this.embeddingProvider.degraded === true }),
    });
  }

  recordFeedback(projectId, query, chunkSha256, { accepted = true } = {}) {
    const stamp = new Date().toISOString(); const queryKey = sha256(String(query).trim().toLowerCase());
    this.store.db.prepare(`INSERT INTO semantic_feedback(project_id,query_key,chunk_sha256,successes,failures,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(project_id,query_key,chunk_sha256) DO UPDATE SET successes=successes+excluded.successes,failures=failures+excluded.failures,updated_at=excluded.updated_at`).run(String(projectId), queryKey, String(chunkSha256), accepted ? 1 : 0, accepted ? 0 : 1, stamp);
  }

  exportSnapshot(projectId) {
    const id = String(projectId); const state = this.state(id);
    const files = this.store.db.prepare('SELECT path,sha256,language,bytes FROM semantic_files WHERE project_id=? ORDER BY path').all(id).map((row) => Object.freeze({ path: row.path, sha256: row.sha256, language: row.language, bytes: Number(row.bytes) }));
    const chunks = this.store.db.prepare('SELECT chunk_id,path,start_line,end_line,kind,symbol,text,sha256,embedding_provider,embedding_json FROM semantic_chunks WHERE project_id=? ORDER BY path,start_line').all(id).map((row) => Object.freeze({ chunkId: row.chunk_id, path: row.path, startLine: Number(row.start_line), endLine: Number(row.end_line), kind: row.kind, symbol: row.symbol, text: row.text, sha256: row.sha256, embeddingProvider: row.embedding_provider, embedding: parseJson(row.embedding_json, null) }));
    return Object.freeze({ schema: 'forge.semantic-index-snapshot.v2', rootSha256: state.rootSha256, chunkRootSha256: state.chunkRootSha256, similarityHash: state.similarityHash, providerId: this.embeddingProvider.id, provenance: state.provenance, files: Object.freeze(files), chunks: Object.freeze(chunks) });
  }

  reuseSnapshot(project, snapshot, proofs = {}, { branchContext = null, toolSchemaRevision = this.toolSchemaRevision } = {}) {
    if (!project?.id || !['forge.semantic-index-snapshot.v1', 'forge.semantic-index-snapshot.v2'].includes(snapshot?.schema)) throw new TypeError('project and semantic snapshot are required');
    const currentModelSha256 = this.embeddingProvider.modelSha256 ?? null;
    if (snapshot.provenance && branchContext) {
      const currentFingerprint = sha256(JSON.stringify({ branch: branchContext.branch == null ? null : String(branchContext.branch), headSha: branchContext.headSha == null ? null : String(branchContext.headSha), dirtyHash: branchContext.dirtyHash == null ? null : String(branchContext.dirtyHash) }));
      if (currentFingerprint !== snapshot.provenance.branchFingerprint) return Object.freeze({ schema: 'forge.semantic-snapshot-reuse.v2', projectId: project.id, importedFiles: 0, rejectedFiles: snapshot.files.length, importedChunks: 0, rootSha256: null, reason: 'branch-context-mismatch' });
    }
    if (snapshot.provenance?.toolSchemaRevision && String(toolSchemaRevision) !== snapshot.provenance.toolSchemaRevision) return Object.freeze({ schema: 'forge.semantic-snapshot-reuse.v2', projectId: project.id, importedFiles: 0, rejectedFiles: snapshot.files.length, importedChunks: 0, rootSha256: null, reason: 'tool-schema-mismatch' });
    if (snapshot.provenance?.providerModelSha256 && currentModelSha256 && currentModelSha256 !== snapshot.provenance.providerModelSha256) return Object.freeze({ schema: 'forge.semantic-snapshot-reuse.v2', projectId: project.id, importedFiles: 0, rejectedFiles: snapshot.files.length, importedChunks: 0, rootSha256: null, reason: 'embedding-model-mismatch' });
    const allowed = new Map(snapshot.files.filter((file) => String(proofs[file.path] ?? '') === file.sha256).map((file) => [file.path, file]));
    const stamp = new Date().toISOString();
    this.store.transaction(() => {
      const fileInsert = this.store.db.prepare('INSERT OR REPLACE INTO semantic_files(project_id,path,sha256,language,bytes,indexed_at) VALUES(?,?,?,?,?,?)');
      const chunkInsert = this.store.db.prepare('INSERT OR REPLACE INTO semantic_chunks(project_id,chunk_id,path,start_line,end_line,kind,symbol,text,sha256,embedding_provider,embedding_json,indexed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
      for (const file of allowed.values()) fileInsert.run(project.id, file.path, file.sha256, file.language, file.bytes, stamp);
      for (const chunk of snapshot.chunks) {
        if (!allowed.has(chunk.path)) continue;
        chunkInsert.run(project.id, chunk.chunkId, chunk.path, chunk.startLine, chunk.endLine, chunk.kind, chunk.symbol, chunk.text, chunk.sha256, chunk.embeddingProvider, chunk.embedding == null ? null : JSON.stringify(chunk.embedding), stamp);
      }
    });
    const files = [...allowed.values()]; const tree = buildMerkleTree(files); const totalChunks = Number(this.store.db.prepare('SELECT COUNT(*) AS n FROM semantic_chunks WHERE project_id=?').get(project.id).n); const embeddedChunks = Number(this.store.db.prepare('SELECT COUNT(*) AS n FROM semantic_chunks WHERE project_id=? AND embedding_json IS NOT NULL').get(project.id).n);
    this.store.db.prepare('INSERT OR REPLACE INTO semantic_index_state(project_id,root_sha256,similarity_hash,phase,total_files,total_chunks,embedded_chunks,updated_at) VALUES(?,?,?,?,?,?,?,?)').run(project.id, tree.rootSha256, similarityHash(files), embeddedChunks === totalChunks && totalChunks > 0 ? 'ready' : 'lexical-ready', files.length, totalChunks, embeddedChunks, stamp);
    return Object.freeze({ schema: 'forge.semantic-snapshot-reuse.v1', projectId: project.id, importedFiles: files.length, rejectedFiles: snapshot.files.length - files.length, importedChunks: totalChunks, rootSha256: tree.rootSha256 });
  }
}
