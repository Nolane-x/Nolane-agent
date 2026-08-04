import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveRunView, formatElapsed, formatTokens, phaseCopy } from '../ui/ui-state.mjs';

test('deriveRunView presents a compact human status instead of technical internals', () => {
  const view = deriveRunView({
    mission: { id: 'm1', objective: 'Build settings', status: 'running', createdAt: '2026-07-28T00:00:00.000Z' },
    running: true,
    activities: {
      currentPhase: 'testing',
      active: { title: 'Đang chạy 42 kiểm thử', explanation: 'Kiểm tra thay đổi.', time: '2026-07-28T00:01:00.000Z' },
      usage: { totalTokens: 18420 },
      tasks: [{ status: 'done' }, { status: 'running' }, { status: 'ready' }],
      stale: false,
    },
  }, Date.parse('2026-07-28T00:02:00.000Z'));
  assert.equal(view.title, 'Build settings');
  assert.equal(view.phase, 'testing');
  assert.equal(view.statusLabel, 'Đang kiểm thử');
  assert.equal(view.progress.done, 1);
  assert.equal(view.progress.total, 3);
  assert.equal(view.tokens, '18,4K token');
  assert.equal(view.elapsed, '2 phút');
  assert.equal('receipt' in view, false);
});

test('formatters remain readable for idle and completed tasks', () => {
  assert.equal(formatTokens(0), '0 token');
  assert.equal(formatTokens(1_245), '1,2K token');
  assert.equal(formatElapsed(3_660_000), '1 giờ 1 phút');
  assert.equal(phaseCopy('completed').label, 'Hoàn thành');
  assert.equal(deriveRunView({ mission: { objective: 'Done', status: 'completed', createdAt: '2026-07-28T00:00:00.000Z' }, activities: { currentPhase: 'completed', usage: {}, tasks: [] } }, Date.parse('2026-07-28T00:00:05.000Z')).terminal, true);
});
