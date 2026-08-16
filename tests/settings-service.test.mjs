import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { SettingsService } from '../src/settings/settings-service.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-settings-service-')); t.after(() => rm(root, { recursive: true, force: true }));
  const project = { id: 'project-1', workspaceRoot: path.join(root, 'workspace') };
  const service = new SettingsService({ dataDir: path.join(root, 'data'), getProject: (id) => id === project.id ? project : null, defaults: { agent: { model: 'auto', maxAgents: 2 }, security: { sandbox: true, redactSecrets: true } }, lockedKeys: ['security.*'] });
  return { root, project, service };
}

test('SettingsService persists user/project/local layers and returns provenance', async (t) => {
  const f = await fixture(t);
  await f.service.update({ layer: 'user', patch: { agent: { model: 'codex' } } });
  await f.service.update({ layer: 'project', projectId: f.project.id, patch: { agent: { maxAgents: 4 }, security: { sandbox: false } } });
  await f.service.update({ layer: 'local', projectId: f.project.id, patch: { agent: { model: 'claude' } } });
  const effective = await f.service.effective(f.project.id);
  assert.equal(effective.value.agent.model, 'claude');
  assert.equal(effective.value.agent.maxAgents, 4);
  assert.equal(effective.value.security.sandbox, true);
  assert.equal(effective.provenance['agent.model'], 'local');
  assert.equal(effective.warnings.some((item) => item.key === 'security.sandbox'), true);
  const reopened = new SettingsService({ dataDir: path.join(f.root, 'data'), getProject: (id) => id === f.project.id ? f.project : null, defaults: { agent: { model: 'auto', maxAgents: 2 }, security: { sandbox: true, redactSecrets: true } }, lockedKeys: ['security.*'] });
  assert.equal((await reopened.effective(f.project.id)).value.agent.model, 'claude');
});

test('SettingsService rejects secret-like settings and unknown project/layer', async (t) => {
  const f = await fixture(t);
  await f.service.update({ layer: 'user', patch: { security: { redactSecrets: false } } });
  assert.equal((await f.service.layer('user')).security.redactSecrets, false);
  await assert.rejects(() => f.service.update({ layer: 'user', patch: { provider: { apiKey: 'sk-secret-value' } } }), /credential vault|secret/i);
  await assert.rejects(() => f.service.update({ layer: 'project', projectId: 'missing', patch: {} }), /Unknown project/i);
  await assert.rejects(() => f.service.update({ layer: 'machine', patch: {} }), /layer/i);
});

test('SettingsService validates catalog fields and resets selected paths atomically', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-settings-catalog-')); t.after(() => rm(root, { recursive: true, force: true }));
  const project = { id: 'project-1', workspaceRoot: path.join(root, 'workspace') };
  const service = new SettingsService({
    dataDir: path.join(root, 'data'),
    getProject: (id) => id === project.id ? project : null,
    defaults: { experience: { level: 'standard' }, appearance: { theme: 'system', density: 'comfortable' } },
  });
  assert.ok(service.catalog().categories.some((item) => item.id === 'models'));
  await assert.rejects(
    () => service.update({ layer: 'user', patch: { experience: { level: 'impossible' } } }),
    (error) => error.statusCode === 400 && error.details?.some((item) => item.path === 'experience.level'),
  );
  await service.update({ layer: 'user', patch: { experience: { level: 'research' }, appearance: { theme: 'dark', density: 'compact' } } });
  const reset = await service.reset({ layer: 'user', paths: ['appearance.theme'] });
  assert.equal(reset.value.appearance.theme, undefined);
  assert.equal(reset.value.appearance.density, 'compact');
  assert.equal(reset.effective.value.appearance.theme, 'system');
  assert.equal(reset.effective.value.experience.level, 'research');
});

test('SettingsService serializes concurrent updates to one settings layer without losing fields', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-settings-concurrent-')); t.after(() => rm(root, { recursive: true, force: true }));
  const flags = Object.fromEntries(Array.from({ length: 24 }, (_, index) => [`flag${index}`, false]));
  const service = new SettingsService({
    dataDir: path.join(root, 'data'),
    getProject: () => null,
    defaults: { flags },
  });
  await Promise.all(Object.keys(flags).map((name) => service.update({ layer: 'user', patch: { flags: { [name]: true } } })));
  const effective = await service.effective();
  for (const name of Object.keys(flags)) assert.equal(effective.value.flags[name], true, name);
});
