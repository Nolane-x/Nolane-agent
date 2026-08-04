import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { ConstructionControlPlane } from '../src/construction/construction-control-plane.mjs';

const specification = {
  specificationId: 'spec-1', goal: 'Add safe expiration',
  criteria: [{ criterionId: 'c1', statement: 'Expired sessions fail', weight: 4 }],
  constraints: [{ constraintId: 'api-stable', kind: 'hard', statement: 'Preserve API', rule: 'preserve-public-api' }],
  invariants: [{ invariantId: 'no-secret-log', severity: 'critical', statement: 'No secrets in logs', verifierId: 'secret-scan' }],
  verificationPlan: [{ verificationId: 'v1', criterionIds: ['c1'], kind: 'test' }],
};

test('composes specification, invariant, plan, patch, candidate and proof operations', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-construction-plane-'));
  const plane = new ConstructionControlPlane({ capsuleRoot: root });
  const spec = plane.compileSpecification(specification);
  assert.equal(spec.status, 'ready');
  plane.verifyInvariant('spec-1', 'no-secret-log', { status: 'passed', sourceHash: spec.receiptSha256, receiptId: 'secret-pass' });
  const authorization = plane.authorizeInvariants('spec-1', { changedPaths: ['src/session.mjs'], currentSourceHashes: { 'no-secret-log': spec.receiptSha256 } });
  assert.equal(authorization.allowed, true);
  const patch = plane.analyzePatch({ taskKind: 'bugfix', risk: 'low', changedFiles: 1, changedLines: 7, changedSymbols: ['validateSession'] });
  assert.equal(patch.authorization.allowed, true);
  const selected = plane.selectCandidate({ verificationContractSha256: 'contract', candidates: [
    { candidateId: 'a', verificationContractSha256: 'contract', isolated: true, isolationReceiptId: 'wa', criticalInvariantFailures: 0, regressionFailures: 0, verifiedCriteriaScore: 4, requiredCriteriaScore: 4, semanticFootprint: 2, tokenCost: 10, rssMbSeconds: 10, editCost: 2, changedLines: 7 },
    { candidateId: 'b', verificationContractSha256: 'contract', isolated: true, isolationReceiptId: 'wb', criticalInvariantFailures: 0, regressionFailures: 0, verifiedCriteriaScore: 4, requiredCriteriaScore: 4, semanticFootprint: 5, tokenCost: 2, rssMbSeconds: 2, editCost: 1, changedLines: 3 },
  ] });
  assert.equal(selected.selectedCandidateId, 'a');
  const snapshot = plane.snapshot();
  assert.equal(snapshot.lifecycle.specifications, 1);
  assert.equal(snapshot.claims.directFileMutation, false);
});

test('blocked specification cannot receive edit authorization', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-construction-plane-'));
  const plane = new ConstructionControlPlane({ capsuleRoot: root });
  const spec = plane.compileSpecification({ ...specification, specificationId: 'blocked', constraints: [
    { constraintId: 'stable', kind: 'hard', statement: 'Preserve API', rule: 'preserve-public-api' },
    { constraintId: 'rename', kind: 'hard', statement: 'Rename without adapter', rule: 'rename-public-api-without-adapter' },
  ] });
  assert.equal(spec.status, 'blocked');
  assert.throws(() => plane.createPlan({ planId: 'p1', missionId: 'm1', specificationId: 'blocked', repositoryFingerprint: 'r', assumptionReceiptSha256: 'a', steps: [] }), /blocked specification/i);
});
