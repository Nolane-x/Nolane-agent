import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const index = await readFile(new URL('../ui/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../ui/app.js', import.meta.url), 'utf8');
const moduleSource = await readFile(new URL('../ui/instruction-governance-center.js', import.meta.url), 'utf8').catch(() => '');
const css = await readFile(new URL('../ui/instruction-governance-center.css', import.meta.url), 'utf8').catch(() => '');
test('Instruction Governance Center is lazy, futuristic, and exposes policy evidence without secrets', () => {
  assert.match(index, /id="instruction-governance-button"/);
  assert.match(app, /instructionGovernance:\s*\['\/instruction-governance-center\.js'/);
  for (const text of ['Effective Rules', 'Precedence', 'Conflicts', 'Invalid Records', 'Sources & Imports']) assert.match(moduleSource, new RegExp(text));
  assert.match(moduleSource, /\/api\/instruction-policy/);
  assert.match(css, /instruction-aurora/);
  assert.match(css, /policy-lattice/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.doesNotMatch(moduleSource, /environment|authorization|localStorage.*token|systemPrompt|hiddenReasoning/i);
});
