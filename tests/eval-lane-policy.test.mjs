import test from 'node:test';
import assert from 'node:assert/strict';
import { EvalRunner } from '../src/eval/eval-runner.mjs';
import { evaluateEvalLanePolicy } from '../src/eval/eval-lane-policy.mjs';

const H = (c) => c.repeat(64);

test('plumbing smoke may use fixtures but can never authorize capability or comparative claims', async () => {
  const suite = {
    id: 'smoke', lane: 'evaluator-plumbing-smoke',
    cases: [{ id: 'fixture', fixtureResult: { state: 'awaiting-verification', output: 'ok' }, assertions: { outputIncludes: ['ok'] } }],
  };
  const runner = new EvalRunner({ executor: async ({ evalCase }) => evalCase.fixtureResult });
  const report = await runner.runSuite(suite, { providerIds: ['fixture'], executionMode: 'fixture' });
  assert.equal(report.lane, 'evaluator-plumbing-smoke');
  assert.equal(report.claimAllowed, false);
  assert.equal(report.claimScope, 'none');
  assert.ok(report.nonClaimReasons.includes('fixture-or-smoke-only'));
});

test('coding benchmark rejects fixture/mock execution, exposed hidden tests, and trivial verifiers', () => {
  const base = {
    id: 'coding', lane: 'agent-coding-benchmark', repositorySnapshotSha256: H('a'),
    hiddenVerifier: { id: 'hidden-v1', sha256: H('b'), opaque: true, visibleToExecutor: false, compositional: true },
    cases: [{ id: 'bug', input: { objective: 'fix bug' }, assertions: { state: 'awaiting-verification' } }],
  };
  assert.equal(evaluateEvalLanePolicy({ ...base, cases: [{ ...base.cases[0], fixtureResult: {} }] }, { executionMode: 'module' }).status, 'fail');
  assert.equal(evaluateEvalLanePolicy({ ...base, hiddenVerifier: { ...base.hiddenVerifier, visibleToExecutor: true } }, { executionMode: 'module' }).status, 'fail');
  assert.equal(evaluateEvalLanePolicy({ ...base, hiddenVerifier: { command: 'node -e "process.exit(0)"', id: 'bad', sha256: H('b'), opaque: true, visibleToExecutor: false, compositional: true } }, { executionMode: 'module' }).status, 'fail');
  assert.equal(evaluateEvalLanePolicy(base, { executionMode: 'fixture' }).status, 'fail');
});

test('coding and competitor lanes grant only their bounded claim scopes after hidden and independent gates', async () => {
  const suite = {
    id: 'coding', lane: 'agent-coding-benchmark', repositorySnapshotSha256: H('a'),
    hiddenVerifier: { id: 'hidden-v1', sha256: H('b'), opaque: true, visibleToExecutor: false, compositional: true },
    cases: [{ id: 'bug', input: { objective: 'fix bug' }, assertions: { state: 'awaiting-verification', evidenceComplete: true } }],
  };
  const executor = async () => ({ state: 'awaiting-verification', output: 'fixed', evidence: [{ status: 'pass', receiptSha256: H('c') }] });
  const hiddenVerifier = async () => ({ status: 'pass', compositional: true, receiptSha256: H('f') });
  const coding = await new EvalRunner({ executor, hiddenVerifier }).runSuite(suite, { providerIds: ['nolane'], executionMode: 'module' });
  assert.equal(coding.claimAllowed, true);
  assert.equal(coding.claimScope, 'coding-capability');

  const competitorSuite = { ...suite, id: 'duel', lane: 'independent-competitor-benchmark' };
  const denied = await new EvalRunner({ executor, hiddenVerifier }).runSuite(competitorSuite, { providerIds: ['nolane'], executionMode: 'module' });
  assert.equal(denied.claimAllowed, false);
  assert.ok(denied.nonClaimReasons.includes('independent-attestation-missing'));
  const allowed = await new EvalRunner({ executor, hiddenVerifier }).runSuite(competitorSuite, {
    providerIds: ['nolane'], executionMode: 'module',
    independentAttestation: { verified: true, operatorId: 'independent-lab', runDigest: H('d'), signatureSha256: H('e') },
  });
  assert.equal(allowed.claimAllowed, true);
  assert.equal(allowed.claimScope, 'comparative');
});
