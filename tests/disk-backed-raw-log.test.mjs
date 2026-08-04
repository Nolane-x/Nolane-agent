import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { DiskBackedRawLog } from '../src/runtime/disk-backed-raw-log.mjs';

function fixture(t, options = {}) {
  const rootDir = mkdtempSync(join(tmpdir(), 'forge-raw-log-'));
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));
  return { rootDir, log: new DiskBackedRawLog({ rootDir, ...options }) };
}

test('stores redacted raw records on disk while snapshots retain summaries only', (t) => {
  const { rootDir, log } = fixture(t);
  const appended = log.append('mission-1', { type: 'tool', message: 'hello', apiKey: 'SECRET', nested: { authorization: 'Bearer abc123' } });
  const disk = readFileSync(join(rootDir, 'mission-1.frlog'), 'utf8');
  assert.match(disk, /hello/);
  assert.equal(disk.includes('SECRET'), false);
  assert.equal(disk.includes('abc123'), false);
  const snapshot = log.snapshot('mission-1');
  assert.equal(JSON.stringify(snapshot).includes('hello'), false);
  assert.equal(snapshot.recordCount, 1);
  assert.equal(snapshot.lastReceiptSha256, appended.receiptSha256);
  assert.equal(Object.isFrozen(snapshot), true);
});

test('supports bounded cursor reads and rejects traversal or oversized records', (t) => {
  const { log } = fixture(t, { maxRecordBytes: 256, maxReadBytes: 512, maxRecordsPerRead: 2 });
  for (let index = 0; index < 3; index += 1) log.append('stream', { index, value: `v${index}` });
  const first = log.read('stream');
  assert.equal(first.records.length, 2);
  assert.equal(first.truncated, true);
  const second = log.read('stream', { offset: first.nextOffset });
  assert.equal(second.records.length, 1);
  assert.equal(second.records[0].record.index, 2);
  assert.throws(() => log.append('../escape', { value: 1 }), /streamId/i);
  assert.throws(() => log.append('large', { value: 'x'.repeat(1_000) }), /record byte limit/i);
});

test('recovers checksum chain after restart and ignores a truncated tail', (t) => {
  const { rootDir, log } = fixture(t);
  log.append('recover', { message: 'one' });
  log.append('recover', { message: 'two' });
  log.close();
  appendFileSync(join(rootDir, 'recover.frlog'), '00000040:{"partial":', 'utf8');
  const restarted = new DiskBackedRawLog({ rootDir });
  const snapshot = restarted.snapshot('recover');
  assert.equal(snapshot.recordCount, 2);
  assert.equal(snapshot.truncatedTail, true);
  assert.deepEqual(restarted.read('recover').records.map((item) => item.record.message), ['one', 'two']);
});

test('fails closed when a complete frame breaks the record checksum chain', (t) => {
  const { rootDir, log } = fixture(t);
  log.append('tamper', { message: 'hello' });
  log.close();
  const path = join(rootDir, 'tamper.frlog');
  writeFileSync(path, readFileSync(path, 'utf8').replace('hello', 'jello'));
  assert.throws(() => new DiskBackedRawLog({ rootDir }), /checksum|receipt chain|corrupt/i);
});
