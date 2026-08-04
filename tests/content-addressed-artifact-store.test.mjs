import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ContentAddressedArtifactStore } from '../src/storage/content-addressed-artifact-store.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-cas-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, store: new ContentAddressedArtifactStore({ root, maxHotEntries: 10, maxPreviewBytes: 12 }) };
}

test('ContentAddressedArtifactStore stores duplicate payload once and returns bounded projections', async (t) => {
  const f = await fixture(t);
  const first = await f.store.put({ kind: 'tool-output', data: 'abcdefghijklmnopqrstuvwxyz', refs: { missionId: 'm1', taskId: 't1' }, summary: 'alphabet output' });
  const second = await f.store.put({ kind: 'tool-output', data: 'abcdefghijklmnopqrstuvwxyz', refs: { missionId: 'm2', taskId: 't2' }, summary: 'same bytes' });
  assert.equal(first.sha256, second.sha256);
  assert.equal(second.deduplicated, true);
  assert.equal(f.store.snapshot().uniqueBlobs, 1);
  assert.equal(first.projection.preview, 'abcdefghijkl');
  assert.equal(first.projection.bytes, 26);
  assert.equal(first.projection.rawStoredInMemory, false);
  assert.doesNotMatch(JSON.stringify(f.store.snapshot()), /mnopqrstuvwxyz/);
});

test('ContentAddressedArtifactStore retrieves raw bytes by hash and cursor range', async (t) => {
  const f = await fixture(t);
  const record = await f.store.put({ kind: 'log', data: Buffer.from('0123456789abcdef'), refs: { missionId: 'm1' }, summary: 'hex log' });
  const full = await f.store.get(record.sha256);
  const range = await f.store.get(record.sha256, { offset: 4, length: 6 });
  assert.equal(full.data.toString(), '0123456789abcdef');
  assert.equal(range.data.toString(), '456789');
  assert.equal(range.nextOffset, 10);
  assert.equal(range.eof, false);
  assert.equal((await readFile(record.filePath)).toString(), '0123456789abcdef');
});

test('ContentAddressedArtifactStore rejects secret metadata and bounds context output', async (t) => {
  const f = await fixture(t);
  await assert.rejects(() => f.store.put({ kind: 'tool-output', data: 'safe bytes', refs: { apiKey: 'secret' } }), /secret|private/i);
  const record = await f.store.put({ kind: 'tool-output', data: 'line one\nline two\nline three', refs: { taskId: 't1' }, summary: 'three lines' });
  const bounded = f.store.contextProjection(record.sha256, { maxBytes: 10 });
  assert.equal(Buffer.byteLength(bounded.preview), 10);
  assert.equal(bounded.rawArtifactSha256, record.sha256);
  assert.equal(bounded.truncated, true);
});

test('ContentAddressedArtifactStore privacy deletion removes bytes and leaves a content-free tombstone', async (t) => {
  const f = await fixture(t);
  const record = await f.store.put({ kind: 'memory-raw', data: 'private payload to remove', refs: { projectId: 'p1' }, summary: 'private' });
  const tombstone = await f.store.delete(record.sha256, { actor: 'user:alice', reason: 'privacy request' });
  assert.equal(tombstone.deleted, true);
  await assert.rejects(() => f.store.get(record.sha256), /not found/i);
  assert.doesNotMatch(JSON.stringify(tombstone), /private payload/);
});
