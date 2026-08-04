import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildAgentKernelView, renderAgentKernelView } from '../ui-v3/control-plane/domains/agent-kernel.mjs';
import { CONTROL_PLANE_DOMAINS } from '../ui-v3/control-plane/control-plane-shell.mjs';
import { CONTROL_PLANE_ROUTES } from '../ui-v3/control-plane/route-registry.mjs';

test('Control Plane exposes a live Sovereign Agent Kernel surface with enforced core invariants', async () => {
  assert.ok(CONTROL_PLANE_DOMAINS.includes('agent-kernel'));
  assert.equal(typeof CONTROL_PLANE_ROUTES['agent-kernel'], 'function');
  const view = buildAgentKernelView({
    generatedAt: '2026-08-03T03:00:00.000Z', receiptSha256: 'a'.repeat(64),
    metrics: { threads: 2, activeThreads: 1, plans: 1, contextPackets: 1, capabilityLeases: 1, pendingApprovals: 0 },
    threads: [{ id: 'thread-1', state: 'running', title: 'Kernel evolution', objective: 'Build deep core.', epoch: 2, revision: 9, projectId: 'project-1' }],
    plans: [{ id: 'plan-1', taskCount: 4 }], context: [{ tokenEstimate: 4000, tokenBudget: 8000, utilization: 0.5 }], capabilities: { leases: [] },
    architecture: { durableThreads: true, optimisticRevisionFencing: true, epochFencing: true, scopedCapabilityLeases: true, pathScopedContextCompilation: true, transcriptCompaction: true, adaptiveDagExecution: true, independentReviewBoundary: true, unreviewedMergeAllowed: false },
  });
  const html = renderAgentKernelView(view);
  for (const phrase of ['Sovereign Agent Kernel', 'Parallel, isolated, review-gated', 'The agent cannot approve itself', 'Relevant truth, not prompt bulk', 'No standing privilege']) assert.match(html, new RegExp(phrase));
  const css = await readFile(new URL('../ui-v3/styles/pages/control-plane.css', import.meta.url), 'utf8');
  assert.match(css, /\.kernel-hero/);
  assert.match(css, /\.fabric-flow/);
  assert.match(css, /\.boundary-orbit/);
});
