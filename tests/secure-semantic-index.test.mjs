import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { StudioStore } from '../src/storage/studio-store.mjs';
import { SyntaxChunker } from '../src/repository/syntax-chunker.mjs';
import { SecureSemanticIndex } from '../src/repository/secure-semantic-index.mjs';

class MeaningEmbeddingProvider {
  id = 'test-code-embedding-v1';
  async embed(texts) {
    return texts.map((text) => {
      const value = String(text).toLowerCase();
      if (/auth|login|sign in|session|credential/.test(value)) return [1, 0, 0];
      if (/invoice|payment|billing|charge/.test(value)) return [0, 1, 0];
      return [0, 0, 1];
    });
  }
}

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-semantic-index-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src'), { recursive: true });
  await writeFile(path.join(root, 'src', 'auth.mjs'), `import { verifyToken } from './token.mjs';\nexport function createSession(credentials) {\n  return verifyToken(credentials);\n}\n`);
  await writeFile(path.join(root, 'src', 'token.mjs'), `export function verifyToken(value) {\n  return Boolean(value);\n}\n`);
  await writeFile(path.join(root, 'src', 'billing.mjs'), `export function createInvoice(amount) {\n  return { amount, paid: false };\n}\n`);
  await writeFile(path.join(root, '.env'), 'SECRET=never-index-this');
  const store = new StudioStore(path.join(root, '.forge-test.db'));
  t.after(() => store.close());
  const project = store.createProject({ id: 'project_semantic', name: 'Semantic', workspaceRoot: root });
  return { root, store, project };
}

test('SyntaxChunker emits complete symbol-aware chunks with exact line ranges', () => {
  const chunker = new SyntaxChunker({ maxChunkChars: 2_000 });
  const chunks = chunker.chunk({ path: 'src/example.mjs', language: 'javascript', content: `const top = 1;\nexport function alpha(a) {\n  return a + top;\n}\nclass Beta {\n  run() { return alpha(1); }\n}\n` });
  assert.equal(chunks.some((chunk) => chunk.symbol === 'alpha' && chunk.startLine === 2 && chunk.endLine === 4), true);
  assert.equal(chunks.some((chunk) => chunk.symbol === 'Beta' && chunk.startLine === 5 && chunk.endLine === 7), true);
  assert.equal(chunks.every((chunk) => chunk.text.length > 0 && chunk.sha256.length === 64), true);
});

test('SecureSemanticIndex supports lexical-first querying, deferred embeddings, hybrid ranking, and incremental reuse', async (t) => {
  const { root, store, project } = await fixture(t);
  const index = new SecureSemanticIndex({ store, embeddingProvider: new MeaningEmbeddingProvider() });

  const first = await index.index(project, { deferEmbeddings: true });
  assert.equal(first.phase, 'lexical-ready');
  assert.match(first.rootSha256, /^[a-f0-9]{64}$/);
  assert.equal(first.secretFilesIgnored, 1);

  const early = await index.search(project.id, 'create invoice', { limit: 3 });
  assert.equal(early.items[0].path, 'src/billing.mjs');
  assert.equal(early.indexState.phase, 'lexical-ready');

  const completed = await index.completeEmbeddings(project.id);
  assert.equal(completed.phase, 'ready');
  assert.equal(completed.embeddedChunks, completed.totalChunks);

  const semantic = await index.search(project.id, 'where do users sign in', { limit: 3 });
  assert.equal(semantic.items[0].path, 'src/auth.mjs');
  assert.ok(semantic.items[0].scoreBreakdown.semantic > 0.9);
  assert.ok(semantic.items[0].startLine >= 1);
  assert.match(semantic.items[0].contentSha256, /^[a-f0-9]{64}$/);
  assert.equal(semantic.items.some((item) => item.preview.includes('never-index-this')), false);

  const second = await index.index(project);
  assert.equal(second.changedFiles, 0);
  assert.ok(second.reusedFiles >= 3);
  assert.ok(second.reusedEmbeddings > 0);

  await writeFile(path.join(root, 'src', 'billing.mjs'), `export function createInvoice(amount, currency = 'USD') {\n  return { amount, currency, paid: false };\n}\n`);
  const third = await index.index(project);
  assert.equal(third.changedFiles, 1);
  assert.notEqual(third.rootSha256, first.rootSha256);
});

test('secure snapshot reuse requires local content proofs and never leaks unproved chunks', async (t) => {
  const { root, store, project } = await fixture(t);
  const source = new SecureSemanticIndex({ store, embeddingProvider: new MeaningEmbeddingProvider() });
  await source.index(project);
  const snapshot = source.exportSnapshot(project.id);
  assert.match(snapshot.similarityHash, /^[a-f0-9]{16}$/);

  const otherRoot = await mkdtemp(path.join(os.tmpdir(), 'forge-semantic-target-'));
  t.after(() => rm(otherRoot, { recursive: true, force: true }));
  const otherStore = new StudioStore(path.join(otherRoot, 'target.db'));
  t.after(() => otherStore.close());
  const otherProject = otherStore.createProject({ id: 'project_target', name: 'Target', workspaceRoot: otherRoot });
  const target = new SecureSemanticIndex({ store: otherStore, embeddingProvider: new MeaningEmbeddingProvider() });

  const denied = target.reuseSnapshot(otherProject, snapshot, {});
  assert.equal(denied.importedFiles, 0);
  assert.equal((await target.search(otherProject.id, 'sign in')).items.length, 0);

  const proofs = Object.fromEntries(snapshot.files.map((file) => [file.path, file.sha256]));
  const accepted = target.reuseSnapshot(otherProject, snapshot, proofs);
  assert.equal(accepted.importedFiles, snapshot.files.length);
  assert.equal((await target.search(otherProject.id, 'sign in')).items[0].path, 'src/auth.mjs');
});

test('quantized cache is keyed by provider model digest and invalidates on model change', async (t) => {
  const { store, project } = await fixture(t);
  let callsA = 0;
  let callsB = 0;
  const providerA = { id: 'neural-test', kind: 'neural', degraded: false, dimensions: 3, modelSha256: 'a'.repeat(64), async embed(texts) { callsA += texts.length; return texts.map(() => [1, 0, 0]); } };
  const first = new SecureSemanticIndex({ store, embeddingProvider: providerA });
  await first.index(project);
  assert.ok(callsA > 0);
  const cacheRowsA = Number(store.db.prepare('SELECT COUNT(*) AS n FROM semantic_vector_cache WHERE model_sha256=?').get(providerA.modelSha256).n);
  assert.ok(cacheRowsA > 0);

  const before = callsA;
  await first.index(project);
  assert.equal(callsA, before);

  const providerB = { ...providerA, modelSha256: 'b'.repeat(64), async embed(texts) { callsB += texts.length; return texts.map(() => [0, 1, 0]); } };
  const second = new SecureSemanticIndex({ store, embeddingProvider: providerB });
  await second.completeEmbeddings(project.id);
  assert.ok(callsB > 0);
  const cacheRowsB = Number(store.db.prepare('SELECT COUNT(*) AS n FROM semantic_vector_cache WHERE model_sha256=?').get(providerB.modelSha256).n);
  assert.ok(cacheRowsB > 0);
});

test('semantic search narrows candidates before on-demand embedding and reports provider state', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-semantic-candidates-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src'), { recursive: true });
  for (let index = 0; index < 24; index += 1) await writeFile(path.join(root, 'src', `file-${index}.mjs`), `export function helper${index}() { return "generic ${index}"; }\n`);
  await writeFile(path.join(root, 'src', 'session.mjs'), 'export function validateSessionExpiration(token) { return token.expiresAt > Date.now(); }\n');
  const store = new StudioStore(path.join(root, 'studio.db')); t.after(() => store.close());
  const project = store.createProject({ id: 'candidate_project', name: 'Candidate', workspaceRoot: root });
  let embeddedTexts = 0;
  const provider = { id: 'neural-test', kind: 'neural', degraded: false, dimensions: 3, modelSha256: 'c'.repeat(64), async embed(texts) { embeddedTexts += texts.length; return texts.map((text) => /session|expiration/i.test(text) ? [1, 0, 0] : [0, 1, 0]); } };
  const index = new SecureSemanticIndex({ store, embeddingProvider: provider, maxSearchCandidates: 5 });
  await index.index(project, { deferEmbeddings: true });
  const result = await index.search(project.id, 'session expiration validation', { limit: 3 });
  assert.equal(result.items[0].path, 'src/session.mjs');
  assert.equal(result.retrieval.candidateCount <= 5, true);
  assert.equal(result.retrieval.embeddedCandidates <= 5, true);
  assert.equal(embeddedTexts <= 6, true); // candidates plus one query vector
  assert.equal(result.retrieval.providerId, 'neural-test');
  assert.equal(result.retrieval.degraded, false);
});

test('chunk merkle reuse preserves unchanged function vectors and snapshot reuse is branch-aware', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-chunk-merkle-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'module.mjs'), 'export function alpha() { return 1; }\nexport function beta() { return 2; }\n');
  const store = new StudioStore(path.join(root, 'studio.db')); t.after(() => store.close());
  const project = store.createProject({ id: 'chunk_project', name: 'Chunk', workspaceRoot: root });
  let embedded = 0;
  const provider = { id: 'neural-chunk', kind: 'neural', degraded: false, dimensions: 3, modelSha256: 'd'.repeat(64), async embed(texts) { embedded += texts.length; return texts.map((text) => /alpha/.test(text) ? [1, 0, 0] : [0, 1, 0]); } };
  const index = new SecureSemanticIndex({ store, embeddingProvider: provider, toolSchemaRevision: 'tools-v2' });
  const first = await index.index(project, { branchContext: { branch: 'feature/a', headSha: '1'.repeat(40), dirtyHash: 'clean' } });
  const firstEmbedded = embedded;
  assert.match(first.chunkRootSha256, /^[a-f0-9]{64}$/);

  await writeFile(path.join(root, 'module.mjs'), 'export function alpha() { return 3; }\nexport function beta() { return 2; }\n');
  const second = await index.index(project, { branchContext: { branch: 'feature/a', headSha: '2'.repeat(40), dirtyHash: 'dirty-1' } });
  assert.notEqual(second.chunkRootSha256, first.chunkRootSha256);
  assert.equal(second.generatedEmbeddings, 1);
  assert.ok(second.reusedEmbeddings >= 1);
  assert.equal(embedded, firstEmbedded + 1);

  const snapshot = index.exportSnapshot(project.id);
  assert.equal(snapshot.provenance.branch, 'feature/a');
  const otherRoot = await mkdtemp(path.join(os.tmpdir(), 'forge-chunk-target-'));
  t.after(() => rm(otherRoot, { recursive: true, force: true }));
  const targetStore = new StudioStore(path.join(otherRoot, 'target.db')); t.after(() => targetStore.close());
  const targetProject = targetStore.createProject({ id: 'chunk_target', name: 'Target', workspaceRoot: otherRoot });
  const target = new SecureSemanticIndex({ store: targetStore, embeddingProvider: provider, toolSchemaRevision: 'tools-v2' });
  const proofs = Object.fromEntries(snapshot.files.map((file) => [file.path, file.sha256]));
  const denied = target.reuseSnapshot(targetProject, snapshot, proofs, { branchContext: { branch: 'other', headSha: '2'.repeat(40), dirtyHash: 'dirty-1' }, toolSchemaRevision: 'tools-v2' });
  assert.equal(denied.importedFiles, 0);
  assert.equal(denied.reason, 'branch-context-mismatch');
});
