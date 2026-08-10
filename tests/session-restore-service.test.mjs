import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { SessionRestoreService } from '../src/session/session-restore-service.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-session-restore-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  let tick = 0;
  const clock = () => `2026-08-03T17:00:${String(tick++).padStart(2, '0')}.000Z`;
  return { root, service: new SessionRestoreService({ dataDir: root, clock }) };
}

test('session restore state is atomic, versioned, receipted and preserves unknown fields', async (t) => {
  const { root, service } = await fixture(t);
  assert.equal((await service.restore()).activeRoute, '/');
  const first = await service.updateRestore({ activeRoute: '/missions?id=m1', experienceLevel: 'workspace', missionId: 'm1', view: { summaryOpen: true } });
  assert.equal(first.schema, 'nolane.session-restore.v1');
  assert.equal(first.experienceLevel, 'workspace');
  assert.match(first.receiptSha256, /^[a-f0-9]{64}$/);

  const file = path.join(root, 'session', 'restore.json');
  const persisted = JSON.parse(await readFile(file, 'utf8'));
  persisted.futureState = { keep: true };
  await writeFile(file, `${JSON.stringify(persisted, null, 2)}\n`, { mode: 0o600 });
  const second = await service.updateRestore({ activeRoute: '/projects' });
  assert.equal(second.futureState.keep, true);
  if (process.platform !== 'win32') assert.equal((await stat(file)).mode & 0o777, 0o600);
});

test('composer drafts restore bounded text, selection, model intent and safe attachment references', async (t) => {
  const { service } = await fixture(t);
  const draft = await service.saveDraft({
    scope: 'home',
    draft: {
      objective: 'x'.repeat(100_500), selection: [3, 200_000], projectId: 'project-1', intent: 'build', modelChoice: 'provider/model',
      attachmentRefs: [{ id: 'a1', kind: 'file', name: 'README.md', projectId: 'project-1', relativePath: 'docs/README.md' }]
    }
  });
  assert.equal(draft.objective.length, 100_000);
  assert.deepEqual(draft.selection, [3, 100_000]);
  assert.equal((await service.draft('home')).attachmentRefs[0].relativePath, 'docs/README.md');
  assert.equal((await service.clearDraft('home')).deleted, true);
  assert.equal(await service.draft('home'), null);
});

test('session state rejects credentials, unsafe routes and path-escaping attachment references', async (t) => {
  const { service } = await fixture(t);
  await assert.rejects(() => service.updateRestore({ activeRoute: 'https://example.com' }), (error) => error.code === 'session_route_invalid');
  await assert.rejects(() => service.updateRestore({ accessToken: 'secret' }), (error) => error.code === 'session_sensitive_field');
  await assert.rejects(() => service.saveDraft({ scope: 'home', draft: { objective: 'x', attachmentRefs: [{ id: 'x', relativePath: '../secret.txt' }] } }), (error) => error.code === 'session_attachment_path_invalid');
});

test('corrupt durable session state fails closed instead of resetting silently', async (t) => {
  const { root, service } = await fixture(t);
  await service.updateRestore({ activeRoute: '/missions' });
  await writeFile(path.join(root, 'session', 'restore.json'), '{not-json', { mode: 0o600 });
  await assert.rejects(() => service.restore(), (error) => error.code === 'session_restore_corrupt');
});
