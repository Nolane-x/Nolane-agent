import test from 'node:test';
import assert from 'node:assert/strict';
import { RuntimeObservationStore } from '../src/repository/runtime-observation-store.mjs';

test('RuntimeObservationStore records bounded causal observations and projects graph edges', () => {
  let now = 1000;
  const store = new RuntimeObservationStore({ maxObservations: 4, maxPayloadBytes: 512, now: () => ++now });
  const row = store.append({ projectId: 'p1', missionId: 'm1', taskId: 't1', kind: 'call', sourceSymbolId: 'a', targetSymbolId: 'b', expectedEffect: 'b returns', actualEffect: 'b returned', payload: { authorization: 'Bearer secret-token', safe: 'ok' } });
  assert.equal(row.payload.authorization, '[REDACTED]');
  assert.equal(row.payload.safe, 'ok');
  const graph = store.graphProjection({ projectId: 'p1' });
  assert.equal(graph.edges[0].relation, 'runtime-calls');
  assert.equal(graph.edges[0].from, 'a');
  assert.equal(graph.edges[0].to, 'b');
  assert.match(row.receiptSha256, /^[a-f0-9]{64}$/);
});

test('RuntimeObservationStore covers exception, request, event, state, database, file, network, and process evidence and bounds retention', () => {
  const store = new RuntimeObservationStore({ maxObservations: 3, maxPayloadBytes: 128 });
  for (const kind of ['exception','request','event','state-transition','database-query','file-access','network-access','process-access']) store.append({ projectId: 'p', taskId: 't', kind, payload: { value: 'x'.repeat(500) } });
  const rows = store.query({ projectId: 'p' });
  assert.equal(rows.length, 3);
  assert.ok(rows.every((x) => JSON.stringify(x.payload).length <= 200));
});
