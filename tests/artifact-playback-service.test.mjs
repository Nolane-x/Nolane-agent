import assert from 'node:assert/strict';
import test from 'node:test';
import { ArtifactPlaybackService } from '../src/experience/artifact-playback-service.mjs';
const hash = (c) => c.repeat(64);

test('artifact playback is bounded and rewinds only to verified checkpoints', () => {
  const playback = new ArtifactPlaybackService({ maxEvents: 3 });
  playback.append({ type: 'file.opened', summary: 'auth.mjs', artifactSha256: hash('a') });
  playback.append({ type: 'command.ran', summary: 'targeted tests', artifactSha256: hash('b') });
  playback.checkpoint({ checkpointId: 'cp-1', gitCommit: 'abc123', verificationReceiptSha256: hash('c') });
  playback.append({ type: 'browser.journey', summary: 'login flow', artifactSha256: hash('d') });
  assert.equal(playback.snapshot().events.length, 3);
  assert.equal(playback.rewindPlan({ checkpointId: 'cp-1' }).allowed, true);
  assert.throws(() => playback.rewindPlan({ checkpointId: 'missing' }), /checkpoint not found/i);
});
