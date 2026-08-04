import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHttpServer } from '../src/server/http-server.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';
import { SmallModelFoundationService } from '../src/small-model/foundation-service.mjs';
import { loadCheckpoint10TypeScriptPack } from '../src/small-model/checkpoint-10-typescript-pack.mjs';
import { CHECKPOINT_10_CONTRACT_MANIFEST } from '../src/small-model/checkpoint-10-mission-portfolio.mjs';

const auth = (options = {}) => ({
  ...options,
  headers: {
    authorization: 'Bearer nolane-token',
    'content-type': 'application/json',
    ...(options.headers ?? {}),
  },
});
const projectRoot = path.resolve(new URL('..', import.meta.url).pathname);

async function loadTypeScriptFiles() {
  const pack = await loadCheckpoint10TypeScriptPack({ root: projectRoot, id: 'transfer-c' });
  return Promise.all(pack.sourceFiles.map(async (entry) => ({
    path: entry.path,
    source: await readFile(path.join(projectRoot, pack.rootPath, entry.path), 'utf8'),
  })));
}

async function loadContractFiles() {
  return Promise.all(Object.values(CHECKPOINT_10_CONTRACT_MANIFEST.targets).map(async (relativePath) => ({
    path: relativePath,
    source: await readFile(path.join(projectRoot, 'fixtures/checkpoint-10-contract', relativePath), 'utf8'),
  })));
}

test('authenticated checkpoint 10 workflow remains pending until explicit promotion and executes only bounded migrations', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-checkpoint-10-http-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'index.html'), '<!doctype html>');
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  const service = await createHttpServer({
    config: { host: '127.0.0.1', port: 0, authToken: 'nolane-token' },
    store,
    providers: new ProviderRegistry(),
    missionRunner: {},
    smallModelFoundation: new SmallModelFoundationService(),
    uiRoot: root,
  });
  t.after(() => service.close());

  const statusUrl = `${service.url}/api/small-model/foundation/model/checkpoint-10/status`;
  assert.equal((await fetch(statusUrl)).status, 401);
  const initial = await fetch(statusUrl, auth());
  assert.equal(initial.status, 200);
  assert.equal((await initial.json()).ready, false);

  const prepare = await fetch(`${service.url}/api/small-model/foundation/model/checkpoint-10/prepare`, auth({
    method: 'POST',
    body: JSON.stringify({ root: projectRoot }),
  }));
  assert.equal(prepare.status, 201);
  const prepared = await prepare.json();

  const blockedBeforePromotion = await fetch(`${service.url}/api/small-model/foundation/model/checkpoint-10/execute-typescript`, auth({
    method: 'POST',
    body: JSON.stringify({ files: await loadTypeScriptFiles() }),
  }));
  assert.equal(blockedBeforePromotion.status, 400);

  const promote = await fetch(`${service.url}/api/small-model/foundation/model/checkpoint-10/promote`, auth({
    method: 'POST',
    body: JSON.stringify({ bundleReceiptSha256: prepared.bundleReceiptSha256, approvedBy: 'checkpoint-owner' }),
  }));
  assert.equal(promote.status, 201);
  assert.equal((await (await fetch(statusUrl, auth())).json()).ready, true);

  const typeScriptExecution = await fetch(`${service.url}/api/small-model/foundation/model/checkpoint-10/execute-typescript`, auth({
    method: 'POST',
    body: JSON.stringify({
      files: await loadTypeScriptFiles(),
      targetName: 'CanonicalPayload',
      replacement: 'PromotedPayload',
    }),
  }));
  assert.equal(typeScriptExecution.status, 200);
  assert.equal((await typeScriptExecution.json()).changedFiles >= 5, true);

  const contractExecution = await fetch(`${service.url}/api/small-model/foundation/model/checkpoint-10/execute-contract`, auth({
    method: 'POST',
    body: JSON.stringify({ manifest: CHECKPOINT_10_CONTRACT_MANIFEST, files: await loadContractFiles() }),
  }));
  assert.equal(contractExecution.status, 200);
  assert.equal((await contractExecution.json()).changedFiles, 2);
});
