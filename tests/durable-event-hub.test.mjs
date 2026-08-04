import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { DurableEventHub } from '../src/events/durable-event-hub.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';
import { createEvent } from '../src/protocol/events.mjs';
import { createHttpServer } from '../src/server/http-server.mjs';

const withTimeout = (promise, ms = 1000) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

test('store publishes only committed sequenced events through the durable hub', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-event-hub-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const hub = new DurableEventHub();
  const store = new StudioStore(path.join(root, 'studio.db'), { eventHub: hub });
  t.after(() => store.close());
  const received = [];
  const unsubscribe = hub.subscribe((event) => received.push(event));
  t.after(unsubscribe);
  const committed = store.appendEvent(createEvent('test.committed', { value: 1 }));
  assert.equal(received.length, 1);
  assert.equal(received[0].seq, committed.seq);
  assert.equal(received[0].type, 'test.committed');
});

test('SSE receives new committed events without 250 ms database polling', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-event-sse-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'index.html'), '<!doctype html>');
  const hub = new DurableEventHub();
  const store = new StudioStore(path.join(root, 'studio.db'), { eventHub: hub });
  const service = await createHttpServer({ config: { host: '127.0.0.1', port: 0, authToken: 'token', performance: {} }, store, eventHub: hub, uiRoot: root });
  t.after(async () => { await service.close(); store.close(); });
  const controller = new AbortController();
  t.after(() => controller.abort());
  const response = await fetch(`${service.url}/events`, { headers: { authorization: 'Bearer token' }, signal: controller.signal });
  assert.equal(response.status, 200);
  const reader = response.body.getReader();
  store.appendEvent(createEvent('test.live', { ok: true }));
  const { value } = await withTimeout(reader.read(), 150);
  const text = new TextDecoder().decode(value);
  assert.match(text, /event: test\.live/);
});

test('HTTP source uses event-driven delivery with slow reconciliation and heartbeat only', async () => {
  const source = await readFile(new URL('../src/server/http-server.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /setInterval\(send, 250\)/);
  assert.match(source, /eventHub\?\.subscribe/);
  assert.match(source, /5_000/);
  assert.match(source, /15_000/);
});
