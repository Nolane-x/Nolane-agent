import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../ui/evidence-runtime-center.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../ui/evidence-runtime-center.css', import.meta.url), 'utf8');

test('Evidence Runtime Center projects decision efficiency without raw private reasoning', () => {
  for (const label of ['Decision Efficiency', 'Criteria score', 'Token yield', 'Memory yield', 'Edit yield', 'Selected evidence', 'Counter-evidence', 'Non-claims']) assert.match(source, new RegExp(label, 'i'));
  assert.match(source, /missionResourceFabric\?\.decision|missionResourceFabric\.decision/);
  assert.match(source, /slice\(0,\s*100\)/);
  assert.doesNotMatch(source, /decision\.(?:rawPrompt|modelOutput|chainOfThought)|missionResourceFabric\?*\.(?:rawPrompt|modelOutput|chainOfThought)/i);
  assert.doesNotMatch(source, /innerHTML\s*=/);
});

test('Decision efficiency UI remains reduced-effects and bounded', () => {
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /content-visibility\s*:\s*auto/);
  assert.match(css, /contain-intrinsic-size/);
  assert.match(css, /\.decision-efficiency-grid/);
});
