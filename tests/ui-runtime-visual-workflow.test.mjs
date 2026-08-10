import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('UI runtime visual workflow captures authenticated source-rendered states without packaging Electron', async () => {
  const workflow = await readFile('.github/workflows/ui-runtime-visual.yml', 'utf8');
  const capturer = await readFile('scripts/capture-ui-runtime-visual.mjs', 'utf8');

  assert.match(workflow, /permissions:\s*\n\s+contents:\s*read/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /pull_request:\s*\n\s+paths:/);
  assert.match(workflow, /- 'ui-v3\/\*\*'/);
  assert.match(workflow, /- 'scripts\/capture-ui-runtime-visual\.mjs'/);
  assert.doesNotMatch(workflow, /push:\s*\n\s+branches:\s*\n\s+- codex\/external-gate-evidence/);
  assert.match(workflow, /ubuntu-latest/);
  assert.match(workflow, /node-version:\s*'24'/);
  assert.match(workflow, /npm run build:ui-v3/);
  assert.match(workflow, /git diff --exit-code -- ui-dist/);
  assert.match(workflow, /NOLANE_AGENT_TOKEN/);
  assert.match(workflow, /node src\/app\.mjs/);
  assert.match(workflow, /\/health\?token=/);
  assert.match(workflow, /api\/onboarding\/recommended/);
  assert.match(workflow, /capture-ui-runtime-visual\.mjs/);
  assert.match(workflow, /actions\/upload-artifact@v6/);
  assert.match(workflow, /retention-days:\s*14/);
  assert.doesNotMatch(workflow, /^ {4}env:\n(?: {6}[^\n]+\n)* {6}NOLANE_(?:AGENT_DATA_DIR|UI_VISUAL_OUTPUT):\s*\$\{\{\s*runner\.temp/m);
  assert.doesNotMatch(workflow, /electron-builder|build:electron|smoke:packaged|release:matrix/);

  for (const state of ['onboarding', 'home', 'home-nocturne', 'projects', 'settings', 'workroom', 'control-plane']) {
    assert.match(capturer, new RegExp(`id: '${state}'`));
  }
  assert.match(workflow, /appearance"\s*:\s*\{\s*"theme"\s*:\s*"nocturne"/);
  assert.match(workflow, /NOLANE_UI_VISUAL_STATES=home-nocturne/);
  assert.match(capturer, /chromium\.launch/);
  assert.match(capturer, /page\.goto/);
  assert.match(capturer, /page\.screenshot/);
  assert.match(capturer, /sha256/);
  assert.match(capturer, /assertSettingsScrollPreserved/);
  assert.match(capturer, /settings content did not preserve scroll position/);
  assert.doesNotMatch(capturer, /token\s*:\s*(credential|token)/);
});
