import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

test('the UI runtime entrypoint is syntactically valid before Chromium evidence runs', async () => {
  await assert.doesNotReject(() => execFileAsync(process.execPath, ['--check', 'ui-v3/app.mjs']));
});

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
  assert.match(workflow, /@axe-core\/playwright@4\.12\.1/);
  assert.match(workflow, /NOLANE_AGENT_TOKEN/);
  assert.match(workflow, /node src\/app\.mjs/);
  assert.match(workflow, /\/health\?token=/);
  assert.doesNotMatch(workflow, /api\/onboarding\/recommended/);
  assert.match(workflow, /capture-ui-runtime-visual\.mjs/);
  assert.match(workflow, /actions\/upload-artifact@v6/);
  assert.match(workflow, /retention-days:\s*14/);
  assert.doesNotMatch(workflow, /^ {4}env:\n(?: {6}[^\n]+\n)* {6}NOLANE_(?:AGENT_DATA_DIR|UI_VISUAL_OUTPUT):\s*\$\{\{\s*runner\.temp/m);
  assert.doesNotMatch(workflow, /electron-builder|build:electron|smoke:packaged|release:matrix/);

  for (const state of ['onboarding', 'home', 'home-compact', 'home-nocturne', 'projects', 'skills', 'skills-forge-preview', 'settings', 'workroom', 'control-plane']) {
    assert.match(capturer, new RegExp(`id: '${state}'`));
  }
  assert.match(workflow, /appearance"\s*:\s*\{\s*"theme"\s*:\s*"nocturne"/);
  assert.match(workflow, /NOLANE_UI_VISUAL_STATES=home-nocturne/);
  assert.match(capturer, /chromium\.launch/);
  assert.match(capturer, /browser\.newContext\(\{ viewport, deviceScaleFactor: 1 \}\)/);
  assert.match(capturer, /context\.newPage\(\)/);
  assert.doesNotMatch(capturer, /browser\.newPage\(/);
  assert.match(capturer, /page\.goto/);
  assert.match(capturer, /page\.screenshot/);
  assert.match(capturer, /sha256/);
  assert.match(capturer, /async function captureRenderDiagnostic/);
  assert.match(capturer, /afterCapture: assertOnboardingRecommendedNavigation/);
  assert.match(capturer, /async function assertOnboardingRecommendedNavigation/);
  assert.match(capturer, /onboarding completion did not navigate to the home workspace/);
  assert.match(capturer, /UI state did not render: \$\{state\.id\}/);
  assert.match(capturer, /api\/onboarding\/status/);
  assert.match(capturer, /onboardingStatus/);
  assert.match(capturer, /pageErrors: pageErrors\.map\(redactDiagnosticText\)/);
  assert.doesNotMatch(capturer, /credential:\s*credential/);
  assert.match(capturer, /assertSettingsScrollPreserved/);
  assert.match(capturer, /setScrollForVisibleControl/);
  assert.match(capturer, /await assertScroll\(accent\.before, 'settings content'\)/);
  assert.match(capturer, /await setScrollForVisibleControl\(languageChoice\)/);
  assert.match(capturer, /await assertScroll\(beforeLanguage\.before, 'settings language choice'\)/);
  assert.match(capturer, /data-setting-path="general\.language"/);
  assert.match(capturer, /assertResponsiveLayout/);
  assert.match(capturer, /responsive layout overflows horizontally/);
  assert.match(capturer, /assertProjectPickerKeyboard/);
  assert.match(capturer, /project picker did not move focus to search after ArrowDown/);
  assert.match(capturer, /project picker did not return focus to its trigger after Escape/);
  assert.match(capturer, /skills Forge OS preview did not expose an installation action/);
  assert.match(capturer, /page\.locator\('\[data-skills-catalog\]'\)\.selectOption\('v2'\)/);
  assert.match(workflow, /NOLANE_UI_VISUAL_STATES=home,home-compact,projects,skills,skills-forge-preview,settings,workroom,control-plane/);
  assert.match(capturer, /AxeBuilder/);
  assert.match(capturer, /reported serious or critical accessibility violations/);
  assert.match(capturer, /violation\.nodes/);
  assert.match(capturer, /violation\.nodes\.slice\(0, 10\)/);
  assert.match(capturer, /node\.target/);
  assert.match(capturer, /viewport: Object\.freeze\(\{ width: 640, height: 900 \}\)/);
  assert.match(workflow, /NOLANE_UI_VISUAL_STATES=home,home-compact,projects,skills,skills-forge-preview,settings,workroom,control-plane/);
  assert.doesNotMatch(capturer, /token\s*:\s*(credential|token)/);
});
