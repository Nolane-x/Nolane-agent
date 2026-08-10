import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHttpServer } from '../src/server/http-server.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';
import { SmallModelFoundationService } from '../src/small-model/foundation-service.mjs';

const auth = (options = {}) => ({ ...options, headers: { authorization: 'Bearer nolane-token', 'content-type': 'application/json', ...(options.headers ?? {}) } });
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('authenticated checkpoint 9 workflow remains pending until explicit promotion and then executes bounded refactor', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-checkpoint-9-http-'));
  await writeFile(path.join(root, 'index.html'), '<!doctype html>');
  const store = new StudioStore(path.join(root, 'studio.db')); t.after(() => store.close());
  const service = await createHttpServer({ config: { host: '127.0.0.1', port: 0, authToken: 'nolane-token' }, store, providers: new ProviderRegistry(), missionRunner: {}, smallModelFoundation: new SmallModelFoundationService(), uiRoot: root });
  t.after(() => service.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  const statusUrl = `${service.url}/api/small-model/foundation/model/checkpoint-9/status`;
  assert.equal((await fetch(statusUrl)).status, 401);
  assert.equal((await (await fetch(statusUrl, auth())).json()).ready, false);
  const prepare = await fetch(`${service.url}/api/small-model/foundation/model/checkpoint-9/prepare`, auth({ method: 'POST', body: JSON.stringify({ root: projectRoot }) }));
  assert.equal(prepare.status, 201);
  const prepared = await prepare.json();
  const promote = await fetch(`${service.url}/api/small-model/foundation/model/checkpoint-9/promote`, auth({ method: 'POST', body: JSON.stringify({ bundleReceiptSha256: prepared.bundleReceiptSha256, approvedBy: 'checkpoint-owner' }) }));
  assert.equal(promote.status, 201);
  assert.equal((await (await fetch(statusUrl, auth())).json()).ready, true);
  const files = [
    { path: 'src/api.mjs', source: `export function legacyName(value){ return value; }\n` },
    { path: 'src/direct.mjs', source: `import { legacyName } from './api.mjs';\nexport const value = legacyName(1);\n` },
    { path: 'src/alias.mjs', source: `import { legacyName as run } from './api.mjs';\nexport const value = run(2);\n` },
  ];
  const execution = await fetch(`${service.url}/api/small-model/foundation/model/checkpoint-9/execute-refactor`, auth({ method: 'POST', body: JSON.stringify({ files }) }));
  assert.equal(execution.status, 200);
  assert.equal((await execution.json()).changedFiles, 3);
});
