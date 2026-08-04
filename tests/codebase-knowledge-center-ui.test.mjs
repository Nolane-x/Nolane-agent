import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const index = await readFile(new URL('../ui/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../ui/app.js', import.meta.url), 'utf8');
const moduleSource = await readFile(new URL('../ui/codebase-knowledge-center.js', import.meta.url), 'utf8').catch(() => '');
const css = await readFile(new URL('../ui/codebase-knowledge-center.css', import.meta.url), 'utf8').catch(() => '');
test('Codebase Knowledge Center is lazy, evidence-bound, and futuristic', () => {
  assert.match(index, /id="codebase-knowledge-button"/);
  assert.match(index, /id="codebase-knowledge-center"/);
  assert.match(app, /codebaseKnowledge:\s*\['\/codebase-knowledge-center\.js'/);
  for (const label of ['Graph', 'Routes & APIs', 'Data Models', 'References & Calls', 'Git History', 'Regex Search', 'Live Watch', 'Ranking']) assert.match(moduleSource, new RegExp(label.replace(/[&]/g, '&')));
  assert.match(moduleSource, /\/api\/codebase-knowledge/);
  assert.match(css, /knowledge-constellation/);
  assert.match(css, /knowledge-signal-grid/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.doesNotMatch(moduleSource, /environment|argv|credential|tokenValue|absolutePath/i);
});
