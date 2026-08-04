import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';

import { StudioStore } from '../src/storage/studio-store.mjs';
import { ToolBroker } from '../src/execution/tool-broker.mjs';
import { FileService } from '../src/workroom/file-service.mjs';

async function setup(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-file-service-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src')); await mkdir(path.join(root, 'empty'));
  await writeFile(path.join(root, 'src', 'app.js'), 'export const value = 1;\n');
  await writeFile(path.join(root, 'binary.bin'), Buffer.from([0, 1, 2, 3]));
  await writeFile(path.join(root, '.env'), 'SECRET=bad\n');
  const outside = await mkdtemp(path.join(os.tmpdir(), 'forge-file-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(path.join(outside, 'escape.txt'), 'escape');
  await symlink(outside, path.join(root, 'linked'));
  const store = new StudioStore(path.join(root, '.studio.db')); t.after(() => store.close());
  const project = store.createProject({ name: 'test', workspaceRoot: root });
  const service = new FileService({
    store,
    maxFileBytes: 128,
    brokerFactory: (workspaceRoot) => new ToolBroker({ workspaceRoot, allowedPaths: ['**'], deniedPaths: ['.env', '.env.*', '**/*.pem', '**/*.key'] }),
  });
  return { root, project, service };
}

test('file service lists a bounded lazy tree and excludes denied/internal/symlink entries', async (t) => {
  const { project, service } = await setup(t);
  const root = await service.tree({ projectId: project.id, directory: '.' });
  assert.deepEqual(root.entries.map((item) => item.path), ['empty', 'src']);
  const src = await service.tree({ projectId: project.id, directory: 'src' });
  assert.deepEqual(src.entries.map((item) => [item.name, item.type]), [['app.js', 'file']]);
});

test('file service reads text with a content hash and rejects binary, oversized, denied, and escaping paths', async (t) => {
  const { project, service, root } = await setup(t);
  const value = await service.read({ projectId: project.id, file: 'src/app.js' });
  assert.equal(value.content, 'export const value = 1;\n');
  assert.match(value.sha256, /^[a-f0-9]{64}$/);
  await assert.rejects(() => service.read({ projectId: project.id, file: 'binary.bin' }), /binary/i);
  await writeFile(path.join(root, 'large.txt'), 'x'.repeat(129));
  await assert.rejects(() => service.read({ projectId: project.id, file: 'large.txt' }), /128 byte/i);
  await assert.rejects(() => service.read({ projectId: project.id, file: '.env' }), /denied/i);
  await assert.rejects(() => service.read({ projectId: project.id, file: '../escape.txt' }), /escapes workspace/i);
  await assert.rejects(() => service.tree({ projectId: project.id, directory: 'linked' }), /symlink|escapes workspace/i);
});

test('file service writes through Tool Broker with hash preconditions and returns conflict data', async (t) => {
  const { project, service, root } = await setup(t);
  const before = await service.read({ projectId: project.id, file: 'src/app.js' });
  const saved = await service.write({ projectId: project.id, file: 'src/app.js', content: 'export const value = 2;\n', expectedSha256: before.sha256 });
  assert.equal(await readFile(path.join(root, 'src/app.js'), 'utf8'), 'export const value = 2;\n');
  assert.equal(saved.receipt.tool, 'fs.write');
  await writeFile(path.join(root, 'src/app.js'), 'external edit\n');
  await assert.rejects(() => service.write({ projectId: project.id, file: 'src/app.js', content: 'stale\n', expectedSha256: saved.output.afterSha256 }), (error) => {
    assert.equal(error.statusCode, 409);
    assert.equal(error.code, 'FILE_CONFLICT');
    assert.equal(error.current.content, 'external edit\n');
    return true;
  });
});

test('file service diff returns current disk and proposed model versions without writing', async (t) => {
  const { project, service } = await setup(t);
  const result = await service.diff({ projectId: project.id, file: 'src/app.js', content: 'export const value = 3;\n' });
  assert.equal(result.original, 'export const value = 1;\n');
  assert.equal(result.modified, 'export const value = 3;\n');
  assert.notEqual(result.originalSha256, result.modifiedSha256);
});
