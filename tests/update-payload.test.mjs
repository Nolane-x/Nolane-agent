import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';

import { stageUpdatePayload } from '../scripts/stage-update-payload.mjs';

async function exists(file) { try { return (await stat(file)).isFile(); } catch { return false; } }

test('stageUpdatePayload copies only immutable application files and launcher compatibility marker', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-update-stage-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const portable = path.join(root, 'portable');
  await writeFile(path.join(root, 'source.tmp'), '');
  const { mkdir } = await import('node:fs/promises');
  await mkdir(path.join(portable, 'app', 'src'), { recursive: true });
  await mkdir(path.join(portable, 'app', 'native'), { recursive: true });
  await mkdir(path.join(portable, 'runtime'), { recursive: true });
  await mkdir(path.join(portable, 'data'), { recursive: true });
  await mkdir(path.join(portable, 'config'), { recursive: true });
  await writeFile(path.join(portable, 'app', 'src', 'app.mjs'), 'export default true;');
  await writeFile(path.join(portable, 'app', 'native', 'NolanePty.exe'), 'pty');
  await writeFile(path.join(portable, 'NolaneAgent.exe'), 'launcher');
  await writeFile(path.join(portable, 'runtime', 'node.exe'), 'node');
  await writeFile(path.join(portable, 'data', 'secret.db'), 'user-data');
  await writeFile(path.join(portable, 'config', 'update.json'), '{"secret":true}');

  const destination = path.join(root, 'payload');
  const manifest = await stageUpdatePayload({ portableRoot: portable, destination, version: '0.3.1' });

  assert.equal(manifest.schema, 'nolane.agent.update-payload.v1');
  assert.equal(manifest.version, '0.3.1');
  assert.equal(await exists(path.join(destination, 'app', 'src', 'app.mjs')), true);
  assert.equal(await exists(path.join(destination, 'app', 'native', 'NolanePty.exe')), true);
  assert.equal(await exists(path.join(destination, 'NolaneAgent.exe')), true);
  assert.equal(await exists(path.join(destination, 'runtime', 'node.exe')), false);
  assert.equal(await exists(path.join(destination, 'data', 'secret.db')), false);
  assert.equal(await exists(path.join(destination, 'config', 'update.json')), false);
  assert.ok(manifest.files.every((entry) => /^[a-f0-9]{64}$/.test(entry.sha256)));
  assert.deepEqual((await readdir(destination)).sort(), ['NolaneAgent.exe', 'UPDATE-PAYLOAD-MANIFEST.json', 'app']);
  const persisted = JSON.parse(await readFile(path.join(destination, 'UPDATE-PAYLOAD-MANIFEST.json'), 'utf8'));
  assert.equal(persisted.files.length, manifest.files.length);
});

test('stageUpdatePayload rejects missing launcher or app entry and invalid version', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-update-stage-invalid-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(() => stageUpdatePayload({ portableRoot: root, destination: path.join(root, 'out'), version: 'next' }), /semantic version/i);
  await assert.rejects(() => stageUpdatePayload({ portableRoot: root, destination: path.join(root, 'out'), version: '0.3.1' }), /NolaneAgent\.exe|app entry/i);
});
