import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { AdaptiveRepositoryIntelligence } from '../src/repository/adaptive-repository-intelligence.mjs';
import { RepositoryIndex } from '../src/repository/repository-index.mjs';
import { SecureSemanticIndex } from '../src/repository/secure-semantic-index.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-adaptive-repo-'));
  await writeFile(path.join(root, 'auth.mjs'), 'export function authenticateUser(token) { return token === "ok"; }\n');
  await writeFile(path.join(root, 'billing.mjs'), 'export function chargeCard() { return true; }\n');
  const store = new StudioStore(path.join(root, 'studio.db')); t.after(() => store.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = store.createProject({ name: 'P', workspaceRoot: root });
  return { project, intelligence: new AdaptiveRepositoryIntelligence({ lexicalIndex: new RepositoryIndex({ store }), semanticIndex: new SecureSemanticIndex({ store }) }) };
}

test('AdaptiveRepositoryIntelligence indexes once and merges lexical and semantic task context with evidence', async (t) => {
  const f = await fixture(t);
  const indexed = await f.intelligence.index(f.project);
  assert.match(indexed.semantic.rootSha256, /^[a-f0-9]{64}$/);
  const context = await f.intelligence.contextForTask(f.project.id, { objective: 'Where is login authentication handled?', maxChars: 10_000, maxFiles: 5 });
  assert.equal(context.items[0].path, 'auth.mjs');
  assert.match(context.items[0].text, /authenticateUser/);
  assert.match(context.items[0].sha256, /^[a-f0-9]{64}$/);
  assert.equal(context.items[0].sources.includes('semantic'), true);
});

test('AdaptiveRepositoryIntelligence exposes async hybrid search and feedback', async (t) => {
  const f = await fixture(t); await f.intelligence.index(f.project);
  const result = await f.intelligence.search(f.project.id, 'payment card charge', { limit: 5 });
  assert.equal(result.items[0].path, 'billing.mjs');
  assert.ok(result.retrieval.candidateCount >= 1);
  assert.equal(result.semanticState, 'active');
  f.intelligence.recordFeedback(f.project.id, 'payment card charge', result.items[0].contentSha256, { accepted: true });
  const again = await f.intelligence.search(f.project.id, 'payment card charge', { limit: 5 });
  assert.ok(again.items[0].scoreBreakdown.feedback > 0);
  assert.equal(f.intelligence.symbols(f.project.id, { query: 'charge' })[0].name, 'chargeCard');
});
