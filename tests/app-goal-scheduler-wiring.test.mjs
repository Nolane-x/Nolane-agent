import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('repository-change scheduling uses the ToolBroker request envelope', async () => {
  const app = await readFile('src/app.mjs', 'utf8');

  assert.match(app, /tool:\s*'process\.run',\s*input:\s*\{\s*executable:\s*'git'/);
  assert.doesNotMatch(app, /broker\.execute\(\{\s*kind:\s*'process\.run'/);
});
