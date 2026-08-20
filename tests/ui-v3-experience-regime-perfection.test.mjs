import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderExperienceSwitcher } from '../ui-v3/components/experience-switcher/experience-switcher.mjs';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('experience transition restores a visible switcher focus target after hidden-menu selection', async () => {
  const app = await read('ui-v3/app.mjs');
  assert.match(app, /restoreSwitcherFocus/);
  assert.match(app, /document\.activeElement\?\.closest\?\.\('\[data-experience-switcher\]'\)/);
  assert.match(app, /focusExperienceTrigger/);
  assert.match(app, /await render\(result\.path\);[\s\S]*focusExperienceTrigger/);
});

test('busy experience switcher announces busy state instead of disabled-only silence', () => {
  const html = renderExperienceSwitcher({ current: 'studio', busy: true });
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /disabled/);
});

test('experience regime density reaches real shell rows and controls', async () => {
  const shell = await read('ui-v3/styles/layout/app-shell.css');
  const switcher = await read('ui-v3/styles/components/experience-switcher.css');
  for (const expected of [
    /session-sidebar__new\{[^}]*min-height:var\(--density-control-height\)/,
    /session-sidebar__search\{[^}]*min-height:var\(--density-control-height\)/,
    /session-row\{[^}]*min-height:var\(--density-row-height\)/,
    /app-topbar__actions>button\{[^}]*height:var\(--density-control-height\)/,
  ]) assert.match(shell, expected);
  assert.match(switcher, /experience-pill[^}]*height:var\(--density-control-height\)/);
  assert.match(switcher, /experience-switcher__options>button\{[^}]*min-height:var\(--density-row-height\)/);
});

test('experience descriptions wrap instead of becoming hover-only ellipsis', async () => {
  const css = await read('ui-v3/styles/components/experience-switcher.css');
  const match = css.match(/\.experience-switcher__options small\{([^}]*)\}/);
  assert.ok(match);
  assert.doesNotMatch(match[1], /white-space:nowrap/);
  assert.doesNotMatch(match[1], /text-overflow:ellipsis/);
  assert.match(match[1], /line-height:/);
});
