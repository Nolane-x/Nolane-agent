import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { StudioStore } from '../src/storage/studio-store.mjs';
import { RepositoryIndex } from '../src/repository/repository-index.mjs';
import { RepositoryDiscoveryService } from '../src/repository/repository-discovery-service.mjs';
import { enumerateRepositoryFiles } from '../src/repository/repository-file-enumerator.mjs';

test('Gitless repository enumeration is bounded, explicit, and never follows symlinks', async (t) => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'nolane-gitless-'));
  let store = null;
  t.after(async () => {
    store?.close();
    await rm(parent, { recursive: true, force: true });
  });
  const root = path.join(parent, 'project');
  const outside = path.join(parent, 'outside');
  await mkdir(path.join(root, 'src'), { recursive: true });
  await mkdir(path.join(root, 'node_modules', 'hidden'), { recursive: true });
  await mkdir(outside, { recursive: true });
  await writeFile(path.join(root, 'src', 'index.js'), 'export function start() { return "safe"; }\n');
  await writeFile(path.join(root, 'README.md'), '# Gitless project\n');
  await writeFile(path.join(root, '.env'), 'SECRET=do-not-index\n');
  await writeFile(path.join(root, 'node_modules', 'hidden', 'index.js'), 'throw new Error("skip");\n');
  await writeFile(path.join(outside, 'escape.js'), 'export const escaped = true;\n');
  await symlink(path.join(outside, 'escape.js'), path.join(root, 'src', 'escape.js'));

  const enumeration = await enumerateRepositoryFiles(root, { maxFiles: 20, skipDirs: ['.git', 'node_modules'] });
  assert.equal(enumeration.mode, 'filesystem-fallback');
  assert.deepEqual(enumeration.files, ['.env', 'README.md', 'src/index.js']);
  assert.equal(enumeration.claims.symlinksFollowed, false);
  assert.match(enumeration.receiptSha256, /^[a-f0-9]{64}$/);

  store = new StudioStore(path.join(parent, 'studio.db'));
  const project = store.createProject({ name: 'Gitless', workspaceRoot: root });
  const indexed = await new RepositoryIndex({ store }).index(project);
  assert.equal(indexed.discoveryMode, 'filesystem-fallback');
  assert.equal(indexed.warnings.includes('filesystem-fallback'), true);
  assert.ok(indexed.scanned >= 2);
  assert.equal(new RepositoryIndex({ store }).search(project.id, 'escaped').length, 0);
  assert.equal(new RepositoryIndex({ store }).search(project.id, 'start')[0]?.path, 'src/index.js');

  const discovery = await new RepositoryDiscoveryService({ version: '5.0.0-alpha.2', store }).snapshot({ projectId: project.id, principalId: 'user:test' });
  assert.equal(discovery.summary.discoveryMode, 'filesystem-fallback');
  assert.equal(discovery.summary.warnings.includes('filesystem-fallback'), true);
  assert.ok(discovery.summary.filesObserved >= 2);
});
