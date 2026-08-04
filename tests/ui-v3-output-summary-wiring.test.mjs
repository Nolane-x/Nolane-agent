import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('UI v3 mounts global live output summary with stop and source navigation actions', async () => {
  const app=await readFile(new URL('../ui-v3/app.mjs',import.meta.url),'utf8');
  const summary=await readFile(new URL('../ui-v3/views/summary/output-summary.mjs',import.meta.url),'utf8');
  assert.match(app,/createOutputSummaryController/); assert.match(app,/toggle-summary/); assert.match(app,/data-stop-process/); assert.match(summary,/visibilitychange/); assert.match(summary,/processes\/.*\/stop/);
});
