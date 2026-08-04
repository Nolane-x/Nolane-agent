import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('application bootstrap composes environment supervision into HTTP, model status, verification, and shutdown', async () => {
  const source = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.match(source, /new EnvironmentSupervisor\(/);
  assert.match(source, /new EnvironmentControlService\(/);
  assert.match(source, /environment:\s*environmentControl/);
  assert.match(source, /environmentService:\s*environmentControl/);
  assert.match(source, /createHttpServer\(\{[\s\S]*environmentControl/);
  assert.match(source, /environmentControl\.close\(\)/);
});
