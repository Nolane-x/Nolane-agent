import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { RuntimeModuleManager } from '../src/runtime/runtime-module-manager.mjs';
import { createOptionalEnterpriseCloudModuleDescriptor } from '../src/runtime/optional-enterprise-cloud-module.mjs';

test('enterprise/cloud databases do not exist until the optional module is activated', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-enterprise-lazy-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const events = [];
  const manager = new RuntimeModuleManager({ profile: 'lite' });
  manager.register(createOptionalEnterpriseCloudModuleDescriptor({ dataDir: root, environment: {}, eventSink: (event) => events.push(event) }));
  assert.deepEqual(await readdir(root), []);
  const module = await manager.activate('enterprise-cloud');
  const names = (await readdir(root)).filter((name) => name.endsWith('.db')).sort();
  assert.deepEqual(names, ['cloud-queue.db', 'cloud-sandboxes.db', 'enterprise-sessions.db', 'enterprise.db', 'scim.db']);
  assert.equal(module.enterpriseService.getOrganization('local').id, 'local');
  assert.equal(typeof module.enterpriseCloudRoutes, 'function');
  assert.equal(module.oidcHttp, null);
  assert.equal(module.scimHttp, null);
  await manager.close();
});

test('enterprise/cloud module rejects malformed sandbox policy at activation time', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-enterprise-policy-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const manager = new RuntimeModuleManager({ profile: 'balanced' });
  manager.register(createOptionalEnterpriseCloudModuleDescriptor({ dataDir: root, environment: { FORGE_STUDIO_CLOUD_SANDBOX_POLICIES_JSON: '[]' } }));
  await assert.rejects(() => manager.activate('enterprise-cloud'), /must be an object/);
});
