import assert from 'node:assert/strict';
import test from 'node:test';
import { ModelTimeClock } from '../src/memory/model-time-clock.mjs';
import { ReplayScheduler } from '../src/memory/replay-scheduler.mjs';

const episode = (episodeId, extra = {}) => ({ episodeId, predictionError: 0, conflict: 0, reverted: false, transferValue: 0, commitmentPending: false, commitmentCompleted: false, calibrationError: 0, replayCount: 0, lastReplayedModelTime: null, ...extra });

test('ModelTimeClock advances from policy/schema/correction changes rather than raw steps', () => {
  const clock = new ModelTimeClock();
  const idle = clock.observe({ rawSteps: 10_000 });
  assert.equal(idle.modelTime, 0);
  const changed = clock.observe({ policyDrift: 0.5, schemaChanges: 2, correctionRate: 0.4, skillRevisions: 1, distributionShift: 0.3 });
  assert.ok(changed.modelTime > 0);
  assert.equal(changed.rawStepsIgnored, true);
  assert.match(changed.receiptSha256, /^[a-f0-9]{64}$/);
});

test('ReplayScheduler prioritizes prediction error, conflict, reverts, and transfer value', () => {
  const scheduler = new ReplayScheduler({ maxQueue: 4 });
  const plan = scheduler.schedule({ modelTime: 12, episodes: [
    episode('routine', { predictionError: 0.1 }),
    episode('reverted', { predictionError: 0.4, reverted: true, transferValue: 0.7 }),
    episode('conflict', { conflict: 0.9, calibrationError: 0.6 }),
    episode('commitment', { commitmentPending: true, predictionError: 0.3 }),
  ] });
  assert.deepEqual(plan.queue.map((item) => item.episodeId), ['reverted', 'conflict', 'commitment', 'routine']);
  assert.equal(plan.claims.modelInvoked, false);
});

test('ReplayScheduler lowers saturated episodes and excludes completed commitments', () => {
  const scheduler = new ReplayScheduler({ maxQueue: 3, replaySaturationPenalty: 0.18 });
  const plan = scheduler.schedule({ modelTime: 20, episodes: [
    episode('fresh', { predictionError: 0.5, replayCount: 0 }),
    episode('saturated', { predictionError: 0.9, replayCount: 5, lastReplayedModelTime: 19 }),
    episode('done', { predictionError: 1, commitmentCompleted: true }),
  ] });
  assert.equal(plan.queue[0].episodeId, 'fresh');
  assert.ok(plan.omissions.some((item) => item.episodeId === 'done' && item.reason === 'commitment-completed'));
  assert.ok(plan.omissions.some((item) => item.episodeId === 'saturated' && item.reason === 'cooldown'));
});

test('ReplayScheduler is bounded and rejects private episode payloads', () => {
  const scheduler = new ReplayScheduler({ maxQueue: 2 });
  const plan = scheduler.schedule({ modelTime: 3, episodes: [episode('a', { predictionError: 1 }), episode('b', { conflict: 1 }), episode('c', { transferValue: 1 })] });
  assert.equal(plan.queue.length, 2);
  assert.throws(() => scheduler.schedule({ modelTime: 1, episodes: [episode('x', { rawTranscript: 'private' })] }), /private|raw/i);
});
