import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../ui/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../ui/app.js', import.meta.url), 'utf8');
const moduleSource = await readFile(new URL('../ui/agent-operations-center.js', import.meta.url), 'utf8').catch(() => '');

test('Agent Operations Center is a lazy professional management surface', () => {
  assert.match(index, /id="agent-operations-button"/);
  assert.match(app, /operations:\s*\['\/agent-operations-center\.js'/);
  assert.match(moduleSource, /Models/);
  assert.match(moduleSource, /Tools/);
  assert.match(moduleSource, /MCP/);
  assert.match(moduleSource, /Permissions/);
  assert.match(moduleSource, /Agents/);
  assert.match(moduleSource, /\/api\/operations-center/);
  assert.match(moduleSource, /\/api\/providers\/detect/);
  assert.match(moduleSource, /\/api\/capability-grants/);
  assert.match(moduleSource, /method:\s*'DELETE'/);
  assert.doesNotMatch(moduleSource, /localStorage.*token|sessionStorage.*token/i);
});
