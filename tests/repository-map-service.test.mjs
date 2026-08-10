import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { RepositoryIndex } from '../src/repository/repository-index.mjs';
import { RepositoryMapService } from '../src/repository/repository-map-service.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';

test('RepositoryMapService builds a compact dependency-ranked symbol map', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-repo-map-'));
  let store = null;
  t.after(async () => {
    store?.close();
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(path.join(root, 'src'), { recursive: true });
  await writeFile(path.join(root, 'src', 'core.mjs'), 'export function authenticate() { return true; }\nexport const TOKEN = 1;\n');
  await writeFile(path.join(root, 'src', 'api.mjs'), "import { authenticate } from './core.mjs';\nexport function login() { return authenticate(); }\n");
  await writeFile(path.join(root, 'src', 'ui.mjs'), "import { login } from './api.mjs';\nexport function Button() { return login(); }\n");
  await writeFile(path.join(root, 'src', 'worker.mjs'), "import { authenticate } from './core.mjs';\nexport function work() { return authenticate(); }\n");
  store = new StudioStore(path.join(root, 'studio.db'));
  const project = store.createProject({ name: 'Map', workspaceRoot: root });
  await new RepositoryIndex({ store }).index(project);
  const service = new RepositoryMapService({ store });
  const map = service.build(project.id, { maxFiles: 10, maxSymbolsPerFile: 5, maxChars: 5000 });
  assert.equal(map.schema, 'forge.repository-map.v1');
  assert.equal(map.files[0].path, 'src/core.mjs');
  assert.deepEqual(map.files.find((item) => item.path === 'src/core.mjs').importedBy.sort(), ['src/api.mjs', 'src/worker.mjs']);
  assert.ok(map.files.find((item) => item.path === 'src/api.mjs').imports.includes('src/core.mjs'));
  assert.ok(map.files[0].symbols.some((symbol) => symbol.name === 'authenticate'));
  assert.ok(map.totalChars <= 5000);
  assert.match(map.mapSha256, /^[a-f0-9]{64}$/);
});
