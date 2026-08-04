import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createScheduler } from '../ui-v3/core/scheduler.mjs';
import { createVisibilityPolicy } from '../ui-v3/core/visibility-policy.mjs';

test('scheduler coalesces duplicate keys and cancels destroyed work', async () => {
  const values = [];
  const scheduler = createScheduler({ frame: (callback) => queueMicrotask(callback), idle: (callback) => queueMicrotask(callback) });
  scheduler.enqueue('mission', () => values.push(1), { priority: 'frame' });
  scheduler.enqueue('mission', () => values.push(2), { priority: 'frame' });
  scheduler.enqueue('graph', () => values.push(3), { priority: 'idle' });
  await scheduler.flush();
  assert.deepEqual(values, [2, 3]);
  scheduler.destroy();
  assert.throws(() => scheduler.enqueue('x', () => {}), /destroyed/i);
});

test('visibility policy suspends hidden surfaces and restores only registered work', () => {
  const events = [];
  const policy = createVisibilityPolicy();
  const dispose = policy.register('preview', { suspend: () => events.push('suspend'), resume: () => events.push('resume') });
  policy.setVisible('preview', false);
  policy.setVisible('preview', true);
  dispose();
  policy.setVisible('preview', false);
  assert.deepEqual(events, ['suspend', 'resume']);
});

test('motion policy contains reduced-motion override and no layout animation', async () => {
  const source = await readFile('ui-v3/styles/motion.css', 'utf8');
  assert.match(source, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(source, /transition-property\s*:\s*[^;]*(width|height|top|left|right|bottom)/i);
  assert.doesNotMatch(source, /backdrop-filter|filter\s*:/i);
  assert.match(source, /transform,\s*opacity|opacity,\s*transform/);
});
