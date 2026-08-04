import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { AdvancedSearchService } from '../src/repository/advanced-search-service.mjs';

const run = promisify(execFile);

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'forge-advanced-search-'));
  await mkdir(path.join(root, 'src'), { recursive: true });
  await mkdir(path.join(root, 'logs'), { recursive: true });
  await writeFile(path.join(root, 'src', 'main.mjs'), "import { helper } from './helper.mjs';\n// TODO: harden retries\nexport function run() { return helper(); }\n");
  await writeFile(path.join(root, 'src', 'helper.mjs'), 'export const helper = () => 1;\n');
  await writeFile(path.join(root, 'logs', 'build.log'), 'src/main.mjs:8:4 - error TS2322: Type string is not assignable\n');
  await run('git', ['init'], { cwd: root });
  await run('git', ['config', 'user.email', 'forge@example.invalid'], { cwd: root });
  await run('git', ['config', 'user.name', 'Forge Test'], { cwd: root });
  await run('git', ['add', '.'], { cwd: root });
  await run('git', ['commit', '-m', 'feat: add helper and runner'], { cwd: root });
  await writeFile(path.join(root, 'src', 'main.mjs'), "import { helper } from './helper.mjs';\n// TODO: harden retries\nexport function run() { return helper() + 1; }\n");
  return root;
}

test('AdvancedSearchService finds imports, TODOs, compiler errors, logs, and working-tree diff locations', async () => {
  const root = await fixture();
  const service = new AdvancedSearchService({ workspaceRoot: root, deniedPaths: ['.git/**'] });
  const result = await service.search({ kinds: ['import', 'todo', 'compiler', 'log', 'diff'], query: 'helper|TODO|TS2322|return', regex: true, limit: 50 });
  assert.equal(result.schema, 'forge.repository-advanced-search.v1');
  assert.ok(result.items.some((item) => item.kind === 'import' && item.path === 'src/main.mjs' && item.line === 1));
  assert.ok(result.items.some((item) => item.kind === 'todo' && item.line === 2));
  assert.ok(result.items.some((item) => item.kind === 'compiler' && item.path === 'logs/build.log'));
  assert.ok(result.items.some((item) => item.kind === 'log' && item.path === 'logs/build.log'));
  assert.ok(result.items.some((item) => item.kind === 'diff' && item.path === 'src/main.mjs'));
  assert.match(result.querySha256, /^[a-f0-9]{64}$/);
});

test('AdvancedSearchService searches Git commit history and enforces path, extension, language, and time filters', async () => {
  const root = await fixture();
  const service = new AdvancedSearchService({ workspaceRoot: root, allowedPaths: ['src/**', 'logs/**'] });
  const result = await service.search({ kinds: ['commit', 'todo'], query: 'helper|harden', regex: true, extensions: ['.mjs'], directories: ['src'], language: 'javascript', since: '2000-01-01T00:00:00.000Z', until: '2100-01-01T00:00:00.000Z' });
  assert.ok(result.items.some((item) => item.kind === 'commit' && item.commit && item.snippet.includes('helper')));
  assert.ok(result.items.some((item) => item.kind === 'todo' && item.path === 'src/main.mjs'));
  assert.ok(result.items.filter((item) => item.path).every((item) => item.path.startsWith('src/')));
  assert.ok(result.items.filter((item) => item.path).every((item) => item.path.endsWith('.mjs')));
});

test('AdvancedSearchService rejects unsafe or unbounded patterns', async () => {
  const root = await fixture();
  const service = new AdvancedSearchService({ workspaceRoot: root });
  await assert.rejects(() => service.search({ kinds: ['todo'], query: '' }), (error) => error.code === 'ADVANCED_SEARCH_QUERY_INVALID');
  await assert.rejects(() => service.search({ kinds: ['todo'], query: 'x', directories: ['../outside'] }), /escapes workspace/i);
  await assert.rejects(() => service.search({ kinds: ['unknown'], query: 'x' }), (error) => error.code === 'ADVANCED_SEARCH_KIND_INVALID');
});
