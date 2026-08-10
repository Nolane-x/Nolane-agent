import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { ContextOrchestrationKernel } from '../src/agent/context-orchestration-kernel.mjs';
import { ContextOrchestrationService } from '../src/context/context-orchestration-service.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-context-orchestration-'));
  const service = new ContextOrchestrationService({
    file: path.join(root, 'orchestration.db'),
    kernel: new ContextOrchestrationKernel({ clock: () => Date.parse('2026-07-29T09:00:00.000Z'), budgets: { planner: 200 } }),
    clock: () => '2026-07-29T09:00:00.000Z',
  });
  t.after(() => service.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  return { service };
}

const items = [
  { id: 'error', projectId: 'p1', sourceType: 'diagnostics', text: 'TypeError: missing login', current: true, severity: 'error' },
  { id: 'code', projectId: 'p1', sourceType: 'code', text: 'export function login() {}', sourceHash: 'a'.repeat(64), currentHash: 'a'.repeat(64) },
  { id: 'log', projectId: 'p1', sourceType: 'log', text: 'old output '.repeat(30), createdAt: '2026-06-01T00:00:00.000Z' },
];

test('service creates idempotent durable checkpoints and restores them after restart', async (t) => {
  const { service } = await fixture(t);
  const plan = service.plan({ projectId: 'p1', principalId: 'user-1', role: 'planner', items });
  const first = service.checkpoint({ projectId: 'p1', principalId: 'user-1', plan, label: 'Before edit' });
  const repeated = service.checkpoint({ projectId: 'p1', principalId: 'user-1', plan, label: 'Before edit' });
  assert.equal(first.id, repeated.id);
  assert.equal(first.receiptSha256, repeated.receiptSha256);
  assert.equal(service.getCheckpoint(first.id, { projectId: 'p1', principalId: 'user-1' }).plan.receiptSha256, plan.receiptSha256);
  assert.throws(() => service.getCheckpoint(first.id, { projectId: 'p2', principalId: 'user-1' }), /scope denied/i);
});

test('service pages checkpoint items with stable cursors and principal scope', async (t) => {
  const { service } = await fixture(t);
  const plan = service.plan({ projectId: 'p1', principalId: 'user-1', role: 'planner', items });
  const checkpoint = service.checkpoint({ projectId: 'p1', principalId: 'user-1', plan });
  const first = service.pageCheckpoint(checkpoint.id, { projectId: 'p1', principalId: 'user-1', limit: 2 });
  assert.equal(first.items.length, 2);
  assert.ok(first.nextCursor);
  const second = service.pageCheckpoint(checkpoint.id, { projectId: 'p1', principalId: 'user-1', cursor: first.nextCursor, limit: 2 });
  assert.equal(second.items.length, 1);
  assert.deepEqual([...first.items, ...second.items].map((entry) => entry.id), plan.items.map((entry) => entry.id));
  assert.throws(() => service.pageCheckpoint(checkpoint.id, { projectId: 'p1', principalId: 'other-user', limit: 2 }), /scope denied/i);
  assert.match(first.receiptSha256, /^[a-f0-9]{64}$/);
});
