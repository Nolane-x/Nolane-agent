import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../ui/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../ui/app.js', import.meta.url), 'utf8');
const moduleSource = await readFile(new URL('../ui/agent-modes-center.js', import.meta.url), 'utf8').catch(() => '');
const css = await readFile(new URL('../ui/agent-modes-center.css', import.meta.url), 'utf8').catch(() => '');

test('Agent Modes Center is lazy-loaded and exposes enforceable mode boundaries and run creation', () => {
  assert.match(index, /id="agent-modes-button"/);
  assert.match(index, /id="agent-modes-center"/);
  assert.match(app, /agentModes:\s*\['\/agent-modes-center\.js'/);
  assert.doesNotMatch(app, /^import .*agent-modes-center/m);
  assert.match(moduleSource, /\/api\/agent-modes/);
  assert.match(moduleSource, /\/api\/agent-modes\/resolve/);
  assert.match(moduleSource, /\/api\/agent\/runs/);
  for (const label of ['Ask','Read only','Plan','Edit with approval','Auto edit','Review','Debug','Test writer','Refactor','Migration','Architecture','Create project','CI repair','Issue resolution','Background','Learn codebase','Explain step by step','Fast','Deep','Offline local']) assert.match(moduleSource, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(moduleSource, /approvalPolicy/);
  assert.match(moduleSource, /networkPolicy/);
  assert.match(moduleSource, /commitPolicy/);
  assert.match(moduleSource, /budgetTokens/);
  assert.match(moduleSource, /localOnly/);
  assert.match(css, /mode-neural-orbit/);
  assert.match(css, /mode-policy-matrix/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(moduleSource, /localStorage.*token|sessionStorage.*token/i);
});
