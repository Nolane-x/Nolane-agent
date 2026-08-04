import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildUiV3 } from '../scripts/build-ui-v3.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

test('UI v3 routes lazy-load completed product surfaces instead of placeholder copy', async () => {
  const source = await readFile('ui-v3/app.mjs', 'utf8');
  assert.doesNotMatch(source, /registered for incremental implementation/);
  for (const modulePath of [
    './views/review/review-view.mjs', './views/workroom/workroom-view.mjs', './views/review-queue/review-queue.mjs',
    './views/projects/project-view.mjs', './views/settings/settings-view.mjs', './control-plane/control-plane-shell.mjs',
  ]) assert.match(source, new RegExp(`import\\(['\"]${modulePath.replaceAll('.', '\\.').replaceAll('/', '\\/')}['\"]\\)`));
});

test('hashed UI build contains the completed route module graph and no placeholder phrase', async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), 'nolane-ui-completed-'));
  try {
    const result = await buildUiV3({ sourceRoot: 'ui-v3', outputRoot });
    assert.ok(result.files > 20);
    const manifest = JSON.parse(await readFile(path.join(outputRoot, 'manifest.json'), 'utf8'));
    for (const source of ['ui-v3/views/review/review-view.mjs', 'ui-v3/views/workroom/workroom-view.mjs', 'ui-v3/control-plane/control-plane-shell.mjs']) {
      const relative = source.replace(/^ui-v3\//, '');
      assert.ok(manifest.modules[relative], `missing built module ${relative}`);
      const content = await readFile(path.join(outputRoot, manifest.modules[relative]), 'utf8');
      assert.doesNotMatch(content, /incremental implementation/);
    }
  } finally { await rm(outputRoot, { recursive: true, force: true }); }
});
