import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
const routes = await readFile(new URL('../src/server/routes.mjs', import.meta.url), 'utf8');
const server = await readFile(new URL('../src/server/http-server.mjs', import.meta.url), 'utf8');

test('application composes AgentModeService into RunCoordinator and authenticated HTTP routes', () => {
  assert.match(app, /import \{ AgentModeService \} from '\.\/agents\/agent-mode-service\.mjs'/);
  assert.match(app, /const agentModes = new AgentModeService/);
  assert.match(app, /new RunCoordinator\([\s\S]*agentModes[\s\S]*providerInventory/);
  assert.match(app, /createHttpServer\([\s\S]*agentModes/);
  assert.match(routes, /pathname === '\/api\/agent-modes'/);
  assert.match(routes, /pathname === '\/api\/agent-modes\/resolve'/);
  assert.match(routes, /modeId: body\.modeId/);
  assert.match(server, /agentModes = null/);
  assert.match(server, /createRoutes\([\s\S]*agentModes/);
});
