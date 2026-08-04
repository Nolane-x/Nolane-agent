import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import * as releaseArtifacts from '../src/release/release-artifacts.mjs';

test('release packaging rebuilds missing VS Code outputs before reading the project manifest', async (t) => {
  assert.equal(typeof releaseArtifacts.ensureVsCodeReleaseOutputs, 'function');
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-vscode-release-rebuild-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'scripts'), { recursive: true });
  await writeFile(path.join(root, 'scripts', 'build-vscode-extension.mjs'), `
    import { mkdir, writeFile } from 'node:fs/promises';
    import path from 'node:path';
    const out = path.resolve('extensions/vscode/extension/dist');
    await mkdir(out, { recursive: true });
    for (const name of ['client.js', 'extension.js', 'local-worktree.js']) {
      await writeFile(path.join(out, name), 'export const rebuilt = true;\\n');
    }
  `);

  const result = await releaseArtifacts.ensureVsCodeReleaseOutputs({ rootDirectory: root });

  assert.equal(result.rebuilt, true);
  for (const name of ['client.js', 'extension.js', 'local-worktree.js']) {
    const file = path.join(root, 'extensions', 'vscode', 'extension', 'dist', name);
    await access(file);
    assert.match(await readFile(file, 'utf8'), /rebuilt = true/);
  }
});
