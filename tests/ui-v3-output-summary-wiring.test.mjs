import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('UI v3 mounts global live output summary with working output, terminal, stop, and source actions', async () => {
  const app=await readFile(new URL('../ui-v3/app.mjs',import.meta.url),'utf8');
  const summary=await readFile(new URL('../ui-v3/views/summary/output-summary.mjs',import.meta.url),'utf8');
  assert.match(app,/createOutputSummaryController/); assert.match(app,/toggle-summary/); assert.match(app,/data-stop-process/); assert.match(summary,/visibilitychange/); assert.match(summary,/processes\/.*\/stop/);
  assert.match(summary,/data-terminal-id/);
  assert.match(app,/summaryAction==='add-output'/);
  assert.match(app,/\/workroom\$\{projectId\?/);
  assert.match(app,/params\.get\('terminal'\)/);
  assert.match(app,/request\('list'\)/);
  assert.match(app,/request\('snapshot'/);
});
