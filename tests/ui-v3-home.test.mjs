import test from 'node:test';
import assert from 'node:assert/strict';
import { INTENT_PRESETS, createMissionRequest } from '../ui-v3/core/intent-presets.mjs';
import { buildHomeViewModel, renderHomeView } from '../ui-v3/views/home/home-view.mjs';

test('four intent presets map to enforceable backend boundaries', () => {
  assert.deepEqual(Object.keys(INTENT_PRESETS), ['ask', 'plan', 'build', 'verify']);
  assert.equal(INTENT_PRESETS.ask.writeFiles, false);
  assert.equal(INTENT_PRESETS.plan.executeChanges, false);
  assert.equal(INTENT_PRESETS.build.writeFiles, true);
  assert.equal(INTENT_PRESETS.verify.expandScope, false);
});

test('mission request validates objective, project and provider availability', () => {
  assert.throws(() => createMissionRequest({ objective: '', projectId: 'p1' }), /objective/i);
  assert.throws(() => createMissionRequest({ objective: 'Fix tests', projectId: '' }), /project/i);
  assert.throws(() => createMissionRequest({ objective: 'Fix tests', projectId: 'p1', providerState: 'unavailable' }), /provider/i);
  const request = createMissionRequest({ objective: 'Fix tests', projectId: 'p1', intent: 'build', modelChoice: 'auto' });
  assert.equal(request.product, 'Nolane Agent');
  assert.equal(request.intent, 'build');
  assert.equal(request.boundaries.writeFiles, true);
});

test('repository suggestions render only when backed by evidence', () => {
  const hidden = buildHomeViewModel({ repositoryState: 'indexing', suggestions: [{ title: 'Fix tests', evidenceIds: [] }] });
  assert.deepEqual(hidden.suggestions, []);
  const visible = buildHomeViewModel({ repositoryState: 'ready', suggestions: [{ title: 'Fix 3 tests', evidenceIds: ['e1'] }, { title: 'Generic', evidenceIds: [] }] });
  assert.deepEqual(visible.suggestions.map((item) => item.title), ['Fix 3 tests']);
});

test('home composer submits registered provider IDs rather than profile keys', () => {
  const models = [
    ['codex/cli-selected', 'codex'],
    ['claude/default', 'claude'],
    ['gemini/default', 'gemini'],
    ['opencode/default', 'opencode'],
    ['codex-app-server/default', 'codex-app-server'],
  ].map(([key, providerId]) => ({ key, providerId, displayName: key }));
  const html = renderHomeView(buildHomeViewModel({ models }));
  const modelSelect = html.match(/<select name="modelChoice"[^>]*>(.*?)<\/select>/)?.[1] ?? '';
  const values = [...modelSelect.matchAll(/<option value="([^"]+)"/g)].map(([, value]) => value);

  assert.ok(values.includes('auto'));
  assert.deepEqual(values.slice(1), ['codex', 'claude', 'gemini', 'opencode', 'codex-app-server']);
  assert.ok(!values.includes('codex/cli-selected'));
  assert.match(html, />codex\/cli-selected · codex<\/option>/);
});
