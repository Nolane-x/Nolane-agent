import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('application routes agent and verification tools through the persisted autonomy guard', async () => {
  const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.match(app, /new AutonomyPolicy/);
  assert.match(app, /new AutonomyGuardedBroker/);
  assert.match(app, /AutonomyGuardedBroker\(\{ broker, policy: autonomyPolicy, store, task, environmentAttester \}\)/);
  assert.match(app, /createTaskEnvironmentAttester/);
  assert.match(app, /environmentAttester/);
  assert.match(app, /brokerForTask/);
});
