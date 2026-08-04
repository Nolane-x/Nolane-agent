import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import { CodebaseKnowledgeGraphService } from '../src/repository/codebase-knowledge-graph-service.mjs';
import { CodebaseKnowledgeWatcher } from '../src/repository/codebase-knowledge-watcher.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';

const execFileAsync = promisify(execFile);

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-codebase-knowledge-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src'), { recursive: true });
  await mkdir(path.join(root, 'tests'), { recursive: true });
  await mkdir(path.join(root, 'db'), { recursive: true });
  await writeFile(path.join(root, 'src', 'auth.mjs'), `export function verifyToken(token) { return Boolean(token); }\nexport function login(token) { return verifyToken(token); }\n`);
  await writeFile(path.join(root, 'src', 'api.mjs'), `import { login } from './auth.mjs';\nexport function registerApi(app) {\n  app.post('/api/login', (req) => login(req.token));\n  app.get('/api/health', () => ({ ok: true }));\n}\n`);
  await writeFile(path.join(root, 'src', 'users.py'), `from fastapi import APIRouter\nrouter = APIRouter()\n@router.get('/api/users')\ndef list_users():\n    return []\n`);
  await writeFile(path.join(root, 'db', 'schema.prisma'), `model User {\n  id Int @id\n  email String\n}\n`);
  await writeFile(path.join(root, 'db', 'audit.sql'), `CREATE TABLE audit_events (id INTEGER PRIMARY KEY, message TEXT);\n`);
  await writeFile(path.join(root, 'tests', 'auth.test.mjs'), `import { login } from '../src/auth.mjs';\nexport function testLogin() { return login('token'); }\n`);
  await execFileAsync('git', ['init'], { cwd: root });
  await execFileAsync('git', ['config', 'user.email', 'forge@example.test'], { cwd: root });
  await execFileAsync('git', ['config', 'user.name', 'Forge Test'], { cwd: root });
  await execFileAsync('git', ['add', '.'], { cwd: root });
  await execFileAsync('git', ['commit', '-m', 'initial'], { cwd: root, env: { ...process.env, GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z' } });
  await writeFile(path.join(root, 'src', 'api.mjs'), `import { login } from './auth.mjs';\nexport function registerApi(app) {\n  app.post('/api/login', (req) => login(req.token));\n  app.get('/api/health', () => ({ ok: true }));\n  app.delete('/api/session', () => true);\n}\n`);
  await execFileAsync('git', ['add', 'src/api.mjs'], { cwd: root });
  await execFileAsync('git', ['commit', '-m', 'add session endpoint'], { cwd: root, env: { ...process.env, GIT_AUTHOR_DATE: '2026-07-01T00:00:00Z', GIT_COMMITTER_DATE: '2026-07-01T00:00:00Z' } });
  const store = new StudioStore(path.join(root, '.forge-test.db')); t.after(() => store.close());
  const project = store.createProject({ name: 'Knowledge', workspaceRoot: root });
  return { root, store, project };
}

test('indexes routes, API endpoints, database models, references, calls, tests, and Git history with direct evidence', async (t) => {
  const { store, project } = await fixture(t);
  const service = new CodebaseKnowledgeGraphService({ store, maxFiles: 100 });
  const result = await service.index(project);
  assert.equal(result.indexed > 0, true);
  const snapshot = service.snapshot(project.id, { limit: 500 });
  assert.ok(snapshot.entities.some((item) => item.kind === 'route' && item.name === 'POST /api/login' && item.path === 'src/api.mjs' && item.line > 0));
  assert.ok(snapshot.entities.some((item) => item.kind === 'api_endpoint' && item.name === 'GET /api/users' && item.path === 'src/users.py'));
  assert.ok(snapshot.entities.some((item) => item.kind === 'database_model' && item.name === 'User' && item.path === 'db/schema.prisma'));
  assert.ok(snapshot.entities.some((item) => item.kind === 'database_model' && item.name === 'audit_events' && item.path === 'db/audit.sql'));
  assert.ok(snapshot.edges.some((edge) => edge.kind === 'reference' && edge.toName === 'login' && edge.fromPath === 'src/api.mjs'));
  assert.ok(snapshot.edges.some((edge) => edge.kind === 'call' && edge.fromName === 'login' && edge.toName === 'verifyToken' && edge.confidence === 'conservative-lexical'));
  assert.ok(snapshot.edges.some((edge) => edge.kind === 'test_relation' && edge.fromPath === 'tests/auth.test.mjs' && edge.toPath === 'src/auth.mjs'));
  const history = snapshot.history.find((item) => item.path === 'src/api.mjs');
  assert.equal(history.commitCount, 2);
  assert.match(history.lastCommitAt, /^2026-07-01/);
  for (const item of [...snapshot.entities, ...snapshot.edges]) {
    assert.ok(item.path ?? item.fromPath);
    assert.ok(item.detector);
    assert.ok(item.confidence);
  }
});

test('supports bounded regex, incremental reuse, and ranking by dependency distance, Git recency, and test relation', async (t) => {
  const { root, store, project } = await fixture(t);
  const service = new CodebaseKnowledgeGraphService({ store, maxFiles: 100 });
  const first = await service.index(project);
  const second = await service.index(project);
  assert.equal(second.indexed, 0);
  assert.equal(second.reused, first.scanned - first.ignored);
  const matches = service.searchRegex(project.id, 'app\\.(?:post|get)', { flags: 'g', limit: 20 });
  assert.ok(matches.some((item) => item.path === 'src/api.mjs' && item.line === 3));
  assert.throws(() => service.searchRegex(project.id, '(a+)+$', { limit: 20 }), /unsafe regex/i);
  const ranked = service.rank(project.id, 'login authentication', { seedPaths: ['src/api.mjs'], limit: 10 });
  const auth = ranked.items.find((item) => item.path === 'src/auth.mjs');
  const api = ranked.items.find((item) => item.path === 'src/api.mjs');
  const testFile = ranked.items.find((item) => item.path === 'tests/auth.test.mjs');
  assert.ok(auth.scoreBreakdown.dependencyDistance > 0);
  assert.ok(api.scoreBreakdown.gitRecency > 0);
  assert.ok(testFile.scoreBreakdown.testRelation > 0);
  await writeFile(path.join(root, 'src', 'auth.mjs'), `export function verifyToken(token) { return Boolean(token); }\nexport function login(token) { return verifyToken(token); }\nexport function logout() { return true; }\n`);
  const changed = await service.index(project);
  assert.equal(changed.indexed, 1);
  assert.ok(changed.changedPaths.includes('src/auth.mjs'));
});

test('portable watcher refreshes changed repositories once and stops cleanly', async (t) => {
  const { root, store, project } = await fixture(t);
  const service = new CodebaseKnowledgeGraphService({ store, maxFiles: 100 });
  await service.index(project);
  const events = [];
  const watcher = new CodebaseKnowledgeWatcher({ service, intervalMs: 30, debounceMs: 20, onIndexed: (event) => events.push(event) });
  t.after(() => watcher.close());
  await watcher.start(project);
  await writeFile(path.join(root, 'src', 'new-route.mjs'), `export function attach(app) { app.get('/api/new', () => true); }\n`);
  const deadline = Date.now() + 3_000;
  while (!events.length && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(events.length, 1);
  assert.ok(service.snapshot(project.id).entities.some((item) => item.name === 'GET /api/new'));
  await watcher.stop(project.id);
  await writeFile(path.join(root, 'src', 'after-stop.mjs'), `export const stopped = true;\n`);
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(events.length, 1);
  assert.equal(watcher.status(project.id).state, 'stopped');
});
