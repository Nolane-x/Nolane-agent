import test from 'node:test';
import assert from 'node:assert/strict';
import { PostMergeSentinel } from '../src/frontier/post-merge-sentinel.mjs';

const H=(c)=>c.repeat(64);

test('post merge sentinel correlates CI, crash, log, performance and security signals to source receipts', () => {
  const sentinel = new PostMergeSentinel({ maxSignals: 20 });
  const ids = [
    ['ci','failed acceptance suite'], ['crash','null dereference'], ['log','error fingerprint'], ['performance','p95 regression'], ['security','taint alert'],
  ].map(([kind,summary],i)=>sentinel.ingestSignal({ signalId:`s${i}`, kind, severity: kind==='security'?'critical':'high', summary, observedAtMs: 1_000+i, sourceReceiptSha256:H(String((i+1)%10)) }).signalId);
  const trace = sentinel.traceIncident({ incidentId:'inc-1', signalIds:ids, attribution:{ decisionReceiptSha256:H('a'), patchReceiptSha256:H('b'), testReceiptSha256:H('c'), agentReceiptSha256:H('d'), commitReceiptSha256:H('e') }, confidence:0.93 });
  assert.equal(trace.status,'attributed');
  assert.equal(trace.signalKinds.length,5);
  assert.equal(trace.attribution.patchReceiptSha256,H('b'));
  assert.equal(trace.claims.rawLogsStored,false);
});

test('post merge sentinel blocks ambiguous attribution', () => {
  const sentinel = new PostMergeSentinel();
  sentinel.ingestSignal({ signalId:'s1', kind:'crash', severity:'high', summary:'crash fingerprint', observedAtMs:1, sourceReceiptSha256:H('1') });
  const trace = sentinel.traceIncident({ incidentId:'inc-2', signalIds:['s1'], candidates:[{ patchReceiptSha256:H('2'), confidence:0.6 },{ patchReceiptSha256:H('3'), confidence:0.58 }] });
  assert.equal(trace.status,'ambiguous');
  assert.equal(trace.selfHealingEligible,false);
});
