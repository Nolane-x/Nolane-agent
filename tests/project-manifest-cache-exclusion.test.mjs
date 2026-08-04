import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

test('project manifest excludes Python bytecode caches created by SDK tests', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-manifest-cache-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'sdk/python/nolane_agent/__pycache__'), { recursive: true });
  await writeFile(path.join(root, 'package.json'), '{"name":"nolane-agent","version":"5.0.0-alpha.2"}\n');
  await writeFile(path.join(root, 'sdk/python/nolane_agent/client.py'), 'class Client: pass\n');
  await writeFile(path.join(root, 'sdk/python/nolane_agent/__pycache__/client.pyc'), 'bytecode\n');
  await execFileAsync(process.execPath, [path.resolve('scripts/generate-manifest.mjs'), root, 'project-manifest.json']);
  const manifest = JSON.parse(await readFile(path.join(root, 'project-manifest.json'), 'utf8'));
  const files = manifest.files.map((entry) => entry.relativePath);
  assert.ok(files.includes('sdk/python/nolane_agent/client.py'));
  assert.equal(files.some((file) => /(?:^|\/)__pycache__\/|\.py[co]$/i.test(file)), false);
});
