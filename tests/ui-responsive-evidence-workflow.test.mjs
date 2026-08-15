import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('UI runtime evidence includes a multi-width responsive render matrix without replacing external certification', async () => {
  const workflow = await readFile('.github/workflows/ui-runtime-visual.yml', 'utf8');
  const responsive = await readFile('scripts/capture-ui-responsive-evidence.mjs', 'utf8');

  assert.match(workflow, /- 'scripts\/capture-ui-responsive-evidence\.mjs'/);
  assert.match(workflow, /- 'tests\/ui-responsive-evidence-workflow\.test\.mjs'/);
  assert.equal([...workflow.matchAll(/node scripts\/capture-ui-responsive-evidence\.mjs/g)].length, 2);
  assert.match(workflow, /NOLANE_UI_VISUAL_OUTPUT/);

  for (const width of [640, 900, 979, 980, 1180, 1440, 1600]) {
    assert.match(responsive, new RegExp(`\\b${width}\\b`));
  }
  for (const surface of ['home', 'projects', 'skills', 'settings', 'workroom', 'control-plane', 'browser']) {
    assert.match(responsive, new RegExp(`id: '${surface}'`));
  }
  assert.match(responsive, /captureUiRuntimeVisual/);
  assert.match(responsive, /responsive-\$\{surface\.id\}-\$\{width\}/);
  assert.match(responsive, /Object\.freeze\(\{ width, height:/);
  assert.match(responsive, /nolane\.ui\.responsive-runtime-evidence\.v1/);
  assert.match(responsive, /certificationState:\s*'candidate_unverified'/);
  assert.match(responsive, /finalDecision:\s*'external_gate'/);
  assert.match(responsive, /'NOL-UI-031':\s*'external_gate'/);
  assert.match(responsive, /captures:\s*Object\.freeze\(result\.captures\)/);
  assert.match(responsive, /writeFile\(path\.join\(result\.output, 'receipt\.json'\)/);

  // This harness creates evidence only; it must not self-certify the external UI requirements.
  assert.doesNotMatch(responsive, /verified_source_test|wcag22AaCertified\s*:\s*true|windowsCertified\s*:\s*true|responsiveCertified\s*:\s*true/);
});
