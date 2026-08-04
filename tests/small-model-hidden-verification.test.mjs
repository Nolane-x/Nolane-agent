import test from 'node:test';
import assert from 'node:assert/strict';
import { HiddenVerificationSuite } from '../src/small-model/hidden-verification-suite.mjs';
import { VerifierRedTeam } from '../src/small-model/verifier-red-team.mjs';

test('HiddenVerificationSuite executes compositional hidden cases without exposing inputs', async () => {
  const suite = new HiddenVerificationSuite({ id: 'hidden-code', domain: 'javascript' });
  suite.registerCase({ id: 'c1', components: ['auth', 'path'], input: { token: 'x', path: '../a' }, expected: { allowed: false } });
  suite.registerCase({ id: 'c2', components: ['auth', 'mutation'], input: { token: null, action: 'write' }, expected: { allowed: false } });
  const before = suite.snapshot();
  assert.deepEqual(Object.keys(before), ['schema', 'id', 'domain', 'caseCount', 'componentCoverage', 'runs']);
  assert.equal(JSON.stringify(before).includes('../a'), false);
  const receipt = await suite.run({ candidateId: 'candidate-1', execute: async (input) => ({ allowed: Boolean(input.token) && !String(input.path ?? '').includes('..') && input.action !== 'write' }) });
  assert.equal(receipt.status, 'pass');
  assert.equal(receipt.passed, 2);
  assert.equal(receipt.compositional, true);
  assert.equal(JSON.stringify(receipt).includes('../a'), false);
  assert.match(receipt.hiddenSuiteSha256, /^[a-f0-9]{64}$/);
});

test('HiddenVerificationSuite fails candidates while preserving hidden data', async () => {
  const suite = new HiddenVerificationSuite({ id: 'hidden-code', domain: 'javascript' });
  suite.registerCase({ id: 'c1', components: ['auth', 'path'], input: { token: 'x', path: '../a' }, expected: { allowed: false } });
  const receipt = await suite.run({ candidateId: 'candidate-bad', execute: async () => ({ allowed: true }) });
  assert.equal(receipt.status, 'fail');
  assert.deepEqual(receipt.failures, [{ caseId: 'c1', components: ['auth', 'path'] }]);
});

test('VerifierRedTeam rejects self-reported passes, hidden-data access, write attempts and malformed evidence', () => {
  const redTeam = new VerifierRedTeam();
  for (const output of [
    { pass: true, selfReported: true, evidence: ['x'] },
    { pass: true, hiddenDataAccess: true, evidence: ['x'] },
    { pass: true, writeAttempt: true, evidence: ['x'] },
    { pass: true, evidence: [] },
    { pass: 'yes', evidence: ['x'] },
  ]) assert.equal(redTeam.inspect({ verifierId: 'v1', output }).accepted, false);
  const safe = redTeam.inspect({ verifierId: 'v1', output: { pass: true, evidence: ['sha256:abc'], readOnly: true } });
  assert.equal(safe.accepted, true);
  assert.match(safe.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(redTeam.snapshot().probes, 6);
});
