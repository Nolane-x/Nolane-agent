import test from 'node:test';
import assert from 'node:assert/strict';
import { FrontierGovernancePlane } from '../src/runtime/frontier-governance-plane.mjs';

const H = (c) => c.repeat(64);

test('frontier governance contract records repository ownership while keeping promotion human gated', () => {
  const plane = new FrontierGovernancePlane({ clock: () => 1_000 });
  const repository = plane.registerRepository({ repositoryId: 'backend', version: '1.0.0', fingerprintSha256: H('1'), owner: 'platform', role: 'backend' });
  assert.equal(repository.repositoryId, 'backend');
  const snapshot = plane.snapshot();
  assert.equal(snapshot.lifecycle.workspaceLoaded, true);
  assert.equal(snapshot.claims.autonomousMergeAllowed, false);
  assert.equal(snapshot.claims.productionPolicyPromotionAllowed, false);
  assert.match(snapshot.receiptSha256, /^[a-f0-9]{64}$/);
});

test('frontier governance contract rejects operations after close and never exposes adapters or autonomous claims', () => {
  const plane = new FrontierGovernancePlane({ selfHealing: { adapter: { resetToBaseline: async () => ({ status: 'clean', receiptSha256: H('2') }), createWorktree: async () => ({ status: 'created', worktreeId: 'wt', receiptSha256: H('3') }) } } });
  const closed = plane.close();
  assert.equal(closed.claims.frontierSuperiorityClaimAllowed, false);
  assert.equal(JSON.stringify(closed).includes('resetToBaseline'), false);
  assert.throws(() => plane.registerRepository({ repositoryId: 'x' }), /closed/i);
});
