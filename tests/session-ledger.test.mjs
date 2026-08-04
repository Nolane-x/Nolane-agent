import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFile, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SessionLedger } from '../src/sessions/session-ledger.mjs';
import { SessionReplay } from '../src/sessions/session-replay.mjs';

async function fixture(t, sessionId = 'session-1') {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'forge-session-ledger-'));
  t.after(async () => { await import('node:fs/promises').then(({ rm }) => rm(directory, { recursive: true, force: true })); });
  const ledger = await SessionLedger.open({ directory, sessionId, signer: { async sign(digest) { return `signed:${digest}`; } } });
  return { directory, ledger, file: path.join(directory, `${sessionId}.jsonl`) };
}

test('SessionLedger appends a verifiable hash chain and binds checkpoints to state digests', async (t) => {
  const { ledger } = await fixture(t);
  const first = await ledger.append('task.started', { taskId: 't1', objective: 'build' });
  const second = await ledger.append('state.patch', { patch: { status: 'running' } });
  const checkpoint = await ledger.checkpoint({
    repository: { head: 'abc123', diffSha256: 'd'.repeat(64) },
    task: { id: 't1', status: 'running' },
    plan: { revision: 2, steps: ['build', 'test'] },
    context: { digest: 'c'.repeat(64) },
    receipts: ['r1', 'r2'],
  });
  const report = await ledger.verify();
  assert.equal(report.valid, true);
  assert.equal(report.events, 3);
  assert.equal(first.seq, 1);
  assert.equal(second.parentSeq, 1);
  assert.equal(checkpoint.type, 'session.checkpoint');
  assert.match(checkpoint.data.stateDigest, /^[a-f0-9]{64}$/);
  assert.equal(checkpoint.data.signature, `signed:${checkpoint.data.stateDigest}`);
  assert.equal(report.lastHash, checkpoint.hash);
});

test('SessionLedger detects the first corrupted physical event', async (t) => {
  const { ledger, file } = await fixture(t);
  await ledger.append('task.started', { taskId: 't1' });
  await ledger.append('state.patch', { patch: { count: 1 } });
  const lines = (await readFile(file, 'utf8')).trim().split('\n').map(JSON.parse);
  lines[1].data.patch.count = 999;
  await writeFile(file, `${lines.map(JSON.stringify).join('\n')}\n`);
  await assert.rejects(() => ledger.verify(), /SESSION_LEDGER_CORRUPT.*sequence 2/);
});

test('rewind creates a new branch cursor without deleting abandoned history', async (t) => {
  const { ledger, file } = await fixture(t);
  await ledger.append('state.patch', { patch: { value: 1 } });
  const checkpoint = await ledger.checkpoint({ task: { value: 1 }, repository: {}, plan: {}, context: {}, receipts: [] });
  const abandoned = await ledger.append('state.patch', { patch: { value: 2, abandoned: true } });
  const rewind = await ledger.rewind(checkpoint.seq, { reason: 'try another approach' });
  const replacement = await ledger.append('state.patch', { patch: { value: 3, replacement: true } });
  const physical = (await readFile(file, 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(physical.length, 5);
  assert.equal(rewind.data.targetSeq, checkpoint.seq);
  assert.notEqual(replacement.branchId, abandoned.branchId);
  const replay = await ledger.replayCurrent({ initialState: {}, reducer: (state, event) => event.type === 'state.patch' ? { ...state, ...event.data.patch } : state });
  assert.deepEqual(replay.state, { value: 3, replacement: true });
  assert.equal(replay.events.some((event) => event.seq === abandoned.seq), false);
});

test('fork creates a new session lineage bound to a verified source event', async (t) => {
  const { ledger, directory } = await fixture(t, 'source-session');
  await ledger.append('state.patch', { patch: { value: 7 } });
  const checkpoint = await ledger.checkpoint({ task: { value: 7 }, repository: {}, plan: {}, context: {}, receipts: [] });
  const fork = await ledger.fork({ newSessionId: 'forked-session', targetSeq: checkpoint.seq });
  const verification = await fork.verify();
  const events = await fork.readAll();
  assert.equal(verification.valid, true);
  assert.equal(events[0].type, 'session.forked');
  assert.equal(events[0].data.sourceSessionId, 'source-session');
  assert.equal(events[0].data.sourceSeq, checkpoint.seq);
  assert.equal(events[0].data.sourceHash, checkpoint.hash);
  assert.equal(path.dirname(fork.file), directory);
});

test('SessionReplay deterministically materializes a selected branch lineage', async () => {
  const events = [
    { seq: 1, parentSeq: 0, branchId: 'main', type: 'state.patch', data: { patch: { a: 1 } } },
    { seq: 2, parentSeq: 1, branchId: 'main', type: 'state.patch', data: { patch: { b: 2 } } },
    { seq: 3, parentSeq: 1, branchId: 'branch-b', type: 'state.patch', data: { patch: { c: 3 } } },
  ];
  const replay = SessionReplay.materialize(events, { cursorSeq: 3, initialState: {}, reducer: (state, event) => ({ ...state, ...event.data.patch }) });
  assert.deepEqual(replay.state, { a: 1, c: 3 });
  assert.deepEqual(replay.lineage, [1, 3]);
  assert.throws(() => SessionReplay.materialize(events, { cursorSeq: 99, initialState: {}, reducer: (state) => state }), /SESSION_REPLAY_CURSOR/);
});
