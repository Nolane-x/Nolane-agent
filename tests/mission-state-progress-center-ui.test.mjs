import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../ui/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../ui/app.js', import.meta.url), 'utf8');
const moduleSource = await readFile(new URL('../ui/mission-state-center.js', import.meta.url), 'utf8').catch(() => '');
const css = await readFile(new URL('../ui/mission-state-center.css', import.meta.url), 'utf8').catch(() => '');

test('Mission State Center is lazy-loaded and renders durable progress, cost, approvals and subagents', () => {
  assert.match(index, /id="mission-state-button"/);
  assert.match(index, /id="mission-state-center"/);
  assert.match(app, /missionState:\s*\['\/mission-state-center\.js'/);
  assert.doesNotMatch(app, /^import .*mission-state-center/m);
  assert.match(moduleSource, /\/api\/mission-state-progress/);
  assert.match(moduleSource, /\/api\/mission-state-progress\/cost-check/);
  for (const label of ['User ID','Repository ID','Completion criteria','Hypotheses','Tests run','Tests passed','Tests failing','Cost used','Cost limit','Sandbox','Approvals','Subagents','Actual progress','Stalled']) assert.match(moduleSource, new RegExp(label, 'i'));
  assert.match(moduleSource, /receiptSha256/);
  assert.match(css, /mission-neural-orbit/);
  assert.match(css, /mission-progress-grid/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(moduleSource, /localStorage.*token|sessionStorage.*token/i);
});
