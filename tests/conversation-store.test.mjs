import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { StudioStore } from '../src/storage/studio-store.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-studio-conversation-'));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = store.createProject({ name: 'App', workspaceRoot: root });
  const mission = store.createMission({ projectId: project.id, objective: 'Build a polished login flow', status: 'running' });
  return { root, store, project, mission };
}

test('StudioStore persists ordered conversation messages without exposing private metadata', async (t) => {
  const { store, project, mission } = await fixture(t);

  const first = store.createMessage({
    projectId: project.id,
    missionId: mission.id,
    role: 'user',
    content: 'Build the login flow',
    metadata: { clientMessageId: 'msg-client-1', secret: 'must-not-be-returned' },
  });
  const second = store.createMessage({
    projectId: project.id,
    missionId: mission.id,
    role: 'assistant',
    content: 'I am examining the authentication architecture.',
    status: 'streaming',
    metadata: { providerId: 'codex', private: { apiKey: 'sk-secret' } },
  });

  const messages = store.listMessages({ missionId: mission.id });
  assert.deepEqual(messages.map((item) => item.id), [first.id, second.id]);
  assert.deepEqual(messages.map((item) => item.role), ['user', 'assistant']);
  assert.equal(messages[1].status, 'streaming');
  assert.equal(messages[0].metadata.clientMessageId, 'msg-client-1');
  assert.equal('secret' in messages[0].metadata, false);
  assert.equal('private' in messages[1].metadata, false);

  const updated = store.updateMessage(second.id, { status: 'complete', content: 'I found the authentication entry points.' });
  assert.equal(updated.status, 'complete');
  assert.match(updated.content, /entry points/);
});

test('StudioStore keeps one active autonomy grant per project and persists its bounded scope', async (t) => {
  const { store, project } = await fixture(t);

  const guided = store.createAutonomyGrant({
    projectId: project.id,
    profile: 'guided',
    scope: { allowedPaths: ['src/**'], network: 'deny' },
    actor: 'human:owner',
  });
  assert.equal(store.getAutonomyGrant(project.id).id, guided.id);
  assert.equal(store.getAutonomyGrant(project.id).profile, 'guided');

  const autopilot = store.createAutonomyGrant({
    projectId: project.id,
    profile: 'workspace-autopilot',
    scope: { allowedPaths: ['**'], network: 'allowlisted', maxCostUsd: 2 },
    actor: 'human:owner',
  });
  const active = store.getAutonomyGrant(project.id);
  assert.equal(active.id, autopilot.id);
  assert.equal(active.profile, 'workspace-autopilot');
  assert.deepEqual(active.scope.allowedPaths, ['**']);
  assert.equal(store.listAutonomyGrants({ projectId: project.id, status: 'revoked' }).length, 1);

  const revoked = store.updateAutonomyGrant(autopilot.id, { status: 'revoked', actor: 'human:owner' });
  assert.equal(revoked.status, 'revoked');
  assert.equal(store.getAutonomyGrant(project.id), null);
});
