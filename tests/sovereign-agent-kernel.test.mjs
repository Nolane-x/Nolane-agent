import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SovereignAgentKernel } from '../src/kernel/sovereign-agent-kernel.mjs';

test('sovereign agent kernel composes durable threads, context, plan, leases and checkpoints', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'nolane-sovereign-kernel-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const kernel = new SovereignAgentKernel({ dataDir: dir, laneRunner: async ({ task }) => ({ executorId: `agent:${task.id}`, diff: `diff --git a/${task.id} b/${task.id}\n+verified`, tests: [{ name: 'unit', status: 'pass', receiptSha256: 'a'.repeat(64) }], evidence: ['b'.repeat(64)] }) });
  t.after(() => kernel.close());
  const thread = kernel.createThread({ projectId: 'project-a', objective: 'Deepen the core' });
  const context = kernel.compileContext(thread.id, { tokenBudget: 4_000, instructions: [{ content: 'All changes need receipts.', trust: 'managed' }], repository: [{ path: 'src/core.mjs', content: 'export const core = true;' }] });
  const plan = kernel.compilePlan(thread.id, { tasks: [{ id: 'build', objective: 'Implement core', ownedPaths: ['src/core.mjs'] }] });
  const capability = await kernel.requestCapability(thread.id, { capability: 'filesystem.read', resource: 'src/**', scope: 'once', risk: 'low', reason: 'inspect files' });
  assert.equal(capability.lease.state, 'granted');
  const execution = await kernel.executePlan(thread.id, plan.id, { contextReceiptSha256: context.receiptSha256 });
  assert.equal(execution.status, 'completed');
  const afterExecution = kernel.getThread(thread.id);
  assert.equal(afterExecution.state, 'review');
  const checkpoint = kernel.checkpoint(thread.id, { label: 'review ready' });
  assert.equal(checkpoint.threadId, thread.id);
  const snapshot = kernel.snapshot({ threadId: thread.id });
  assert.equal(snapshot.metrics.threads, 1);
  assert.equal(snapshot.metrics.plans, 1);
  assert.equal(snapshot.architecture.unreviewedMergeAllowed, false);
});
