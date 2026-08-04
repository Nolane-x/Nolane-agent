import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  hasLiveDomainWorkspace,
  loadLiveDomainWorkspace,
  renderLiveDomainWorkspace,
} from '../ui-v3/control-plane/live-domain-workspace.mjs';

function createApi(fixtures = {}) {
  const calls = [];
  return {
    calls,
    async get(path) {
      calls.push(path);
      if (Object.hasOwn(fixtures, path)) return structuredClone(fixtures[path]);
      return { ready: true, status: 'healthy', count: 1 };
    },
  };
}

test('live Control Plane domains expose bounded, redacted backend state', async () => {
  const api = createApi({
    '/api/provider-connections': {
      providers: [{ id: 'local', name: 'Local provider', apiKey: 'must-never-render', ready: true }],
      token: 'must-never-survive',
    },
    '/api/provider-connections/readiness': { ready: true, connected: 1, secret: 'hidden' },
    '/api/model-profiles': { profiles: [{ id: 'model-a', name: 'Model A', capability: 'tools' }] },
    '/api/mcp/tools': { tools: [{ id: 'tool-a', name: 'Repository search' }] },
    '/api/plugins': { plugins: [] },
    '/api/nolane/orchestration/skills': { skills: [{ id: 'skill-a', name: 'UI review' }] },
  });

  const workspace = await loadLiveDomainWorkspace({
    api,
    domain: 'extensions',
    projectId: 'project-a',
    missionId: 'mission-a',
    language: 'vi-VN',
  });
  const serialized = JSON.stringify(workspace);
  const html = renderLiveDomainWorkspace(workspace);

  assert.equal(workspace.language, 'vi');
  assert.equal(workspace.domain, 'extensions');
  assert.equal(workspace.records.length, 6);
  assert.equal(Object.hasOwn(workspace.records[0], 'payload'), false);
  assert.doesNotMatch(serialized, /must-never-render|must-never-survive|hidden/);
  assert.match(html, /Làm mới dữ liệu thật/);
  assert.match(html, /Backend đang báo cáo gì lúc này/);
  assert.match(html, /Repository search/);
  assert.match(html, /data-control-action="refresh"/);
  assert.ok(api.calls.includes('/api/provider-connections'));
});

test('scope-dependent adapters fail closed instead of calling malformed routes', async () => {
  const api = createApi();
  const workspace = await loadLiveDomainWorkspace({ api, domain: 'governance', language: 'en' });
  assert.equal(api.calls.length, 0);
  assert.equal(workspace.records.every((record) => record.status === 'unavailable'), true);
  assert.match(renderLiveDomainWorkspace(workspace), /Select a project or mission/);
});

test('Control Plane live workspace supports every generic expert domain', () => {
  for (const domain of ['overview','operations','runtime','context-memory','evidence','intelligence','trust-security','governance','extensions','autonomy','labs','release']) {
    assert.equal(hasLiveDomainWorkspace(domain), true, domain);
  }
  assert.equal(hasLiveDomainWorkspace('agent-kernel'), false);
  assert.equal(hasLiveDomainWorkspace('capabilities'), false);
});

test('application route loads and refreshes live Control Plane workspaces', async () => {
  const source = await readFile(new URL('../ui-v3/app.mjs', import.meta.url), 'utf8');
  assert.match(source, /live-domain-workspace\.mjs/);
  assert.match(source, /loadLiveDomainWorkspace\(\{api,domain:active\.domain,projectId,missionId,language:cachedPreferences\.language\}\)/);
  assert.match(source, /data-control-action="refresh"/);
  assert.match(source, /cache: 'path'/);
});
