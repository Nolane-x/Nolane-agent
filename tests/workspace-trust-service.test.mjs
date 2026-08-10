import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { SqliteWorkspaceTrustStore } from '../src/security/sqlite-workspace-trust-store.mjs';
import { WorkspaceTrustService } from '../src/security/workspace-trust-service.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-workspace-trust-'));
  const workspaceRoot = path.join(root, 'workspace');
  await mkdir(path.join(workspaceRoot, '.git'), { recursive: true });
  const projects = new Map([['p1', { id: 'p1', workspaceRoot }]]);
  const file = path.join(root, 'trust.db');
  const storage = new SqliteWorkspaceTrustStore(file);
  const service = new WorkspaceTrustService({ storage, projectResolver: (id) => projects.get(String(id)) });
  t.after(async () => {
    storage.close();
    await rm(root, { recursive: true, force: true });
  });
  return { root, workspaceRoot, file, projects, storage, service };
}

test('workspace trust defaults to deny and persists an authenticated identity-bound decision', async (t) => {
  const f = await fixture(t);
  const initial = await f.service.status('p1');
  assert.equal(initial.state, 'untrusted');
  assert.equal(initial.reason, 'no-trust-decision');
  assert.equal(initial.features.instructions.allowed, false);
  assert.equal(initial.features.mcp.allowed, false);

  const trusted = await f.service.trust({ projectId: 'p1', principal: { subject: 'alice' }, reason: 'Reviewed repository source and hooks' });
  assert.equal(trusted.state, 'trusted');
  assert.equal(trusted.actor, 'alice');
  assert.match(trusted.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(trusted.features.instructions.allowed, true);

  f.storage.close();
  const reopenedStore = new SqliteWorkspaceTrustStore(f.file);
  t.after(() => reopenedStore.close());
  const reopened = new WorkspaceTrustService({ storage: reopenedStore, projectResolver: (id) => f.projects.get(String(id)) });
  assert.equal((await reopened.status('p1')).state, 'trusted');
  assert.equal((await reopened.audit({ projectId: 'p1' })).length, 1);
  reopenedStore.close();
});

test('workspace replacement invalidates trust and revoke takes effect immediately', async (t) => {
  const f = await fixture(t);
  await f.service.trust({ projectId: 'p1', principal: { subject: 'alice' }, reason: 'Reviewed' });
  await rename(f.workspaceRoot, `${f.workspaceRoot}-old`);
  await mkdir(path.join(f.workspaceRoot, '.git'), { recursive: true });
  const replaced = await f.service.status('p1');
  assert.equal(replaced.state, 'untrusted');
  assert.equal(replaced.reason, 'workspace-identity-changed');
  await assert.rejects(() => f.service.requireTrusted('p1', 'hooks'), (error) => error.code === 'WORKSPACE_TRUST_REQUIRED' && error.statusCode === 409);

  await f.service.trust({ projectId: 'p1', principal: { subject: 'bob' }, reason: 'Reviewed replacement' });
  const revoked = await f.service.revoke({ projectId: 'p1', principal: { subject: 'bob' }, reason: 'Repository source changed unexpectedly' });
  assert.equal(revoked.state, 'untrusted');
  assert.equal(revoked.reason, 'trust-revoked');
  assert.equal((await f.service.audit({ projectId: 'p1' })).length, 3);
});

test('workspace trust rejects anonymous decisions and bounds public reasons', async (t) => {
  const f = await fixture(t);
  await assert.rejects(() => f.service.trust({ projectId: 'p1', principal: {}, reason: 'Reviewed' }), /authenticated principal/i);
  await assert.rejects(() => f.service.trust({ projectId: 'p1', principal: { subject: 'alice' }, reason: '' }), /reason is required/i);
  await assert.rejects(() => f.service.status('missing'), /Unknown project/);
});
