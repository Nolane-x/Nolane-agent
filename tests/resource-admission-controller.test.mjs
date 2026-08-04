import assert from 'node:assert/strict';
import test from 'node:test';
import { LocalDeviceDoctor } from '../src/runtime/local-device-doctor.mjs';
import { ResourceAdmissionController } from '../src/runtime/resource-admission-controller.mjs';
import { ViabilityRegionController } from '../src/runtime/viability-region-controller.mjs';

function metrics(extra = {}) {
  return { availableRamMb: 4_000, totalRamMb: 8_192, diskFreeMb: 20_000, errorRate: 0.01, activeAgents: 1, pendingIrreversibleActions: 0, unverifiedMemory: 2, policyDrift: 0.1, ...extra };
}
function request(kind, extra = {}) {
  return { resourceId: `${kind}-1`, kind, missionId: 'mission-1', taskId: 'task-1', owner: 'executor-1', expectedVerifiedUtility: 0.7, rssBudgetMb: 200, cpuBudgetSeconds: 60, fdBudget: 64, processBudget: 4, timeCostSeconds: 30, idleTtlMs: 30_000, reversible: true, ...extra };
}

test('ResourceAdmissionController denies low-value browser work for a backend-only task', () => {
  const controller = new ResourceAdmissionController({ viability: new ViabilityRegionController() });
  const decision = controller.admit(request('browser', { expectedVerifiedUtility: 0.05, rssBudgetMb: 500, timeCostSeconds: 120, taskProfile: { backendOnly: true } }), metrics());
  assert.equal(decision.allowed, false);
  assert.match(decision.reasons.join(' '), /utility|backend/i);
});

test('ResourceAdmissionController admits a high-value targeted test and records rssMbSeconds', () => {
  let now = 1_000;
  const controller = new ResourceAdmissionController({ viability: new ViabilityRegionController(), clock: () => now });
  const admitted = controller.admit(request('test', { expectedVerifiedUtility: 0.95, rssBudgetMb: 120, timeCostSeconds: 5 }), metrics());
  assert.equal(admitted.allowed, true);
  assert.equal(admitted.lease.kind, 'test');
  now = 6_000;
  controller.sample(admitted.lease.leaseId, { rssMb: 100, atMs: now });
  now = 11_000;
  const released = controller.release(admitted.lease.leaseId, { rssMb: 80, atMs: now, reason: 'completed' });
  assert.equal(released.rssMbSeconds, 500);
});

test('ResourceAdmissionController recommends unloading idle embedding before predicted browser/test demand', () => {
  const controller = new ResourceAdmissionController({ viability: new ViabilityRegionController() });
  const embedding = controller.admit(request('embedding', { resourceId: 'embed-1', expectedVerifiedUtility: 0.8, rssBudgetMb: 700, idleTtlMs: 1 }), metrics());
  assert.equal(embedding.allowed, true);
  const browser = controller.admit(request('browser', { resourceId: 'browser-2', expectedVerifiedUtility: 0.95, rssBudgetMb: 900, timeCostSeconds: 20, plannedDemand: { testRssMb: 500 } }), metrics({ availableRamMb: 2_000 }));
  assert.equal(browser.allowed, true);
  assert.ok(browser.evictLeaseIds.includes('embed-1'));
});

test('ViabilityRegionController blocks irreversible work outside the viability region', () => {
  const viability = new ViabilityRegionController({ limits: { minAvailableRamMb: 800, minDiskFreeMb: 2_000, maxErrorRate: 0.2, maxActiveAgents: 4, maxPendingIrreversibleActions: 1, maxUnverifiedMemory: 100, maxPolicyDrift: 0.7 } });
  const forecast = viability.evaluate(metrics({ availableRamMb: 700, pendingIrreversibleActions: 1 }), { rssMb: 200, irreversibleActions: 1 });
  assert.equal(forecast.inside, false);
  assert.equal(forecast.allowIrreversible, false);
  assert.ok(forecast.breaches.some((item) => /RAM|irreversible/i.test(item)));
});

test('LocalDeviceDoctor chooses Lite, Balanced, and Performance with explanations', () => {
  const doctor = new LocalDeviceDoctor();
  const lite = doctor.diagnose({ totalRamMb: 8_192, availableRamMb: 4_000, cpuCores: 4, diskFreeMb: 30_000, gpuAvailable: false });
  const balanced = doctor.diagnose({ totalRamMb: 16_384, availableRamMb: 10_000, cpuCores: 8, diskFreeMb: 80_000, gpuAvailable: false });
  const performance = doctor.diagnose({ totalRamMb: 64_000, availableRamMb: 50_000, cpuCores: 16, diskFreeMb: 300_000, gpuAvailable: true });
  assert.equal(lite.profile, 'Lite');
  assert.equal(balanced.profile, 'Balanced');
  assert.equal(performance.profile, 'Performance');
  assert.ok(lite.explanations.length > 0 && performance.explanations.length > 0);
  assert.equal(lite.appliedAutomatically, false);
});
