import test from 'node:test';
import assert from 'node:assert/strict';
import { access, chmod, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { buildVsCodeExtension } from '../scripts/build-vscode-extension.mjs';

async function waitFor(file, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { await access(file); return; } catch { await new Promise((resolve) => setTimeout(resolve, 10)); }
  }
  throw new Error(`Timed out waiting for ${file}`);
}

test('VS Code builds serialize across concurrent processes that share the dist directory', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-vscode-lock-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = path.join(root, 'extensions', 'vscode');
  await mkdir(project, { recursive: true });
  await writeFile(path.join(project, 'tsconfig.json'), '{}\n');
  const signal = path.join(root, 'first-compiler-started');
  const role = path.join(root, 'first-compiler-role');
  const compiler = path.join(root, 'fake-tsc.mjs');
  await writeFile(compiler, `#!/usr/bin/env node\nimport { access, mkdir, writeFile } from 'node:fs/promises';\nimport path from 'node:path';\nconst root = process.cwd();\nconst role = path.join(root, 'first-compiler-role');\nconst signal = path.join(root, 'first-compiler-started');\nconst dist = path.join(root, 'extensions', 'vscode', 'extension', 'dist');\nlet first = false;\ntry { await mkdir(role); first = true; } catch {}\nif (first) {\n  await mkdir(dist, { recursive: true });\n  for (const name of ['client.js','extension.js','local-worktree.js']) await writeFile(path.join(dist, name), name);\n  await writeFile(signal, 'ready');\n  await new Promise((resolve) => setTimeout(resolve, 500));\n} else {\n  await access(signal);\n  await new Promise((resolve) => setTimeout(resolve, 1000));\n  await mkdir(dist, { recursive: true });\n  for (const name of ['client.js','extension.js','local-worktree.js']) await writeFile(path.join(dist, name), name);\n}\n`);
  await chmod(compiler, 0o755);
  const previous = process.env.FORGE_TYPESCRIPT_COMPILER;
  process.env.FORGE_TYPESCRIPT_COMPILER = compiler;
  t.after(() => { if (previous === undefined) delete process.env.FORGE_TYPESCRIPT_COMPILER; else process.env.FORGE_TYPESCRIPT_COMPILER = previous; });

  const first = buildVsCodeExtension({ rootDir: root });
  await waitFor(signal);
  const second = buildVsCodeExtension({ rootDir: root });
  const results = await Promise.allSettled([first, second]);
  assert.deepEqual(results.map((result) => result.status), ['fulfilled', 'fulfilled']);
});
