import test from 'node:test';
import assert from 'node:assert/strict';
import { SovereignReviewerBoundary } from '../src/kernel/reviewer-boundary.mjs';
import { SpeculativeExecutionFabric } from '../src/kernel/speculative-execution-fabric.mjs';

test('execution fabric schedules a DAG, serializes ownership conflicts and requires independent review', async () => {
  let active = 0; let peak = 0; const order = [];
  const reviewer = new SovereignReviewerBoundary({ reviewerId: 'reviewer' });
  const fabric = new SpeculativeExecutionFabric({
    reviewer, maxConcurrency: 4,
    runner: async ({ task }) => {
      active += 1; peak = Math.max(peak, active); order.push(`start:${task.id}`);
      await new Promise((resolve) => setTimeout(resolve, 8));
      active -= 1; order.push(`end:${task.id}`);
      return { executorId: `executor:${task.id}`, diff: `diff --git a/${task.id} b/${task.id}\n+ok`, tests: [{ name: 'unit', status: 'pass', receiptSha256: 'a'.repeat(64) }], evidence: ['b'.repeat(64)] };
    },
  });
  const plan = fabric.compilePlan({ threadId: 'thread-a', objective: 'Implement kernel', tasks: [
    { id: 'scout', objective: 'Inspect', role: 'scout', ownedPaths: ['src/read-only'] },
    { id: 'builder-a', objective: 'Build A', dependencies: ['scout'], ownedPaths: ['src/kernel'] },
    { id: 'builder-b', objective: 'Build B', dependencies: ['scout'], ownedPaths: ['src/kernel/context'] },
    { id: 'docs', objective: 'Write docs', dependencies: ['scout'], ownedPaths: ['docs'] },
  ] });
  assert.equal(plan.conflictMatrix.length, 1);
  const receipt = await fabric.execute({ plan });
  assert.equal(receipt.status, 'completed');
  assert.equal(receipt.lanes.every((item) => Boolean(item.reviewReceiptSha256)), true);
  assert.ok(peak >= 2, `expected non-conflicting lanes to run concurrently, peak=${peak}`);
  const aStart = order.indexOf('start:builder-a'); const aEnd = order.indexOf('end:builder-a'); const bStart = order.indexOf('start:builder-b'); const bEnd = order.indexOf('end:builder-b');
  assert.ok(aEnd < bStart || bEnd < aStart, `conflicting lanes overlapped: ${order.join(',')}`);
});
