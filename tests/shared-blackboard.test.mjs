import assert from 'node:assert/strict';
import test from 'node:test';
import { SharedBlackboard } from '../src/collaboration/shared-blackboard.mjs';

const hash = (c) => c.repeat(64);

test('shared blackboard versions entries and rejects stale fencing writes', () => {
  let now = 1_000;
  const board = new SharedBlackboard({ clock: () => now });
  const lease = board.heartbeat({ agentId: 'executor', ttlMs: 1_000 });
  const first = board.write({
    kind: 'fact', key: 'session-source', valueSummary: 'database', agentId: 'executor', domain: 'backend', confidence: 0.8,
    provenance: { kind: 'runtime', receiptSha256: hash('a') }, fencingToken: lease.fencingToken, ttlMs: 500,
  });
  assert.equal(first.version, 1);
  const second = board.write({
    kind: 'fact', key: 'session-source', valueSummary: 'database-primary', agentId: 'executor', domain: 'backend', confidence: 0.9,
    provenance: { kind: 'test', receiptSha256: hash('b') }, fencingToken: lease.fencingToken, expectedVersion: 1,
  });
  assert.equal(second.version, 2);
  assert.throws(() => board.write({
    kind: 'fact', key: 'session-source', valueSummary: 'stale', agentId: 'executor', domain: 'backend', confidence: 1,
    provenance: { kind: 'chat', receiptSha256: hash('c') }, fencingToken: lease.fencingToken - 1, expectedVersion: 2,
  }), /stale fencing token/i);
  assert.equal(board.resolve('session-source').entry.valueSummary, 'database-primary');
  now = 2_000;
  assert.equal(board.read({ includeExpired: false }).length, 1, 'latest entry without TTL survives');
});

test('shared blackboard retains contradictions and separates beliefs by agent and domain', () => {
  const board = new SharedBlackboard();
  const a = board.heartbeat({ agentId: 'executor' });
  const b = board.heartbeat({ agentId: 'reviewer' });
  board.write({ kind: 'belief', key: 'root-cause', valueSummary: 'cache', agentId: 'executor', domain: 'debug', confidence: 0.72, provenance: { kind: 'trace', receiptSha256: hash('d') }, fencingToken: a.fencingToken, supports: ['h1'] });
  board.write({ kind: 'belief', key: 'root-cause', valueSummary: 'clock', agentId: 'reviewer', domain: 'debug', confidence: 0.68, provenance: { kind: 'test', receiptSha256: hash('e') }, fencingToken: b.fencingToken, contradicts: ['h1'] });
  const resolution = board.resolve('root-cause');
  assert.equal(resolution.status, 'conflict');
  assert.equal(resolution.candidates.length, 2);
  assert.deepEqual(board.read({ agentId: 'reviewer', domain: 'debug' }).map((entry) => entry.valueSummary), ['clock']);
  assert.equal(board.snapshot().claims.rawPromptStored, false);
});
