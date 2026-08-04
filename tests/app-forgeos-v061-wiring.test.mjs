import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('application composes the synchronized ForgeOS bridge and governed model tool gateway', async () => {
  const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.match(app, /import \{ ForgeOsToolGateway \}/);
  assert.match(app, /new ForgeOsToolGateway\(\{ bridge: forgeBridge \}\)/);
  assert.match(app, /new AgentLoop\(\{[^}]*forgeGateway/s);
  assert.match(app, /createHttpServer\(\{[^}]*forgeBridge/s);
});
