import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NolaneSessionStore } from '../src/nolane-native/session-store.mjs';
import { SessionLifecycleRuntime } from '../src/native-core/session-lifecycle-runtime.mjs';

async function setup(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-session-wave4-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new NolaneSessionStore({ root: path.join(root, 'store') });
  await store.open();
  const runtime = new SessionLifecycleRuntime({ store, file: path.join(root, 'lifecycle.json'), clock: (() => { let n = 1000; return () => ++n; })(), maxInputHistory: 3 });
  await runtime.open();
  return { root, store, runtime };
}

test('session lifecycle persists profile-scoped metadata, listing and input history across restart', async (t) => {
  const { root, store, runtime } = await setup(t);
  await store.createSession({ id: 's1', title: 'Retry work', projectId: 'p1', profileId: 'alice' });
  await store.appendMessage('s1', { id: 'm1', role: 'user', text: 'fix retry' }, { profileId: 'alice' });
  const meta = await runtime.updateMetadata('s1', { profileId: 'alice', pinned: true, color: 'blue', status: 'active', expectedVersion: 0 });
  assert.equal(meta.version, 1);
  await assert.rejects(() => runtime.updateMetadata('s1', { profileId: 'bob', pinned: false }), /profile scope/i);
  await runtime.pushInputHistory({ profileId: 'alice', value: 'one' });
  await runtime.pushInputHistory({ profileId: 'alice', value: 'two' });
  await runtime.pushInputHistory({ profileId: 'alice', value: 'three' });
  await runtime.pushInputHistory({ profileId: 'alice', value: 'four' });
  assert.deepEqual(runtime.inputHistory({ profileId: 'alice' }), ['two', 'three', 'four']);
  assert.equal(runtime.list({ profileId: 'alice', query: 'retry', pinned: true })[0].metadata.color, 'blue');
  const restarted = new SessionLifecycleRuntime({ store, file: path.join(root, 'lifecycle.json'), maxInputHistory: 3 });
  await restarted.open();
  assert.equal(restarted.list({ profileId: 'alice' })[0].metadata.pinned, true);
  assert.deepEqual(restarted.inputHistory({ profileId: 'alice' }), ['two', 'three', 'four']);
});

test('session lifecycle branches, rewinds, queues prompts and exports safe markdown/html/json', async (t) => {
  const { store, runtime } = await setup(t);
  await store.createSession({ id: 'parent', title: '<Retry & Fix>', projectId: 'p1', profileId: 'alice' });
  await store.appendMessage('parent', { id: 'm1', role: 'user', text: '<script>alert(1)</script> first' }, { profileId: 'alice' });
  await store.appendMessage('parent', { id: 'm2', role: 'assistant', text: 'second' }, { profileId: 'alice' });
  const branch = await runtime.branch({ sourceSessionId: 'parent', newSessionId: 'child', profileId: 'alice', throughMessageId: 'm1', title: 'Child' });
  assert.equal(branch.messages, 1);
  assert.deepEqual(store.lineage('child', { profileId: 'alice' }).map((entry) => entry.id), ['parent', 'child']);
  const rewind = await runtime.rewind({ sessionId: 'parent', newSessionId: 'rewind', profileId: 'alice', toMessageId: 'm1' });
  assert.equal(rewind.messages, 1);
  await runtime.enqueuePrompt({ sessionId: 'parent', profileId: 'alice', id: 'q1', text: 'next' });
  assert.deepEqual((await runtime.drainPromptQueue({ sessionId: 'parent', profileId: 'alice', limit: 1 })).map((entry) => entry.id), ['q1']);
  const restartedQueue = new SessionLifecycleRuntime({ store, file: runtime.file });
  await restartedQueue.open();
  assert.equal(restartedQueue.snapshot().queuedPrompts, 0);
  const md = runtime.exportSession({ sessionId: 'parent', profileId: 'alice', format: 'markdown' });
  const html = runtime.exportSession({ sessionId: 'parent', profileId: 'alice', format: 'html' });
  const json = runtime.exportSession({ sessionId: 'parent', profileId: 'alice', format: 'json' });
  assert.match(md.content, /Retry & Fix/);
  assert.equal(html.content.includes('<script>'), false);
  assert.equal(JSON.parse(json.content).session.id, 'parent');
});
