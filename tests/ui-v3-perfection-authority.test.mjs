import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('perfection layers exist below accessibility and responsive authorities', async () => {
  const index = await read('ui-v3/styles/index.css');
  const density = "@import './perfection/density-regimes.css';";
  const detail = "@import './perfection/micro-detail.css';";
  const residue = "@import './perfection/platform-residue.css';";
  for (const marker of [density, detail, residue]) assert.ok(index.includes(marker), `missing ${marker}`);
  assert.ok(index.indexOf("@import './flagship/proofborne-instrument.css';") < index.indexOf(density));
  assert.ok(index.indexOf(density) < index.indexOf(detail));
  assert.ok(index.indexOf(detail) < index.indexOf(residue));
  assert.ok(index.indexOf(residue) < index.indexOf("@import './accessibility-runtime.css';"));
  assert.ok(index.indexOf("@import './accessibility-runtime.css';") < index.indexOf("@import './responsive.css';"));
});

test('all four approved experience regimes own distinct density contracts', async () => {
  const css = await read('ui-v3/styles/perfection/density-regimes.css');
  for (const regime of ['everyday', 'workspace', 'studio', 'expert']) {
    assert.match(css, new RegExp(`data-progressive-experience=["']${regime}["']`));
  }
  for (const token of ['--density-row-height', '--density-control-height', '--density-section-gap', '--density-control-gap']) {
    assert.ok(css.split(token).length >= 5, `${token} must be owned by all four regimes`);
  }
});

test('shared detail and residue layers expose product-safe mechanisms without cascade escape hatches', async () => {
  const detail = await read('ui-v3/styles/perfection/micro-detail.css');
  const residue = await read('ui-v3/styles/perfection/platform-residue.css');
  assert.match(detail, /\.ui-truncate/);
  assert.match(detail, /\.ui-machine-id/);
  assert.match(detail, /\.ui-consequence-plate/);
  assert.match(detail, /\.ui-focus-boundary/);
  assert.match(residue, /::selection/);
  assert.match(residue, /scrollbar-color/);
  assert.match(residue, /caret-color/);
  assert.doesNotMatch(`${detail}\n${residue}`, /!important/);
});
