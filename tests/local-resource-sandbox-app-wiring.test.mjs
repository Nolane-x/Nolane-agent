import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
const http = await readFile(new URL('../src/server/http-server.mjs', import.meta.url), 'utf8');
const routes = await readFile(new URL('../src/server/routes.mjs', import.meta.url), 'utf8');
const socket = await readFile(new URL('../src/server/terminal-websocket.mjs', import.meta.url), 'utf8');

test('application wires LocalResourceSandboxService into terminals, HTTP, events, and shutdown', () => {
  assert.match(app, /import \{ LocalResourceSandboxService \} from '\.\/sandbox\/local-resource-sandbox-service\.mjs'/);
  assert.match(app, /const localResourceSandbox = new LocalResourceSandboxService\(\{[\s\S]*local-resource-sandboxes\.db[\s\S]*projectResolver:[\s\S]*eventSink:/);
  assert.match(app, /new TerminalManager\(\{[\s\S]*resourceSandbox: localResourceSandbox/);
  assert.match(app, /createHttpServer\(\{[\s\S]*localResourceSandbox/);
  assert.match(app, /localResourceSandbox\.close\(\)/);
  assert.match(http, /localResourceSandbox = null/);
  assert.match(http, /createRoutes\(\{[\s\S]*localResourceSandbox/);
  assert.match(routes, /\/api\/local-resource-sandboxes\/capabilities/);
  assert.match(routes, /localResourceSandbox\.sample/);
  assert.match(routes, /localResourceSandbox\.closeLease/);
  assert.doesNotMatch(routes, /localResourceSandbox\.attachProcess/);
  assert.match(socket, /sandbox: message\.sandbox/);
  assert.match(socket, /principalId: 'local-admin'/);
});
