import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SovereignAgentKernel } from '../src/kernel/sovereign-agent-kernel.mjs';

test('sovereign kernel restores plans, context packets and capability leases after restart', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'nolane-sovereign-restart-'));
  t.after(() => rm(dir, { recursive: true, force: true }));

  let kernel = SovereignAgentKernel.create({ dataDir: dir });
  const thread = kernel.createThread({ projectId: 'project-restart', title: 'Restart durable kernel', objective: 'Continue governed work after a process restart.' });
  const context = kernel.compileContext(thread.id, {
    tokenBudget: 8_000,
    instructions: [{ content: 'Preserve signed evidence.', trust: 'managed' }],
    repository: [{ path: 'src/kernel.mjs', content: 'export const durable = true;' }],
  });
  const plan = kernel.compilePlan(thread.id, { tasks: [{ id: 'inspect', role: 'scout', objective: 'Inspect durable state', ownedPaths: ['src/kernel.mjs'] }] });
  const requested = await kernel.requestCapability(thread.id, { capability: 'filesystem.read', resource: 'src/**', scope: 'thread', risk: 'low', reason: 'Read project source after restart', constraints: { maxUses: 3 } });
  assert.equal(requested.lease.state, 'granted');
  kernel.close();

  kernel = SovereignAgentKernel.create({ dataDir: dir });
  t.after(() => kernel.close());
  const snapshot = kernel.snapshot({ threadId: thread.id });
  assert.equal(snapshot.metrics.threads, 1);
  assert.equal(snapshot.metrics.plans, 1);
  assert.equal(snapshot.metrics.contextPackets, 1);
  assert.equal(snapshot.metrics.capabilityLeases, 1);
  assert.equal(snapshot.architecture.durableKernelArtifacts, true);
  assert.equal(snapshot.architecture.restartResumablePlans, true);
  assert.equal(snapshot.plans[0].id, plan.id);
  assert.equal(snapshot.context[0].receiptSha256, context.receiptSha256);

  const authorization = kernel.authorizeCapability({
    leaseId: requested.lease.id,
    threadId: thread.id,
    projectId: thread.projectId,
    actorId: thread.principalId,
    capability: 'filesystem.read',
    resource: 'src/**',
  });
  assert.equal(authorization.allowed, true);
  assert.equal(authorization.uses, 1);

  kernel.close();
  kernel = SovereignAgentKernel.create({ dataDir: dir });
  const restoredLease = kernel.snapshot({ threadId: thread.id }).capabilities.leases[0];
  assert.equal(restoredLease.uses, 1);
  assert.equal(restoredLease.state, 'granted');
});
