import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function write(root, relative, content) {
  const file = path.join(root, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}

test('project manifest walks the vendored ForgeOS root while excluding generated runtime output', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-project-manifest-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await write(root, 'package.json', JSON.stringify({ name: 'forge-studio', version: '1.0.0' }));
  await write(root, 'vendor/forge-os.manifest.json', '{}');
  await write(root, 'vendor/forge-os/.claude-plugin/plugin.json', '{}');
  await write(root, 'vendor/forge-os/src/core/canonical-json.mjs', 'export const ok = true;\n');
  await write(root, 'vendor/forge-os/dist/generated.json', '{}');
  await write(root, 'vendor/forge-os/.forgeos-data/runtime.sqlite', 'runtime');

  const output = path.join(root, 'project-manifest.json');
  await execFileAsync(process.execPath, [path.resolve('scripts/generate-manifest.mjs'), root, output]);
  const manifest = JSON.parse(await readFile(output, 'utf8'));
  const paths = manifest.files.map((entry) => entry.relativePath);

  assert.ok(paths.includes('vendor/forge-os.manifest.json'));
  assert.ok(paths.includes('vendor/forge-os/.claude-plugin/plugin.json'));
  assert.ok(paths.includes('vendor/forge-os/src/core/canonical-json.mjs'));
  assert.ok(!paths.some((entry) => entry.startsWith('vendor/forge-os/dist/')));
  assert.ok(!paths.some((entry) => entry.startsWith('vendor/forge-os/.forgeos-data/')));
});
