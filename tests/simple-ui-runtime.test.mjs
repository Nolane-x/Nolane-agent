import test from 'node:test';
import assert from 'node:assert/strict';
import { createRefreshCoalescer } from '../ui/refresh-coalescer.mjs';

test('live refresh coalesces event bursts and preserves the strongest recent refresh request', async () => {
  const scheduled = [];
  const calls = [];
  let nextId = 0;
  const coalescer = createRefreshCoalescer({
    delayMs: 120,
    refresh: async (options) => calls.push(options),
    schedule(fn, delay) { const entry = { id: ++nextId, fn, delay, cancelled: false }; scheduled.push(entry); return entry.id; },
    cancel(id) { const entry = scheduled.find((item) => item.id === id); if (entry) entry.cancelled = true; },
  });
  coalescer.request({ recent: false });
  coalescer.request({ recent: true });
  coalescer.request({ recent: false });
  const active = scheduled.filter((entry) => !entry.cancelled);
  assert.equal(active.length, 1);
  assert.equal(active[0].delay, 120);
  await active[0].fn();
  assert.deepEqual(calls, [{ recent: true }]);
});

test('live refresh queues one more pass when events arrive during an active refresh', async () => {
  const pending = [];
  const calls = [];
  let release;
  const coalescer = createRefreshCoalescer({
    delayMs: 0,
    refresh: async (options) => { calls.push(options); if (calls.length === 1) await new Promise((resolve) => { release = resolve; }); },
    schedule(fn) { pending.push(fn); return pending.length; },
    cancel() {},
  });
  coalescer.request();
  const first = pending.shift()();
  await Promise.resolve();
  coalescer.request({ recent: true });
  release();
  await first;
  await pending.shift()();
  assert.deepEqual(calls, [{ recent: false }, { recent: true }]);
});
