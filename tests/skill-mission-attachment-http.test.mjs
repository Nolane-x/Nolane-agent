import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createHttpServer } from '../src/server/http-server.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';

const auth = (options = {}) => ({ ...options, headers: { authorization: 'Bearer token', 'content-type': 'application/json', ...(options.headers ?? {}) } });

test('mission planning validates selected skills as no-capability context and persists their receipts', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-skill-plan-http-'));
  await writeFile(path.join(root, 'index.html'), '<!doctype html>');
  const store = new StudioStore(path.join(root, 'studio.db'));
  const project = store.createProject({ name: 'Skills', workspaceRoot: root });
  const calls = [];
  const nativeOrchestration = {
    async loadSkill(id, options) {
      calls.push(['load', id, options]);
      return { id, source: 'nolane', catalog: 'local', title: 'Browser audit', contentSha256: 'a'.repeat(64), manifestSha256: 'b'.repeat(64), provenanceStatus: 'local-user-supplied', receiptSha256: 'c'.repeat(64), content: '# Browser audit' };
    },
  };
  const missionRunner = {
    async plan(input) {
      calls.push(['plan', input.planningMetadata]);
      return { id: 'mission-skills', projectId: input.projectId, objective: input.objective, status: 'running', metadata: input.planningMetadata, tasks: [] };
    },
  };
  const server = await createHttpServer({ config: { host: '127.0.0.1', port: 0, authToken: 'token' }, store, providers: new ProviderRegistry(), missionRunner, nativeOrchestration, uiRoot: root });
  t.after(() => server.close());
  t.after(() => store.close());
  t.after(() => rm(root, { recursive: true, force: true }));

  const response = await fetch(`${server.url}/api/missions/plan`, auth({ method: 'POST', body: JSON.stringify({
    projectId: project.id,
    objective: 'Review the browser flow',
    skillIds: ['browser-audit'],
    plan: { summary: 'Review', tasks: [{ id: 'review', title: 'Review', objective: 'Review safely', role: 'scout', dependencies: [], allowedPaths: ['**'], deniedPaths: [] }] },
  }) }));
  assert.equal(response.status, 201);
  assert.deepEqual(calls[0], ['load', 'browser-audit', { grantedCapabilities: [] }]);
  const metadata = calls.find((call) => call[0] === 'plan')[1];
  assert.deepEqual(metadata.selectedSkills, [{ id: 'browser-audit', source: 'nolane', catalog: 'local', title: 'Browser audit', contentSha256: 'a'.repeat(64), manifestSha256: 'b'.repeat(64), provenanceStatus: 'local-user-supplied', receiptSha256: 'c'.repeat(64) }]);
});
