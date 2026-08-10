import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { DynamicContextStore } from '../src/agent/dynamic-context-store.mjs';
import { ContextHistoryArchive, TerminalHistoryRecorder } from '../src/agent/context-history-archive.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-context-history-'));
  const contextStore = new DynamicContextStore({ root: path.join(root, 'artifacts'), previewBytes: 128, maxArtifactBytes: 5_000_000 });
  const archive = new ContextHistoryArchive({ file: path.join(root, 'history.db'), contextStore, clock: () => '2026-07-29T00:00:00.000Z' });
  t.after(() => archive.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, contextStore, archive };
}

test('conversation history is archived without hidden reasoning or secrets and repeated archiving is idempotent', async (t) => {
  const { contextStore, archive } = await fixture(t);
  const messages = [
    { id: 'm1', role: 'user', content: 'Fix login. token=top-secret', status: 'complete', createdAt: '2026-07-29T00:00:01.000Z', metadata: { kind: 'objective' } },
    { id: 'm2', role: 'assistant', content: 'Internal chain of thought', status: 'complete', createdAt: '2026-07-29T00:00:02.000Z', metadata: { privateReasoning: true } },
    { id: 'm3', role: 'assistant', content: 'I updated auth.mjs.', status: 'complete', createdAt: '2026-07-29T00:00:03.000Z', metadata: { kind: 'completion', accessToken: 'never-index-this' } },
    { id: 'm4', role: 'system', content: 'hidden system policy', status: 'complete', createdAt: '2026-07-29T00:00:04.000Z', metadata: {} },
  ];

  const first = await archive.archiveConversation({ projectId: 'p1', missionId: 'mission-1', sessionId: 'session-1', messages, secretValues: ['top-secret', 'never-index-this'] });
  assert.equal(first.created, true);
  assert.equal(first.itemCount, 2);
  assert.match(first.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(first.artifact.filePath, undefined, 'public archive descriptors must not expose local storage paths');
  const page = await contextStore.read(first.artifact.id, { maxBytes: 100_000 });
  assert.match(page.content, /Fix login/);
  assert.match(page.content, /I updated auth\.mjs/);
  assert.equal(page.content.includes('Internal chain of thought'), false);
  assert.equal(page.content.includes('hidden system policy'), false);
  assert.equal(page.content.includes('top-secret'), false);
  assert.equal(page.content.includes('never-index-this'), false);

  const repeated = await archive.archiveConversation({ projectId: 'p1', missionId: 'mission-1', sessionId: 'session-1', messages, secretValues: ['top-secret'] });
  assert.equal(repeated.created, false);
  assert.equal(repeated.itemCount, 0);
  assert.deepEqual(archive.list({ projectId: 'p1', missionId: 'mission-1', kind: 'conversation' }).map((item) => item.id), [first.id]);
});

test('terminal history preserves complete stdout and stderr but never archives stdin or environment', async (t) => {
  const { contextStore, archive } = await fixture(t);
  const longOutput = `${'build line\n'.repeat(1_000)}failure-at-the-end`;
  const result = await archive.archiveTerminal({
    projectId: 'p1', missionId: 'mission-1', sessionId: 'term-1', secretValues: ['terminal-secret'], entries: [{
      id: 'command-1', command: '/usr/bin/node', args: ['test.mjs'], cwd: '/workspace', startedAt: '2026-07-29T00:00:00.000Z', endedAt: '2026-07-29T00:00:10.000Z', exitCode: 1,
      stdout: longOutput, stderr: 'TOKEN=terminal-secret\nstack trace', stdin: 'password-from-stdin', env: { API_KEY: 'terminal-secret' },
    }],
  });
  assert.equal(result.itemCount, 1);
  const restored = await contextStore.read(result.artifact.id, { maxBytes: 5_000_000 });
  assert.match(restored.content, /failure-at-the-end/);
  assert.match(restored.content, /stack trace/);
  assert.equal(restored.content.includes('terminal-secret'), false);
  assert.equal(restored.content.includes('password-from-stdin'), false);
  assert.equal(restored.content.includes('API_KEY'), false);

  const search = await archive.search({ projectId: 'p1', sessionId: 'term-1', kind: 'terminal', query: 'failure-at-the-end' });
  assert.equal(search.items.length, 1);
  assert.equal(search.items[0].archiveId, result.id);
});

test('conversation compaction keeps original searchable artifacts and stores a separate summary pointer', async (t) => {
  const { contextStore, archive } = await fixture(t);
  const compacted = await archive.compactConversation({
    projectId: 'p1', missionId: 'mission-1', sessionId: 'session-1',
    messages: [
      { id: 'm1', role: 'user', content: 'The migration must preserve legacy IDs.', createdAt: '2026-07-29T00:00:01.000Z' },
      { id: 'm2', role: 'assistant', content: 'Plan: add an id mapping table.', createdAt: '2026-07-29T00:00:02.000Z' },
    ],
    summary: 'Migration discussion: preserve IDs and add mapping.',
  });
  assert.equal(compacted.schema, 'forge.context-history-compaction.v1');
  assert.equal(compacted.originals.length, 1);
  assert.equal(compacted.summary.kind, 'conversation-summary');
  assert.deepEqual(compacted.summary.metadata.originalArtifactIds, compacted.originals.map((item) => item.artifact.id));

  const originalMatches = await archive.search({ projectId: 'p1', missionId: 'mission-1', kind: 'conversation', query: 'legacy IDs' });
  assert.equal(originalMatches.items.length, 1);
  const summaryPage = await contextStore.read(compacted.summary.artifact.id, { maxBytes: 10_000 });
  assert.match(summaryPage.content, /preserve IDs/);
});

test('history index survives restart, enforces project scope, and terminal recorder archives output on exit', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-context-history-restart-'));
  const contextStore = new DynamicContextStore({ root: path.join(root, 'artifacts') });
  const file = path.join(root, 'history.db');
  const first = new ContextHistoryArchive({ file, contextStore });
  const manager = new EventEmitter();
  const recorder = new TerminalHistoryRecorder({ terminalManager: manager, archive: first, root: path.join(root, 'terminal-spool') });
  recorder.start();
  manager.emit('created', { projectId: 'p1', id: 'term-live', cwd: '/workspace', shell: '/bin/sh', args: ['-l'] });
  manager.emit('output', { projectId: 'p1', sessionId: 'term-live', cursor: 5, data: 'hello' });
  manager.emit('output', { projectId: 'p1', sessionId: 'term-live', cursor: 11, data: ' world' });
  manager.emit('exit', { projectId: 'p1', sessionId: 'term-live', exitCode: 0, signal: null });
  await recorder.flush();
  await recorder.close();
  first.close();

  const second = new ContextHistoryArchive({ file, contextStore });
  t.after(() => second.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  const records = second.list({ projectId: 'p1', sessionId: 'term-live', kind: 'terminal' });
  assert.equal(records.length, 1);
  await assert.rejects(() => second.get(records[0].id, { projectId: 'p2' }), /scope/i);
  const page = await contextStore.read(records[0].artifact.id, { maxBytes: 10_000 });
  assert.match(page.content, /hello world/);
  assert.equal(await readFile(path.join(root, 'terminal-spool', '.keep'), 'utf8').catch(() => null), null, 'recorder must clean temporary spool files');
});
