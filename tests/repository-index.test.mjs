import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { StudioStore } from '../src/storage/studio-store.mjs';
import { RepositoryIndex } from '../src/repository/repository-index.mjs';

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(' ')} failed`);
}

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-repo-index-'));
  await mkdir(path.join(root, 'src'), { recursive: true });
  await mkdir(path.join(root, 'tests'), { recursive: true });
  await writeFile(path.join(root, 'src', 'math.js'), 'export function add(a, b) { return a + b; }\nexport const VERSION = "1";\n');
  await writeFile(path.join(root, 'tests', 'math.test.js'), 'import { add } from "../src/math.js";\n// verifies add numbers\n');
  await writeFile(path.join(root, '.env'), 'OPENAI_API_KEY=secret-value\n');
  await writeFile(path.join(root, 'image.bin'), Buffer.from([0, 1, 2, 3]));
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test');
  git(root, 'add', '-f', '.');
  git(root, 'commit', '-qm', 'fixture');
  const store = new StudioStore(path.join(root, '.forge', 'studio.db'));
  const project = store.createProject({ name: 'fixture', workspaceRoot: root });
  return { root, store, project };
}

test('RepositoryIndex incrementally indexes safe tracked text and ranks task context', async (t) => {
  const { root, store, project } = await fixture();
  t.after(() => store.close());
  const index = new RepositoryIndex({ store, maxFileBytes: 32_000, maxFiles: 100 });

  const first = await index.index(project);
  assert.equal(first.indexed, 2);
  assert.equal(first.ignored, 2);
  assert.equal(first.reused, 0);

  const symbols = index.symbols(project.id, { path: 'src/math.js' });
  assert.deepEqual(symbols.map((item) => [item.kind, item.name]), [['function', 'add'], ['constant', 'VERSION']]);

  const results = index.search(project.id, 'add numbers', { limit: 5 });
  assert.equal(results[0].path, 'tests/math.test.js');
  assert.ok(results.some((item) => item.path === 'src/math.js'));
  assert.ok(results.every((item) => !item.path.includes('.env')));

  const second = await index.index(project);
  assert.equal(second.indexed, 0);
  assert.equal(second.reused, 2);

  await writeFile(path.join(root, 'src', 'math.js'), 'export function add(a, b) { return Number(a) + Number(b); }\nexport const VERSION = "2";\n');
  const third = await index.index(project);
  assert.equal(third.indexed, 1);
  assert.equal(third.reused, 1);
  assert.equal(third.removed, 0);

  const context = index.contextForTask(project.id, {
    objective: 'Fix add function and its tests',
    changedPaths: ['src/math.js'],
    maxChars: 700,
    maxFiles: 3,
  });
  assert.ok(context.items.length >= 1);
  assert.equal(context.items[0].path, 'src/math.js');
  assert.ok(context.totalChars <= 700);
  assert.ok(context.omissions.every((item) => item.path !== '.env'));
});
