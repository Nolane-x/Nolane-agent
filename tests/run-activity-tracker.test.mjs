import test from 'node:test';
import assert from 'node:assert/strict';

import { RunActivityTracker } from '../src/agent/run-activity-tracker.mjs';

test('RunActivityTracker aggregates usage and projects files, commands, errors, and step results', () => {
  const tracker = new RunActivityTracker({ duplicateLimit: 2 });
  tracker.recordModel({ promptTokens: 10, completionTokens: 4, totalTokens: 14, costUsd: 0.01 });
  tracker.recordModel({ promptTokens: 5, completionTokens: 2, totalTokens: 7, costUsd: 0.02 });
  tracker.recordTool({ tool: 'fs.read', input: { path: 'src/a.mjs' }, status: 'pass', output: { path: 'src/a.mjs' }, receiptSha256: 'a'.repeat(64) });
  tracker.recordTool({ tool: 'fs.write', input: { path: 'src/b.mjs' }, status: 'pass', output: { path: 'src/b.mjs' }, receiptSha256: 'b'.repeat(64) });
  tracker.recordTool({ tool: 'process.run', input: { command: 'npm', args: ['test'] }, status: 'fail', output: { exitCode: 1 }, receiptSha256: 'c'.repeat(64) });
  tracker.recordError(new Error('test failed'), { step: 'verification' });
  tracker.recordStep({ id: 'verify', status: 'failed', result: 'npm test exited 1' });
  const state = tracker.snapshot();
  assert.deepEqual(state.usage, { promptTokens: 15, completionTokens: 6, totalTokens: 21, costUsd: 0.03 });
  assert.deepEqual(state.filesRead, ['src/a.mjs']);
  assert.deepEqual(state.filesWritten, ['src/b.mjs']);
  assert.deepEqual(state.commandsRun, [{ command: 'npm', args: ['test'], exitCode: 1 }]);
  assert.equal(state.errors[0].message, 'test failed');
  assert.equal(state.stepResults.at(-1).id, 'verify');
});

test('RunActivityTracker stops repeated identical actions until progress changes', () => {
  const tracker = new RunActivityTracker({ duplicateLimit: 2 });
  const action = { tool: 'fs.read', input: { path: 'src/a.mjs' } };
  tracker.assertActionAllowed(action);
  tracker.assertActionAllowed(action);
  assert.throws(() => tracker.assertActionAllowed(action), (error) => error.code === 'DUPLICATE_ACTION_LOOP');
  tracker.markProgress('new-context-hash');
  assert.doesNotThrow(() => tracker.assertActionAllowed(action));
});
