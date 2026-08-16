import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Task 11 performance evidence covers changed professional surfaces and input responsiveness without false certification', async () => {
  const source = await readFile('scripts/capture-ui-performance-evidence.mjs', 'utf8');

  for (const id of ['missions', 'browser', 'review', 'workroom', 'settings', 'control-plane']) {
    assert.match(source, new RegExp(`id:\\s*['\"]${id}['\"]|${id === 'review' ? 'reviewMissionId|reviewFixture' : `['\"]${id}['\"]`}`), `missing ${id} performance coverage`);
  }
  assert.match(source, /preparePerformanceReviewFixture|prepareReviewFixture/);
  assert.match(source, /reviewSha256/);
  assert.match(source, /routeResourceObservations/);
  assert.match(source, /routeSwitchP95ByRoute/);
  assert.match(source, /interactiveInputP95Ms/);
  assert.match(source, /interactiveInputSamplesMs/);
  assert.match(source, /data-settings-search/);
  assert.match(source, /requestAnimationFrame/);
  assert.match(source, /settings_search_input_to_two_animation_frames_source_runtime_proxy/);
  assert.match(source, /streamingInputResponsiveness:\s*'not_observed_no_replayable_stream_fixture'/);
  assert.match(source, /windows8GbCertified:\s*false/);
  assert.match(source, /performanceCertified:\s*false/);
  assert.doesNotMatch(source, /streamingInputResponsiveness:\s*'PASS'|windows8GbCertified:\s*true|performanceCertified:\s*true/);
});
