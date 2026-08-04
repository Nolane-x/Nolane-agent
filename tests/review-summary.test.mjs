import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { ReviewSummary } from '../src/orchestration/review-summary.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-review-summary-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  const project = store.createProject({ name: 'P', workspaceRoot: root });
  const mission = store.createMission({ projectId: project.id, objective: 'Add sign in', status: 'completed' });
  const builder = store.createTask({
    id: 'builder', projectId: project.id, missionId: mission.id, title: 'Add authentication', objective: 'Implement sign in', role: 'builder', status: 'done',
    metadata: {
      worktree: { path: path.join(root, 'worktrees', 'builder'), branch: 'forge/builder' },
      executionWorkspace: path.join(root, 'worktrees', 'builder'),
      handoff: { output: 'Implemented Google sign in and added callback validation.' },
    },
  });
  store.createTask({ id: 'reviewer', projectId: project.id, missionId: mission.id, title: 'Review authentication', objective: 'Review', role: 'reviewer', status: 'done', dependencies: [builder.id] });
  store.addEvidence({ id: 'z-diff', projectId: project.id, taskId: builder.id, kind: 'diff-check', status: 'pass', receiptSha256: 'a'.repeat(64), payload: { summary: 'Git diff integrity check passed.', exitCode: 0 } });
  store.addEvidence({ id: 'a-tests', projectId: project.id, taskId: builder.id, kind: 'verification-command', status: 'pass', receiptSha256: 'b'.repeat(64), payload: { summary: '42 tests passed.', exitCode: 0 } });
  const gitInspector = {
    async snapshot({ taskId }) {
      assert.equal(taskId, builder.id);
      return { status: [{ code: ' M', path: 'src/auth.mjs' }, { code: '??', path: 'tests/auth.test.mjs' }], diffStat: '2 files changed, 40 insertions(+)', dirty: true };
    },
  };
  return { store, project, mission, builder, summary: new ReviewSummary({ store, gitInspector }) };
}

test('ReviewSummary presents concise changes and verification without leaking receipts', async (t) => {
  const f = await fixture(t);
  const result = await f.summary.snapshot(f.mission.id);
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.progress, { total: 2, done: 2, failed: 0 });
  assert.equal(result.changes.length, 1);
  assert.deepEqual(result.changes[0].files, ['src/auth.mjs', 'tests/auth.test.mjs']);
  assert.match(result.changes[0].summary, /Google sign in/i);
  assert.deepEqual(result.verification, { status: 'pass', passed: 2, total: 2, checks: ['Git diff integrity check passed.', '42 tests passed.'] });
  assert.equal(result.canRollback, true);
  assert.doesNotMatch(JSON.stringify(result), /receiptSha256/);
});

test('ReviewSummary reports a failed gate clearly and disables rollback after rollback', async (t) => {
  const f = await fixture(t);
  f.store.addEvidence({ projectId: f.project.id, taskId: f.builder.id, kind: 'security', status: 'fail', payload: { summary: 'Secret scan failed.' } });
  f.store.updateMission(f.mission.id, { status: 'rolled-back', metadata: { rolledBackAt: '2026-07-28T00:00:00.000Z' } });
  const result = await f.summary.snapshot(f.mission.id);
  assert.equal(result.verification.status, 'fail');
  assert.equal(result.canRollback, false);
  assert.equal(result.rolledBackAt, '2026-07-28T00:00:00.000Z');
});
