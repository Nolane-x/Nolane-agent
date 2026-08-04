import test from 'node:test';
import assert from 'node:assert/strict';
import { ProofMissionCompiler } from '../src/superiority/proof-mission-compiler.mjs';

const H = (c) => c.repeat(64);

function evidence(extra = {}) {
  return {
    evidenceType: 'positive',
    kind: 'direct-test',
    status: 'pass',
    observed: true,
    sourceHash: H('a'),
    effectHash: H('b'),
    verifierId: 'verifier-1',
    independenceKey: 'independent-lane',
    ...extra,
  };
}

test('proof mission compiler creates a topological proof graph and keeps deployment locked until every obligation is verified', () => {
  const compiler = new ProofMissionCompiler({ clock: () => 1000 });
  const plan = compiler.compile({
    missionId: 'mission-1',
    goal: 'Ship a verified runtime change',
    budget: { maxTokens: 5000, maxElapsedMs: 60000 },
    rollback: { required: true, target: 'commit-before-change' },
    criteria: [
      {
        claimId: 'runtime',
        claim: 'Runtime behavior is implemented',
        proposerKey: 'builder-lane',
        positiveEvidenceKinds: ['direct-test'],
        falsificationProbeIds: ['mutation-kill'],
        minIndependentVerifiers: 1,
      },
      {
        claimId: 'release',
        claim: 'Release projection preserves the runtime behavior',
        proposerKey: 'builder-lane',
        dependencies: ['runtime'],
        positiveEvidenceKinds: ['integration-test'],
        falsificationProbeIds: ['archive-reconstruction'],
        minIndependentVerifiers: 1,
      },
    ],
    invariants: [{ invariantId: 'no-secret', claim: 'No raw secret is persisted', evidenceKinds: ['security-test'] }],
  });

  assert.deepEqual(plan.executionOrder, ['runtime', 'release', 'invariant:no-secret']);
  assert.equal(plan.authorization.deployAllowed, false);
  assert.equal(plan.claims.hiddenReasoningStored, false);
  assert.match(plan.receiptSha256, /^[a-f0-9]{64}$/);

  compiler.recordEvidence(plan.planId, { claimId: 'runtime', ...evidence() });
  compiler.recordEvidence(plan.planId, { claimId: 'runtime', ...evidence({ evidenceType: 'falsification', probeId: 'mutation-kill', sourceHash: H('c'), effectHash: H('d') }) });
  let result = compiler.evaluate(plan.planId);
  assert.equal(result.authorization.deployAllowed, false);
  assert.deepEqual(result.blockedClaimIds, ['release', 'invariant:no-secret']);

  compiler.recordEvidence(plan.planId, { claimId: 'release', ...evidence({ kind: 'integration-test', sourceHash: H('e'), effectHash: H('f') }) });
  compiler.recordEvidence(plan.planId, { claimId: 'release', ...evidence({ evidenceType: 'falsification', probeId: 'archive-reconstruction', sourceHash: H('1'), effectHash: H('2') }) });
  compiler.recordEvidence(plan.planId, { claimId: 'invariant:no-secret', ...evidence({ kind: 'security-test', sourceHash: H('3'), effectHash: H('4') }) });
  result = compiler.evaluate(plan.planId);
  assert.equal(result.authorization.deployAllowed, true);
  assert.equal(result.proofCoverage, 1);
  assert.deepEqual(result.blockedClaimIds, []);
});

test('proof mission compiler rejects cycles, non-observed evidence, proposer-self-verification, and failed falsification probes', () => {
  const compiler = new ProofMissionCompiler();
  assert.throws(() => compiler.compile({ missionId: 'cycle', goal: 'x', criteria: [
    { claimId: 'a', claim: 'a', dependencies: ['b'] },
    { claimId: 'b', claim: 'b', dependencies: ['a'] },
  ] }), /cycle/i);

  const plan = compiler.compile({ missionId: 'blocked', goal: 'x', criteria: [{
    claimId: 'claim', claim: 'claim', proposerKey: 'same-lane', positiveEvidenceKinds: ['direct-test'], falsificationProbeIds: ['attack'], minIndependentVerifiers: 1,
  }] });
  assert.throws(() => compiler.recordEvidence(plan.planId, { claimId: 'claim', ...evidence({ observed: false }) }), /observed/i);
  compiler.recordEvidence(plan.planId, { claimId: 'claim', ...evidence({ independenceKey: 'same-lane' }) });
  compiler.recordEvidence(plan.planId, { claimId: 'claim', ...evidence({ evidenceType: 'falsification', probeId: 'attack', status: 'fail', sourceHash: H('5'), effectHash: H('6') }) });
  const result = compiler.evaluate(plan.planId);
  assert.equal(result.authorization.deployAllowed, false);
  assert.equal(result.claims[0].independentVerifierSatisfied, false);
  assert.equal(result.claims[0].falsificationSatisfied, false);
});
