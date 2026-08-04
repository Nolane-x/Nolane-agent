import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('resource HUD is bounded, pressure-aware and consumes only the read-only fabric projection', async () => {
  const html = await readFile(new URL('../ui/index.html', import.meta.url), 'utf8');
  const module = await readFile(new URL('../ui/mission-resource-fabric.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../ui/mission-resource-fabric.css', import.meta.url), 'utf8');
  assert.match(html, /<link rel="stylesheet" href="\/mission-resource-fabric\.css">/);
  assert.match(html, /id="mission-resource-hud"/);
  assert.match(module, /api\('\/api\/mission-resource-fabric'\)/);
  assert.match(module, /slice\(0, 12\)/);
  assert.match(module, /requestAnimationFrame/);
  assert.match(module, /document\.documentElement\.dataset\.resourcePressure/);
  assert.match(css, /\[data-resource-pressure="pressure"\]/);
  assert.match(css, /\[data-resource-pressure="brownout"\]/);
  assert.match(css, /\[data-resource-pressure="emergency"\]/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(css, /backdrop-filter|filter:\s*blur/);
});
