import test from 'node:test';
import assert from 'node:assert/strict';
import { CrossRepositoryWorkspaceMap } from '../src/frontier/cross-repository-workspace-map.mjs';
import { TransactionalChangePlanner } from '../src/frontier/transactional-change-planner.mjs';

const hashes = ['1','2','3','4','5'].map((x) => x.repeat(64));
function workspace() {
  const map = new CrossRepositoryWorkspaceMap();
  for (const [i, id] of ['backend','sdk','frontend','docs'].entries()) map.registerRepository({ repositoryId: id, version: '1.0.0', fingerprintSha256: hashes[i], owner: id, role: id });
  map.registerContract({ contractId: 'api-v2', repositoryId: 'backend', version: '2.0.0', fingerprintSha256: hashes[4], kind: 'http-api' });
  map.linkDependency({ fromRepositoryId: 'sdk', toRepositoryId: 'backend', contractId: 'api-v2', requiredVersion: '2.0.0', compatibility: { mode: 'dual', windowId: 'v1-v2' } });
  map.linkDependency({ fromRepositoryId: 'frontend', toRepositoryId: 'sdk', requiredVersion: '1.1.0' });
  map.linkDependency({ fromRepositoryId: 'docs', toRepositoryId: 'frontend', requiredVersion: '1.1.0' });
  return map.snapshot();
}

test('planner orders backend, SDK, frontend and docs with compatibility and rollback checkpoints', () => {
  const planner = new TransactionalChangePlanner();
  const plan = planner.compile({
    workspace: workspace(),
    planId: 'api-v2-rollout',
    changes: ['backend','sdk','frontend','docs'].map((repositoryId) => ({ repositoryId, baselineSha256: hashes[['backend','sdk','frontend','docs'].indexOf(repositoryId)], rollbackRef: `rollback/${repositoryId}`, verificationCommandId: `verify-${repositoryId}`, targetVersion: repositoryId === 'backend' ? '2.0.0' : '1.1.0' })),
    compatibilityWindows: [{ windowId: 'v1-v2', contractId: 'api-v2', intermediateVersion: '1.5.0', expiresAfterStep: 'frontend' }],
  });
  assert.deepEqual(plan.steps.map((step) => step.repositoryId), ['backend','sdk','frontend','docs']);
  assert.equal(plan.transactional, true);
  assert.equal(plan.allOrRollback, true);
  assert.equal(plan.intermediateContracts[0].contractId, 'api-v2');
});

test('multi-root plan is explicitly non-transactional when rollback coverage is incomplete', () => {
  const planner = new TransactionalChangePlanner();
  const plan = planner.compile({ workspace: workspace(), planId: 'unsafe', changes: [
    { repositoryId: 'backend', baselineSha256: hashes[0], rollbackRef: 'rollback/backend', verificationCommandId: 'verify-backend', targetVersion: '2.0.0' },
    { repositoryId: 'sdk', baselineSha256: hashes[1], verificationCommandId: 'verify-sdk', targetVersion: '1.1.0' },
  ] });
  assert.equal(plan.transactional, false);
  assert.equal(plan.allOrRollback, false);
  assert.ok(plan.blockers.includes('rollback-coverage-incomplete'));
});
