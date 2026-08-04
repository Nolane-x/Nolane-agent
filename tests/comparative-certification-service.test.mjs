import test from 'node:test';
import assert from 'node:assert/strict';
import { ComparativeCertificationService } from '../src/benchmark/comparative-certification-service.mjs';
import { benchmarkRunDigest } from '../src/benchmark/independent-attestation.mjs';

const sha = (c) => c.repeat(64);

function runs({ fake = false, forgeWins = true, count = 20 } = {}) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push({ system: 'Forge', taskId: `t${i}`, verified: forgeWins, providerKind: fake ? 'fake' : 'real', modelDigest: sha('a'), contractReceiptSha256: sha('b'), durationMs: 100, usage: { tokens: 100, costUsd: 0 }, verification: [] });
    out.push({ system: 'Other', taskId: `t${i}`, verified: false, providerKind: 'real', modelDigest: sha('a'), contractReceiptSha256: sha('b'), durationMs: 100, usage: { tokens: 100, costUsd: 0 }, verification: [] });
  }
  return out;
}

const suite = { id: 'suite', version: 1, schemaVersion: 2, distribution: { id: 'dist', version: 1, fingerprint: sha('c') }, tasks: [] };

test('fake provider runs remain smoke-only and cannot unlock comparative claims', () => {
  const service = new ComparativeCertificationService({ minimumTasks: 20 });
  const data = runs({ fake: true });
  const report = service.certify({ suite, runs: data, contracts: [{ status: 'pass', receiptSha256: sha('b') }], attestation: { verified: true, claimantSystem: 'Forge', runDigest: benchmarkRunDigest(data) } });
  assert.equal(report.claimAllowed, false);
  assert.ok(report.reasons.includes('fake-provider-present'));
});

test('certification requires comparable contracts exact attestation and statistically separated success', () => {
  const service = new ComparativeCertificationService({ minimumTasks: 20 });
  const data = runs();
  const report = service.certify({
    suite, runs: data,
    contracts: [{ status: 'pass', receiptSha256: sha('b') }],
    attestation: { verified: true, claimantSystem: 'Forge', runDigest: benchmarkRunDigest(data), operator: { id: 'independent', name: 'Independent Lab' } },
  });
  assert.equal(report.claimAllowed, true);
  assert.equal(report.commonTaskCount, 20);
  assert.equal(report.claimantSystem, 'Forge');
});

test('benchmark-specific behavior or incomparable contract locks the claim', () => {
  const service = new ComparativeCertificationService({ minimumTasks: 20 });
  const data = runs();
  data[0] = { ...data[0], benchmarkSpecificBehaviorDetected: true };
  const report = service.certify({ suite, runs: data, contracts: [{ status: 'reject', receiptSha256: sha('d') }], attestation: { verified: true, claimantSystem: 'Forge', runDigest: benchmarkRunDigest(data) } });
  assert.equal(report.claimAllowed, false);
  assert.ok(report.reasons.includes('incomparable-contract'));
  assert.ok(report.reasons.includes('benchmark-specific-behavior'));
});
