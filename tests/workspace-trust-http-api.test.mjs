import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createHttpServer } from '../src/server/http-server.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { SqliteWorkspaceTrustStore } from '../src/security/sqlite-workspace-trust-store.mjs';
import { WorkspaceTrustService } from '../src/security/workspace-trust-service.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';

const auth = (options = {}) => ({ ...options, headers: { authorization: 'Bearer trust-token', 'content-type': 'application/json', ...(options.headers ?? {}) } });

test('workspace trust API is authenticated, identity-bound, audited, and gates agent runs', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-workspace-trust-http-'));
  await writeFile(path.join(root, 'index.html'), '<!doctype html>');
  const workspaceRoot = path.join(root, 'repo'); await mkdir(path.join(workspaceRoot, '.git'), { recursive: true });
  const store = new StudioStore(path.join(root, 'studio.db')); t.after(() => store.close());
  const project = store.createProject({ name: 'Repo', workspaceRoot });
  const trustStore = new SqliteWorkspaceTrustStore(path.join(root, 'trust.db')); t.after(() => trustStore.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  const workspaceTrust = new WorkspaceTrustService({ storage: trustStore, projectResolver: (id) => store.getProject(id) });
  const runCalls = [];
  const environmentCalls = [];
  const goalCalls = [];
  const runCoordinator = { createRun(input) { runCalls.push(input); return { mission: { id: 'm1', projectId: input.projectId } }; } };
  const environmentControl = {
    list() { return []; },
    async register(spec) { environmentCalls.push(['register', spec]); return { id: 'env1', projectId: spec.projectId }; },
    async start(id, options) { environmentCalls.push(['start', id, options]); return { id, state: 'running' }; },
    async stop(id, options) { environmentCalls.push(['stop', id, options]); return { id, state: 'stopped' }; },
  };
  const goalService = {
    create(input) { goalCalls.push(['create', input]); return { id: 'g1', ...input }; },
    get(id) { return id === 'g1' ? { id, projectId: project.id } : null; },
    list() { return []; },
  };
  const goalRunService = {
    async createAndStart(input) { goalCalls.push(['createAndStart', input]); return { goal: { id: 'g1', ...input }, run: { id: 'r1' } }; },
    async start(id, input) { goalCalls.push(['start', id, input]); return { goal: { id, projectId: project.id }, run: { id: 'r2' } }; },
  };
  const service = await createHttpServer({ config: { host: '127.0.0.1', port: 0, authToken: 'trust-token' }, store, providers: new ProviderRegistry(), missionRunner: {}, runCoordinator, workspaceTrust, environmentControl, goalService, goalRunService, uiRoot: root });
  t.after(() => service.close());

  assert.equal((await fetch(`${service.url}/api/workspace-trust/${project.id}`)).status, 401);
  const initial = await (await fetch(`${service.url}/api/workspace-trust/${project.id}`, auth())).json();
  assert.equal(initial.state, 'untrusted');
  const blocked = await fetch(`${service.url}/api/agent/runs`, auth({ method: 'POST', body: JSON.stringify({ projectId: project.id, objective: 'Inspect and edit' }) }));
  assert.equal(blocked.status, 409);
  assert.equal((await blocked.json()).code, 'WORKSPACE_TRUST_REQUIRED');
  assert.equal(runCalls.length, 0);

  const blockedEnvironment = await fetch(`${service.url}/api/environments/register`, auth({ method: 'POST', body: JSON.stringify({ projectId: project.id, id: 'env1', command: 'node', args: [] }) }));
  assert.equal(blockedEnvironment.status, 409);
  assert.equal(environmentCalls.length, 0);

  const draftGoal = await fetch(`${service.url}/api/goals`, auth({ method: 'POST', body: JSON.stringify({ projectId: project.id, objective: 'Draft only', start: false }) }));
  assert.equal(draftGoal.status, 201);
  assert.equal(goalCalls[0][0], 'create');
  const blockedGoal = await fetch(`${service.url}/api/goals`, auth({ method: 'POST', body: JSON.stringify({ projectId: project.id, objective: 'Run in background' }) }));
  assert.equal(blockedGoal.status, 409);
  assert.equal(goalCalls.filter((call) => call[0] === 'createAndStart').length, 0);

  const trusted = await (await fetch(`${service.url}/api/workspace-trust/${project.id}`, auth({ method: 'PUT', body: JSON.stringify({ reason: 'Reviewed repository and automation files' }) }))).json();
  assert.equal(trusted.state, 'trusted');
  assert.equal(trusted.actor, 'local-admin');
  assert.equal((await fetch(`${service.url}/api/agent/runs`, auth({ method: 'POST', body: JSON.stringify({ projectId: project.id, objective: 'Inspect and edit' }) }))).status, 201);
  assert.equal(runCalls.length, 1);
  assert.equal((await fetch(`${service.url}/api/environments/register`, auth({ method: 'POST', body: JSON.stringify({ projectId: project.id, id: 'env1', command: 'node', args: [] }) }))).status, 201);
  assert.equal(environmentCalls[0][0], 'register');
  assert.equal((await fetch(`${service.url}/api/goals`, auth({ method: 'POST', body: JSON.stringify({ projectId: project.id, objective: 'Run in background' }) }))).status, 201);
  assert.equal(goalCalls.filter((call) => call[0] === 'createAndStart').length, 1);

  const audit = await (await fetch(`${service.url}/api/workspace-trust/${project.id}/audit`, auth())).json();
  assert.equal(audit.length, 1);
  assert.equal(audit[0].actor, 'local-admin');
  const revoked = await (await fetch(`${service.url}/api/workspace-trust/${project.id}`, auth({ method: 'DELETE', body: JSON.stringify({ reason: 'Repository ownership changed' }) }))).json();
  assert.equal(revoked.state, 'untrusted');
  assert.equal((await fetch(`${service.url}/api/agent/runs`, auth({ method: 'POST', body: JSON.stringify({ projectId: project.id, objective: 'Run again' }) }))).status, 409);
});
