import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const NUI_SHA = '3cc8168ab8daf8b33a5729e70bb27573e68b45b8';
const PERF_SHA = '5169bf18be62b6a78aa4ba2ad9d6a3c37270c7cd';
const OUTPUT_BRANCH = 'codex/nui-performance-integration';
const LARGE_STDIO_BUFFER = 64 * 1024 * 1024;

function run(command, args, options = {}) {
  return execFileSync(command, args, { stdio: 'inherit', ...options });
}
function text(command, args) {
  return execFileSync(command, args, { encoding: 'utf8', maxBuffer: LARGE_STDIO_BUFFER });
}
function tryRun(command, args) {
  return spawnSync(command, args, { stdio: 'inherit' });
}
function gitShow(ref, path) {
  return text('git', ['show', `${ref}:${path}`]);
}
function refHasPath(ref, path) {
  return spawnSync('git', ['cat-file', '-e', `${ref}:${path}`], { stdio: 'ignore' }).status === 0;
}
function replaceOnce(source, before, after) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`Expected exactly one match, found ${count}: ${before}`);
  return source.replace(before, after);
}
function section(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  if (a < 0 || b < 0 || b <= a) throw new Error(`Unable to extract ${start} .. ${end}`);
  return source.slice(a, b);
}
function replaceSection(source, start, end, replacement) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  if (a < 0 || b < 0 || b <= a) throw new Error(`Unable to replace ${start} .. ${end}`);
  return source.slice(0, a) + replacement + source.slice(b);
}

run('git', ['config', 'user.name', 'nolane-integration']);
run('git', ['config', 'user.email', 'nolane-integration@users.noreply.github.com']);
run('git', ['fetch', 'origin', NUI_SHA, PERF_SHA]);

const merge = tryRun('git', ['merge', '--no-commit', '--no-ff', PERF_SHA]);
if (merge.status !== 0) console.log('Merge produced conflicts; applying bounded semantic resolution.');
console.log('Initial unresolved paths:\n' + text('git', ['diff', '--name-only', '--diff-filter=U']));

// Generated distribution and source-bound receipts are temporary during the merge.
rmSync('ui-dist', { recursive: true, force: true });
run('git', ['checkout', 'HEAD', '--', 'ui-dist']);
run('git', ['add', '-A', 'ui-dist']);
for (const path of [
  'requirements/nolane-native-core-conformance.json',
  'requirements/runtime-purity-summary.json',
  'requirements/nolane-agent-v5-requirements.json',
  'requirements/master-acceptance-ledger.json',
  'docs/MASTER-ACCEPTANCE-LEDGER.md',
  'docs/ui-v3/ui-v3-source-release.json',
]) {
  if (!refHasPath('HEAD', path)) continue;
  writeFileSync(path, gitShow('HEAD', path));
  run('git', ['add', path]);
}

// Start from the NUI Proofline capturer, then transplant the already-verified progressive Settings helpers.
{
  const path = 'scripts/capture-ui-runtime-visual.mjs';
  let nui = gitShow('HEAD', path);
  const perf = gitShow(PERF_SHA, path);
  const progressiveScroll = section(perf, 'async function chooseSettingsCategory', 'async function assertSettingsLanguageRoundtrip');
  nui = replaceSection(nui, 'async function assertSettingsScrollPreserved', 'async function assertSettingsLanguageRoundtrip', progressiveScroll);
  const progressivePicker = section(perf, 'async function assertSettingsOptionPicker', 'async function assertSettingsModelCatalog');
  nui = replaceSection(nui, 'async function assertSettingsOptionPicker', 'async function assertSettingsModelCatalog', progressivePicker);
  if (!nui.includes("id: 'mission-proofline'") || !nui.includes("id: 'mission-proofline-compact'")) throw new Error('Proofline states were lost');
  if (!nui.includes('async function prepareProoflineMission')) throw new Error('Proofline fixture was lost');
  if (!nui.includes('async function chooseSettingsCategory')) throw new Error('Progressive Settings helper was not integrated');
  writeFileSync(path, nui);
  run('git', ['add', path]);
}

// Start from the NUI Proofline visual workflow and add the verified responsive evidence phases.
{
  const path = '.github/workflows/ui-runtime-visual.yml';
  let source = gitShow('HEAD', path);
  source = replaceOnce(source,
    "      - 'scripts/capture-ui-runtime-visual.mjs'\n",
    "      - 'scripts/capture-ui-runtime-visual.mjs'\n      - 'scripts/capture-ui-responsive-evidence.mjs'\n");
  source = replaceOnce(source,
    "      - 'tests/ui-runtime-visual-workflow.test.mjs'\n      - 'tests/nui-proofline-mission-cockpit.test.mjs'\n",
    "      - 'tests/ui-runtime-visual-workflow.test.mjs'\n      - 'tests/ui-responsive-evidence-workflow.test.mjs'\n      - 'tests/ui-v3-skills-contrast.test.mjs'\n      - 'tests/ui-v3-settings-contrast.test.mjs'\n      - 'tests/ui-v3-control-plane-scroll-region.test.mjs'\n      - 'tests/nui-proofline-mission-cockpit.test.mjs'\n");
  source = replaceOnce(source,
    "          NOLANE_UI_VISUAL_STATES=home,home-experience-menu,home-compact,projects,skills,skills-catalog-picker,skills-forge-preview,settings,settings-option-picker,settings-language-roundtrip,settings-model-catalog,workroom,control-plane,browser node scripts/capture-ui-runtime-visual.mjs\n",
    "          NOLANE_UI_VISUAL_STATES=home,home-experience-menu,home-compact,projects,skills,skills-catalog-picker,skills-forge-preview,settings,settings-option-picker,settings-language-roundtrip,settings-model-catalog,workroom,control-plane,browser node scripts/capture-ui-runtime-visual.mjs\n          node scripts/capture-ui-responsive-evidence.mjs\n");
  source = replaceOnce(source,
    "            if ($LASTEXITCODE -ne 0) { throw \"Windows workspace capture failed with exit code $LASTEXITCODE\" }\n            $computer = Get-CimInstance Win32_ComputerSystem\n",
    "            if ($LASTEXITCODE -ne 0) { throw \"Windows workspace capture failed with exit code $LASTEXITCODE\" }\n            node scripts/capture-ui-responsive-evidence.mjs\n            if ($LASTEXITCODE -ne 0) { throw \"Windows responsive UI evidence capture failed with exit code $LASTEXITCODE\" }\n            $computer = Get-CimInstance Win32_ComputerSystem\n");
  if (!source.includes('mission-proofline,mission-proofline-compact')) throw new Error('Proofline capture phases were lost');
  if (!source.includes('capture-ui-responsive-evidence.mjs')) throw new Error('Responsive capture phase was lost');
  writeFileSync(path, source);
  run('git', ['add', path]);
}

// NUI test is the superset of the legacy visual contract; progressive behavior has its own performance-side test.
writeFileSync('tests/ui-runtime-visual-workflow.test.mjs', gitShow('HEAD', 'tests/ui-runtime-visual-workflow.test.mjs'));
run('git', ['add', 'tests/ui-runtime-visual-workflow.test.mjs']);

const unresolved = text('git', ['diff', '--name-only', '--diff-filter=U']).trim();
if (unresolved) throw new Error(`Unrecognized unresolved merge conflicts:\n${unresolved}`);

run('npm', ['ci', '--ignore-scripts']);
run(process.execPath, ['--test',
  'tests/provider-dogfood-candidate-runner.test.mjs',
  'tests/provider-dogfood-self-hosted-workflow.test.mjs',
  'tests/nui-host-sidecar.test.mjs',
  'tests/nui-context-builder.test.mjs',
  'tests/nui-proofline-mission-cockpit.test.mjs',
  'tests/ui-runtime-visual-workflow.test.mjs',
  'tests/ui-settings-progressive-runtime-contract.test.mjs',
  'tests/ui-v3-settings-controller.test.mjs',
  'tests/ui-v3-skills-progressive-render.test.mjs',
  'tests/ui-performance-runtime-evidence.test.mjs',
  'tests/ui-responsive-evidence-workflow.test.mjs',
  'tests/ui-responsive-medium-pressure.test.mjs',
  'tests/ui-v3-settings-contrast.test.mjs',
  'tests/ui-v3-skills-contrast.test.mjs',
  'tests/ui-v3-control-plane-scroll-region.test.mjs',
  'tests/external-gate-certification.test.mjs',
  'tests/external-gate-certification-builder.test.mjs',
]);

run('npm', ['run', 'build:ui-v3']);
run(process.execPath, ['scripts/generate-native-core-conformance.mjs']);
run(process.execPath, ['scripts/generate-nolane-program.mjs']);
run(process.execPath, ['scripts/generate-master-acceptance-ledger.mjs']);
run('npm', ['run', 'validate']);
run('npm', ['run', 'verify:ui-v3-release']);
run('npm', ['run', 'audit:evidence-freshness']);

// Build a clean merge tree: no temporary convergence workflow/script history is promoted.
writeFileSync('.github/workflows/nui-main-integration-sync.yml', gitShow(NUI_SHA, '.github/workflows/nui-main-integration-sync.yml'));
rmSync('.github/workflows/converge-nui-performance.yml', { force: true });
rmSync('scripts/converge-nui-performance.mjs', { force: true });
run('git', ['add', '-A']);

const finalUnresolved = text('git', ['diff', '--name-only', '--diff-filter=U']).trim();
if (finalUnresolved) throw new Error(`Unresolved paths remained before commit-tree:\n${finalUnresolved}`);
const tree = text('git', ['write-tree']).trim();
const commit = text('git', ['commit-tree', tree, '-p', NUI_SHA, '-p', PERF_SHA, '-m', 'merge: converge NUI provenance and UI performance evidence']).trim();
const parents = text('git', ['show', '-s', '--format=%P', commit]).trim().split(/\s+/).filter(Boolean);
if (parents.length !== 2 || parents[0] !== NUI_SHA || parents[1] !== PERF_SHA) throw new Error(`Unexpected merge parents: ${parents.join(' ')}`);

const existing = spawnSync('git', ['ls-remote', '--exit-code', '--heads', 'origin', OUTPUT_BRANCH], { stdio: 'ignore' });
if (existing.status === 0) throw new Error(`Output branch already exists: ${OUTPUT_BRANCH}`);
run('git', ['push', 'origin', `${commit}:refs/heads/${OUTPUT_BRANCH}`]);
console.log(`Created clean convergence commit ${commit} on ${OUTPUT_BRANCH}`);
