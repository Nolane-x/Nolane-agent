import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTruthLedgerRecord, summarizeTruthLedger } from '../src/forensics/truth-ledger.mjs';

const base = {
  id: 'mapping-aaaaaaaaaaaaaaaaaaaaaaaa',
  upstreamId: 'nolane-native-source-bbbbbbbbbbbbbbbbbbbbbbbb',
  upstreamSourceAvailability: 'verified',
  upstreamSymbolId: 'upstream-symbol',
  nolaneSymbolIds: ['symbol-cccccccccccccccccccccccc'],
  status: 'exact',
  productionWiring: ['src/runtime.mjs'],
  positiveAssertions: ['tests/runtime.test.mjs#runs'],
  negativeAssertions: ['tests/runtime.test.mjs#rejects-invalid'],
  failureBranches: 1,
  compatibilityEvidence: [],
  exclusion: null,
};

test('truth ledger blocks exact mappings without canonical source or direct evidence', () => {
  assert.throws(() => validateTruthLedgerRecord({ ...base, upstreamSourceAvailability: 'source-bytes-unavailable' }), /canonical upstream source/i);
  assert.throws(() => validateTruthLedgerRecord({ ...base, productionWiring: [] }), /production wiring/i);
  assert.throws(() => validateTruthLedgerRecord({ ...base, positiveAssertions: [] }), /positive assertion/i);
  assert.throws(() => validateTruthLedgerRecord({ ...base, negativeAssertions: [] }), /negative assertion/i);
});

test('superset requires compatibility evidence and exclusion requires a concrete category', () => {
  assert.throws(() => validateTruthLedgerRecord({ ...base, status: 'superset' }), /compatibility evidence/i);
  assert.throws(() => validateTruthLedgerRecord({ ...base, status: 'excluded-with-reason', upstreamSymbolId: null, nolaneSymbolIds: [], productionWiring: [], positiveAssertions: [], negativeAssertions: [], failureBranches: 0, exclusion: { category: '', reason: 'x' } }), /exclusion category/i);
});

test('truth ledger summary rejects duplicate upstream ownership and reports blockers', () => {
  const exact = validateTruthLedgerRecord(base);
  assert.throws(() => summarizeTruthLedger([exact, { ...exact, id: 'mapping-dddddddddddddddddddddddd' }]), /duplicate upstream ownership/i);
  const unresolved = validateTruthLedgerRecord({
    ...base,
    id: 'mapping-eeeeeeeeeeeeeeeeeeeeeeee',
    upstreamId: 'nolane-native-source-ffffffffffffffffffffffff',
    upstreamSourceAvailability: 'source-bytes-unavailable',
    upstreamSymbolId: null,
    nolaneSymbolIds: [],
    status: 'upstream-source-unavailable',
    productionWiring: [],
    positiveAssertions: [],
    negativeAssertions: [],
    failureBranches: 0,
  });
  const summary = summarizeTruthLedger([exact, unresolved]);
  assert.equal(summary.resolved, 1);
  assert.equal(summary.unresolved, 1);
  assert.equal(summary.completeParityEligible, false);
  assert.equal(summary.blockersTotal, 1);
  assert.equal(summary.blockerSample.length, 1);
});
