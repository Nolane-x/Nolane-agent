import assert from 'node:assert/strict';
import test from 'node:test';

import { ToolEffectVerifier } from '../src/cognition/tool-effect-verifier.mjs';

const sha = (char) => char.repeat(64);

test('verifies equality, numeric tolerance, and set inclusion from independent probes', () => {
  const verifier = new ToolEffectVerifier();
  const result = verifier.verify({
    toolRunReceiptSha256: sha('a'), declaredSuccess: true,
    expectedEffect: {
      file: { sha256: 'abc' },
      latencyMs: { $op: 'approx', $value: 100, $tolerance: 5 },
      passedTests: { $op: 'includes', $value: ['unit', 'integration'] },
    },
    actualEffect: { file: { sha256: 'abc' }, latencyMs: 103, passedTests: ['integration', 'unit', 'smoke'] },
    probes: [
      { probeId: 'fs', independent: true, receiptSha256: sha('b'), paths: ['file.sha256'] },
      { probeId: 'runtime', independent: true, receiptSha256: sha('c'), paths: ['latencyMs'] },
      { probeId: 'tests', independent: true, receiptSha256: sha('d'), paths: ['passedTests'] },
    ],
  });
  assert.equal(result.status, 'verified');
  assert.equal(result.assertions.every((item) => item.matched), true);
  assert.equal(result.independentProbeReceipts.length, 3);
});

test('detects false success when declared success does not match observed effect', () => {
  const verifier = new ToolEffectVerifier();
  const result = verifier.verify({
    toolRunReceiptSha256: sha('a'), declaredSuccess: true,
    expectedEffect: { targetTest: 'pass', publicApi: 'unchanged' },
    actualEffect: { targetTest: 'fail', publicApi: 'unchanged' },
    probes: [{ probeId: 'tests', independent: true, receiptSha256: sha('b'), paths: ['targetTest', 'publicApi'] }],
  });
  assert.equal(result.status, 'false_success');
  assert.deepEqual(result.mismatchedPaths, ['targetTest']);
  assert.equal(result.declaredSuccess, true);
});

test('returns inconclusive when effect paths lack independent evidence', () => {
  const verifier = new ToolEffectVerifier();
  const result = verifier.verify({
    toolRunReceiptSha256: sha('a'), declaredSuccess: true,
    expectedEffect: { fileWritten: true }, actualEffect: { fileWritten: true },
    probes: [{ probeId: 'tool-self-report', independent: false, receiptSha256: sha('b'), paths: ['fileWritten'] }],
  });
  assert.equal(result.status, 'inconclusive');
  assert.deepEqual(result.uncoveredPaths, ['fileWritten']);
});

test('empty expected effect is explicitly not applicable and unsupported operators fail closed', () => {
  const verifier = new ToolEffectVerifier();
  assert.equal(verifier.verify({ expectedEffect: {}, actualEffect: {} }).status, 'not_applicable');
  assert.throws(() => verifier.verify({
    toolRunReceiptSha256: sha('a'), expectedEffect: { value: { $op: 'execute', $value: 'rm -rf' } }, actualEffect: { value: 'x' },
    probes: [{ probeId: 'p', independent: true, receiptSha256: sha('b'), paths: ['value'] }],
  }), /unsupported effect operator/i);
});
