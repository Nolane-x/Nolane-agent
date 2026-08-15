import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSkillsLibraryController, renderSkillsLibrary } from '../ui-v3/views/skills/skills-view.mjs';
import { loadLiveDomainWorkspace, renderLiveDomainWorkspace } from '../ui-v3/control-plane/live-domain-workspace.mjs';

test('Skills preserves only explicitly declared capability states and makes them searchable', async () => {
  const api = {
    async get(path) {
      assert.match(path, /^\/api\/skills\/catalog\?limit=/);
      return { skills: [{
        id: 'guarded-skill', title: 'Guarded Skill', source: 'nolane', catalog: 'local',
        installed: true, enabled: false, configured: true, ready: false, blocked: true,
        maturity: 'stable', description: 'Capability truth fixture',
      }] };
    },
    async post() { throw new Error('unexpected post'); },
  };
  const controller = createSkillsLibraryController({ api, language: 'en' });
  await controller.load();
  const skill = controller.snapshot().skills[0];
  assert.deepEqual(skill.capabilityStates, ['installed', 'disabled', 'configured', 'not-ready', 'blocked']);
  const html = renderSkillsLibrary(controller.snapshot());
  for (const state of skill.capabilityStates) assert.match(html, new RegExp(`data-skill-capability-state="${state}"`));
  assert.doesNotMatch(html, /data-skill-capability-state="ready"/);
  controller.setQuery('blocked');
  assert.match(renderSkillsLibrary(controller.snapshot()), /Guarded Skill/);
});

test('Settings search debounce preserves search focus and caret instead of replacing the active input', async () => {
  const app = await readFile(new URL('../ui-v3/app.mjs', import.meta.url), 'utf8');
  assert.match(app, /matches\?\.\('\[data-settings-search\]'\)/);
  assert.match(app, /settingsSearchState/);
  assert.match(app, /querySelector\('\[data-settings-search\]'\)/);
  assert.match(app, /next\.focus\(\{preventScroll:true\}\)/);
  assert.match(app, /next\.setSelectionRange\?\.\(\.\.\.settingsSearchState\.selection\)/);
});

test('Control Plane does not count configured blocked or offline adapters as online or healthy', async () => {
  const payloads = new Map([
    ['/api/missions', { status: 'ready', missions: [] }],
    ['/api/provider-connections/readiness', { status: 'blocked' }],
    ['/api/runtime-readiness/architecture', { status: 'configured' }],
    ['/api/security-certification/snapshot', { status: 'offline' }],
  ]);
  const api = { async get(path) { if (!payloads.has(path)) throw new Error(`Unexpected ${path}`); return structuredClone(payloads.get(path)); } };
  const workspace = await loadLiveDomainWorkspace({ api, domain: 'overview', language: 'en' });
  assert.equal(workspace.status, 'degraded');
  assert.deepEqual(workspace.records.map((record) => record.status), ['ready', 'blocked', 'configured', 'offline']);
  const html = renderLiveDomainWorkspace(workspace);
  assert.match(html, /Adapters online<\/span><strong>1\/4<\/strong>/);
  assert.doesNotMatch(html, /Adapters online<\/span><strong>4\/4<\/strong>/);
});

test('Control Plane skill catalog search is owned by shared focus-preserving rerender authority', async () => {
  const source = await readFile(new URL('../ui-v3/control-plane/live-domain-workspace.mjs', import.meta.url), 'utf8');
  assert.match(source, /data-skill-catalog-search[^>]*data-preserve-key="control-plane-skill-search"/);
});
