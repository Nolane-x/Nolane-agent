import test from 'node:test';
import assert from 'node:assert/strict';
import { VerifierMesh } from '../src/small-model/verifier-mesh.mjs';

test('VerifierMesh refuses a verifier without an evaluator', () => {
  const mesh = new VerifierMesh();
  assert.throws(() => mesh.register({ id: 'missing', soundnessScope: ['unit'], readOnly: true, independent: true }), /evaluate/i);
});

test('VerifierMesh converts evaluator failure into error and never pass', async () => {
  const mesh = new VerifierMesh();
  mesh.register({ id: 'broken', soundnessScope: ['unit'], readOnly: true, independent: true, evaluate: async () => { throw new Error('boom'); } });
  const receipt = await mesh.verify({ candidateId: 'c1' });
  assert.equal(receipt.status, 'error');
  assert.equal(receipt.decisions[0].pass, false);
  assert.equal(receipt.decisions[0].error, true);
  assert.match(receipt.decisions[0].reason, /boom/);
});

test('VerifierMesh treats malformed or abstaining decisions as non-pass', async () => {
  const malformed = new VerifierMesh();
  malformed.register({ id: 'bad-shape', soundnessScope: ['unit'], readOnly: true, independent: true, evaluate: async () => ({ score: 1 }) });
  const malformedReceipt = await malformed.verify({ candidateId: 'c1' });
  assert.equal(malformedReceipt.status, 'error');

  const abstaining = new VerifierMesh();
  abstaining.register({ id: 'no-oracle', soundnessScope: ['external'], readOnly: true, independent: true, evaluate: async () => ({ abstain: true, reason: 'credential unavailable' }) });
  const abstainReceipt = await abstaining.verify({ candidateId: 'c2' });
  assert.equal(abstainReceipt.status, 'abstain');
  assert.equal(abstainReceipt.decisions[0].pass, false);
});

test('VerifierMesh cannot report pass when any required verifier errors or abstains', async () => {
  const mesh = new VerifierMesh();
  mesh.register({ id: 'tests', soundnessScope: ['unit'], readOnly: true, independent: true, evaluate: async () => ({ pass: true }) });
  mesh.register({ id: 'external', soundnessScope: ['provider-real'], readOnly: true, independent: true, evaluate: async () => ({ abstain: true, reason: 'not available' }) });
  const receipt = await mesh.verify({ candidateId: 'c3' });
  assert.notEqual(receipt.status, 'pass');
  assert.equal(receipt.status, 'abstain');
});
