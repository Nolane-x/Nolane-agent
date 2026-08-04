import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  SessionStreamCoordinator,
  SessionWindowLeaseRegistry,
  SessionCompressionService,
  ConversationCorrectionService,
  SessionContextDriftEngine,
  SessionVirtualListModel,
  SessionTerminalBinding,
  SessionProductRuntimeWave8,
} from '../src/native-core/session-product-runtime-wave8.mjs';

async function temp(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-wave8-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('session stream persists and resumes a 10k message fixture without exposing hidden history', async (t) => {
  const root = await temp(t);
  const file = path.join(root, 'streams.json');
  const stream = new SessionStreamCoordinator({ file });
  await stream.open();
  const messages = Array.from({ length: 10_000 }, (_, i) => ({ id: `m${i}`, role: i % 2 ? 'assistant' : 'user', text: `message-${i}`, visibility: i % 17 === 0 ? 'hidden' : 'public' }));
  await stream.appendMany('s1', messages);
  const publicView = stream.resume('s1');
  assert.equal(publicView.messages.length, 10_000 - Math.ceil(10_000 / 17));
  assert.equal(publicView.messages.some((entry) => entry.visibility === 'hidden'), false);
  const reopened = new SessionStreamCoordinator({ file });
  await reopened.open();
  assert.deepEqual(reopened.resume('s1'), publicView);
});

test('queue stop aborts provider and tool work and future streams remain usable', async (t) => {
  const root = await temp(t);
  const stream = new SessionStreamCoordinator({ file: path.join(root, 'streams.json') });
  await stream.open();
  const provider = new AbortController(); const tool = new AbortController();
  stream.trackWork('s1', { id: 'provider', controller: provider });
  stream.trackWork('s1', { id: 'tool', controller: tool });
  const stopped = await stream.stop('s1', 'user-stop');
  assert.equal(stopped.cancelled, 2);
  assert.equal(provider.signal.aborted, true);
  assert.equal(tool.signal.aborted, true);
  await stream.append('s1', { id: 'm1', role: 'user', text: 'after stop' });
  assert.equal(stream.resume('s1').messages.length, 1);
});

test('cross-window lease rejects duplicate execution and recovers after expiry', () => {
  let now = 1_000;
  const leases = new SessionWindowLeaseRegistry({ clock: () => now });
  assert.equal(leases.acquire({ sessionId: 's1', windowId: 'w1', ttlMs: 100 }).owner, 'w1');
  assert.throws(() => leases.acquire({ sessionId: 's1', windowId: 'w2', ttlMs: 100 }), (error) => error.code === 'LEASE_CONFLICT');
  now = 1_101;
  assert.equal(leases.acquire({ sessionId: 's1', windowId: 'w2', ttlMs: 100 }).owner, 'w2');
  assert.equal(leases.release({ sessionId: 's1', windowId: 'w1' }).released, false);
});

test('compression lineage is deterministic and correction never exposes hidden history', () => {
  const compression = new SessionCompressionService();
  const messages = [
    { id: 'm1', role: 'user', text: 'alpha', visibility: 'public' },
    { id: 'h1', role: 'system', text: 'private thought', visibility: 'hidden' },
    { id: 'm2', role: 'assistant', text: 'beta', visibility: 'public' },
  ];
  const a = compression.compress({ sessionId: 's1', messages, maxCharacters: 20, keepRecent: 1 });
  const b = compression.compress({ sessionId: 's1', messages, maxCharacters: 20, keepRecent: 1 });
  assert.equal(a.receiptSha256, b.receiptSha256);
  assert.deepEqual(a.lineage, ['m1', 'm2']);
  assert.equal(JSON.stringify(a).includes('private thought'), false);

  const correction = new ConversationCorrectionService({ messages });
  assert.throws(() => correction.correct({ messageId: 'h1', replacement: 'leak' }), (error) => error.code === 'HIDDEN_MESSAGE_DENIED');
  const changed = correction.correct({ messageId: 'm2', replacement: 'fixed' });
  assert.equal(changed.message.text, 'fixed');
  assert.equal(correction.undo().message.text, 'beta');
});

test('context drift, virtual list and terminal binding provide deterministic product models', () => {
  const drift = new SessionContextDriftEngine();
  const report = drift.compare({ baseline: { cwd: '/a', model: 'm1', files: ['a.js'] }, current: { cwd: '/b', model: 'm2', files: ['a.js', 'b.js'] } });
  assert.deepEqual(report.changedFields, ['cwd', 'files', 'model']);
  assert.equal(report.suggestions.length, 3);

  const list = new SessionVirtualListModel({ items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] });
  list.pin('b', true); list.reorder('c', 0); list.archive('a', true);
  assert.deepEqual(list.window({ start: 0, count: 5 }).items.map((entry) => entry.id), ['b', 'c']);

  const terminals = new SessionTerminalBinding();
  assert.equal(terminals.bind({ sessionId: 's1', terminalId: 't1', windowId: 'w1' }).terminalId, 't1');
  assert.throws(() => terminals.bind({ sessionId: 's1', terminalId: 't2', windowId: 'w2' }), (error) => error.code === 'TERMINAL_BINDING_CONFLICT');
  assert.equal(terminals.unbind({ sessionId: 's1', windowId: 'w1' }).released, true);
});

test('wave8 aggregate opens, snapshots and projects public state only', async (t) => {
  const root = await temp(t);
  const runtime = new SessionProductRuntimeWave8({ dataDir: root });
  await runtime.open();
  await runtime.stream.append('s1', { id: 'm1', role: 'user', text: 'hello' });
  await runtime.stream.append('s1', { id: 'h1', role: 'system', text: 'hidden', visibility: 'hidden' });
  const snapshot = runtime.snapshot();
  assert.equal(snapshot.sessions, 1);
  assert.equal(JSON.stringify(snapshot).includes('hidden'), false);
});
