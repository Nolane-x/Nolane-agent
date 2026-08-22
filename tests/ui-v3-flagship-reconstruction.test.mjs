import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexUrl = new URL('../ui-v3/styles/index.css', import.meta.url);
const semanticUrl = new URL('../ui-v3/styles/tokens/semantic.css', import.meta.url);
const flagshipUrl = new URL('../ui-v3/styles/flagship/proofborne-instrument.css', import.meta.url);
const workroomViewUrl = new URL('../ui-v3/views/workroom/workroom-view.mjs', import.meta.url);

test('flagship Proofborne Instrument layer has bounded authority in the style graph', async () => {
  const index = await readFile(indexUrl, 'utf8');
  const pages = index.indexOf("@import './pages/settings.css';");
  const flagship = index.indexOf("@import './flagship/proofborne-instrument.css';");
  const accessibility = index.indexOf("@import './accessibility-runtime.css';");
  const responsive = index.indexOf("@import './responsive.css';");
  assert.ok(pages >= 0 && flagship > pages, 'flagship layer must refine page styles');
  assert.ok(accessibility > flagship, 'accessibility runtime policy must remain above flagship styling');
  assert.ok(responsive > accessibility, 'responsive host policy must remain the final authority');
});

test('semantic system declares causal instrument material roles', async () => {
  const semantic = await readFile(semanticUrl, 'utf8');
  for (const token of ['--instrument-rule', '--instrument-margin', '--instrument-plate', '--instrument-trace', '--instrument-evidence']) {
    assert.match(semantic, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('flagship layer is structural rather than decorative AI glass', async () => {
  const css = await readFile(flagshipUrl, 'utf8');
  assert.match(css, /Proofborne Instrument/);
  assert.match(css, /\.app-shell/);
  assert.match(css, /\.global-rail a\[aria-current="page"\]::before/);
  assert.match(css, /\.app-topbar/);
  assert.match(css, /\.home-view/);
  assert.match(css, /\.activity-page/);
  assert.doesNotMatch(css, /backdrop-filter\s*:/);
  assert.doesNotMatch(css, /filter\s*:\s*drop-shadow/);
  assert.doesNotMatch(css, /linear-gradient\([^;]*(purple|violet|cyan)/i);
});

test('flagship shell reads as a calibrated command band and working margin', async () => {
  const css = await readFile(flagshipUrl, 'utf8');
  assert.match(css, /\.session-sidebar__new\s*\{[^}]*border-radius:\s*6px[^}]*background:\s*transparent/s);
  assert.match(css, /\.session-row\s*\{[^}]*border-radius:\s*0[^}]*border-left:/s);
  assert.match(css, /\.shell-command-search\s*\{[^}]*border-radius:\s*5px/s);
  assert.match(css, /\.app-topbar__actions\s*>\s*button\s*\{[^}]*border-radius:\s*6px/s);
});

test('Home becomes a mission launch surface instead of a card grid', async () => {
  const css = await readFile(flagshipUrl, 'utf8');
  assert.match(css, /\.home-intro\s*\{[^}]*grid-template-columns:\s*minmax\(360px,[^;]+\)\s+minmax\(0,\s*1fr\)/s);
  assert.match(css, /\.mission-composer\s*\{[^}]*border-radius:\s*14px[^}]*box-shadow:\s*none/s);
  assert.match(css, /\.capability-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
  assert.match(css, /\.capability-card\s*\{[^}]*min-height:\s*0[^}]*border-radius:\s*0[^}]*box-shadow:\s*none/s);
  assert.match(css, /\.recent-mission\s*\{[^}]*border-radius:\s*0[^}]*border-left:/s);
});

test('Mission surface reduces card saturation while keeping recovery consequential', async () => {
  const css = await readFile(flagshipUrl, 'utf8');
  assert.match(css, /\.mission-spotlight\s*\{[^}]*border-radius:\s*0[^}]*background:\s*transparent[^}]*box-shadow:\s*none/s);
  assert.match(css, /\.execution-story\s*\{[^}]*border-radius:\s*0[^}]*background:\s*transparent/s);
  assert.match(css, /\.time-travel\s*\{[^}]*border-radius:\s*10px[^}]*background:\s*var\(--instrument-plate\)/s);
  assert.match(css, /\.activity-event__node\s*\{[^}]*border-radius:\s*50%/s);
});


test('Studio exposes truthful mission continuity and uses flatter instrument panes', async () => {
  const source = await readFile(workroomViewUrl, 'utf8');
  const css = await readFile(flagshipUrl, 'utf8');
  assert.match(source, /workroom-mission-trace/);
  assert.match(source, /snapshot\.missionId/);
  assert.match(css, /\.workroom-view\s*\{[^}]*border-radius:\s*8px[^}]*box-shadow:\s*none/s);
  assert.match(css, /\.workroom-mission-trace\s*\{[^}]*border-bottom:\s*1px solid var\(--instrument-rule\)/s);
  assert.match(css, /\.editor-welcome\s*>\s*span\s*\{[^}]*border-radius:\s*50%[^}]*box-shadow:\s*none/s);
  assert.match(css, /\.workroom-agent\s*\{[^}]*border-left:\s*1px solid var\(--instrument-rule\)/s);
});

test('Browser elevates session and permission truth above editorial spectacle', async () => {
  const css = await readFile(flagshipUrl, 'utf8');
  assert.match(css, /\.browser-workspace-hero\s*\{[^}]*border-radius:\s*0[^}]*background:\s*transparent[^}]*box-shadow:\s*none/s);
  assert.match(css, /\.browser-workspace-hero h1\s*\{[^}]*font-size:\s*clamp\(24px,[^;]+38px\)/s);
  assert.match(css, /\.browser-status-strip\s*\{[^}]*border-left:\s*3px solid var\(--instrument-trace\)[^}]*border-radius:\s*0/s);
  assert.match(css, /\.browser-permission-chip\s*\{[^}]*border-radius:\s*3px/s);
});

test('Review reads as a proof-bearing decision trace', async () => {
  const css = await readFile(flagshipUrl, 'utf8');
  assert.match(css, /\.review-list\s*\{[^}]*border-top:\s*1px solid var\(--instrument-rule\)/s);
  assert.match(css, /\.review-item\s*\{[^}]*border-radius:\s*0[^}]*border-left:\s*2px solid transparent/s);
  assert.match(css, /\.review-item::before\s*\{/s);
  assert.match(css, /\.review-shell\s*\{[^}]*border-top:\s*1px solid var\(--instrument-rule\)/s);
});

test('Skills, Settings, and Control Plane use distinct task-appropriate instrument density', async () => {
  const css = await readFile(flagshipUrl, 'utf8');
  assert.match(css, /\.skills-library__catalog\s*\{[^}]*border-radius:\s*0[^}]*box-shadow:\s*none/s);
  assert.match(css, /\.skill-library-item\[aria-pressed="true"\]\s*\{[^}]*border-left:\s*2px solid var\(--instrument-trace\)/s);
  assert.match(css, /\.settings-card\s*\{[^}]*border-radius:\s*8px[^}]*box-shadow:\s*none/s);
  assert.match(css, /\.settings-actions\s*\{[^}]*border-radius:\s*8px[^}]*background:\s*var\(--instrument-plate\)/s);
  assert.match(css, /\.control-plane-shell\s*>\s*nav\s*\{[^}]*background:\s*transparent/s);
  assert.match(css, /\.kernel-hero\s*\{[^}]*min-height:\s*0[^}]*border-radius:\s*0[^}]*background:\s*transparent[^}]*box-shadow:\s*none/s);
  assert.match(css, /\.kernel-metrics\s*\{[^}]*gap:\s*1px[^}]*background:\s*var\(--instrument-rule\)/s);
});

test('flagship compact policy structurally recomposes professional surfaces', async () => {
  const css = await readFile(flagshipUrl, 'utf8');
  assert.match(css, /@media \(max-width: 980px\)[\s\S]*\.workroom-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.workroom-files,\s*\n\s*\.workroom-agent\s*\{[^}]*display:\s*grid[^}]*max-height:/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.skills-library__body\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.browser-workspace-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});

test('Mission secondary evidence text uses contrast-safe semantic roles on the open canvas', async () => {
  const css = await readFile(flagshipUrl, 'utf8');
  assert.match(css, /\.mission-spotlight > header \.eyebrow,\s*\n\.mission-spotlight > header p:last-child\s*\{[^}]*color:\s*var\(--text-secondary\)/s);
  assert.match(css, /\.mission-task-strip article div > small\s*\{[^}]*color:\s*var\(--text-secondary\)/s);
  assert.match(css, /\.execution-story > footer > span,\s*\n\.execution-story > footer > code,\s*\n\.follow-toggle > span\s*\{[^}]*color:\s*var\(--text-secondary\)/s);
});

test('Studio empty-state guidance remains readable on the flattened editor canvas', async () => {
  const css = await readFile(flagshipUrl, 'utf8');
  assert.match(css, /\.editor-welcome > p\s*\{[^}]*color:\s*var\(--text-secondary\)/s);
});

test('Control Plane taxonomy text stays readable after dashboard chrome is flattened', async () => {
  const css = await readFile(flagshipUrl, 'utf8');
  assert.match(css, /\.cp-workspace \.cp-eyebrow\s*\{[^}]*color:\s*var\(--text-secondary\)/s);
});

test('Control Plane cycle-2 composition reads as a system map rather than a nested dashboard', async () => {
  const css = await readFile(flagshipUrl, 'utf8');
  assert.match(css, /\.control-plane-shell\s*\{[^}]*border-radius:\s*8px[^}]*box-shadow:\s*none/s);
  assert.match(css, /\.control-plane-shell > main\s*\{[^}]*background:\s*var\(--surface-canvas\)/s);
  assert.match(css, /\.cp-workspace-hero\s*\{[^}]*border-radius:\s*0[^}]*background:\s*transparent[^}]*box-shadow:\s*none/s);
  assert.match(css, /\.cp-kpi-grid\s*\{[^}]*gap:\s*1px[^}]*background:\s*var\(--instrument-rule\)/s);
  assert.match(css, /\.cp-kpi-grid article\s*\{[^}]*border:\s*0[^}]*border-radius:\s*0/s);
  assert.match(css, /\.cp-adapter-grid\s*\{[^}]*gap:\s*1px[^}]*background:\s*var\(--instrument-rule\)/s);
  assert.match(css, /\.cp-adapter-card\s*\{[^}]*border:\s*0[^}]*border-radius:\s*0[^}]*box-shadow:\s*none/s);
});

test('Control Plane flattened records keep operational microcopy readable', async () => {
  const css = await readFile(flagshipUrl, 'utf8');
  assert.match(css, /\.cp-kpi-grid span,[\s\S]*\.cp-adapter-rows small\s*\{[^}]*color:\s*var\(--text-secondary\)/s);
});

test('Onboarding cycle-2 material uses one setup plate and trace-based choices', async () => {
  const css = await readFile(flagshipUrl, 'utf8');
  assert.match(css, /\.onboarding-shell\s*\{[^}]*background:\s*var\(--instrument-margin\)/s);
  assert.match(css, /\.onboarding-card\s*\{[^}]*border-radius:\s*10px[^}]*background:\s*var\(--surface-canvas\)[^}]*box-shadow:\s*var\(--shadow-sm\)/s);
  assert.match(css, /\.onboarding-choice,\s*\n\.onboarding-toggle\s*\{[^}]*border-radius:\s*6px[^}]*background:\s*transparent/s);
  assert.match(css, /\.onboarding-choice\[aria-pressed="true"\]\s*\{[^}]*box-shadow:\s*inset 2px 0 var\(--instrument-trace\)/s);
  assert.match(css, /\.onboarding-choice__icon\s*\{[^}]*border:\s*1px solid var\(--instrument-rule\)[^}]*border-radius:\s*50%[^}]*background:\s*transparent/s);
});
