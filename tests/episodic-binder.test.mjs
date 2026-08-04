import test from 'node:test';
import assert from 'node:assert/strict';
import { EpisodicBinder } from '../src/cognition/episodic-binder.mjs';

test('binds expected and actual effects into a replayable causal episode', () => {
  const binder = new EpisodicBinder({ maxEpisodes: 10 });
  const episode = binder.bind({
    episodeId: 'ep-1', taskId: 'task-1', contextBefore: 'ctx-1', goal: 'repair token rotation',
    observations: ['ev-1', 'ev-2'], hypothesesConsidered: ['h1', 'h2'], actionId: 'patch-7',
    expectedEffect: { targetTest: 'pass', publicApi: 'unchanged' },
    actualEffect: { targetTest: 'pass', integrationTest: 'failed' },
    errorAttribution: { causalModel: 0.72, execution: 0.28 }, rollbackPoint: 'commit-abc',
    verification: { targetedTests: 'passed', integrationTests: 'failed' }, lessonStatus: 'unconsolidated',
  });
  assert.equal(episode.actualEffect.integrationTest, 'failed');
  assert.equal(episode.rollbackPoint, 'commit-abc');
  assert.match(episode.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(binder.get('ep-1').episodeId, 'ep-1');
});

test('rejects transcripts, secrets, and raw prompts recursively', () => {
  const binder = new EpisodicBinder();
  assert.throws(() => binder.bind({ episodeId: 'ep-x', taskId: 't', contextBefore: 'c', goal: 'g', observations: ['e'], hypothesesConsidered: ['h'], actionId: 'a', expectedEffect: {}, actualEffect: { nested: { apiKey: 'secret' } }, errorAttribution: {}, rollbackPoint: 'r' }), /forbidden/i);
});
