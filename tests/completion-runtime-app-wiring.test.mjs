import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
const http = await readFile(new URL('../src/server/http-server.mjs', import.meta.url), 'utf8');
const routes = await readFile(new URL('../src/server/routes.mjs', import.meta.url), 'utf8');
const sandbox = await readFile(new URL('../src/sandbox/local-resource-sandbox-service.mjs', import.meta.url), 'utf8');

test('application wires Tree-sitter and native isolation capabilities without exposing arbitrary native execution APIs', () => {
  assert.match(app, /TreeSitterRuntimeService/);
  assert.match(app, /PodmanSandboxDriver/);
  assert.match(app, /WindowsJobObjectDriver/);
  assert.match(app, /MacOsSandboxDriver/);
  assert.match(app, /const treeSitterRuntime = new TreeSitterRuntimeService/);
  assert.match(app, /new LocalResourceSandboxService\(\{[\s\S]*podmanDriver, windowsJobObjectDriver, macOsSandboxDriver,/);
  assert.match(app, /createHttpServer\(\{[\s\S]*treeSitterRuntime/);
  assert.match(http, /treeSitterRuntime = null/);
  assert.match(http, /createRoutes\(\{[\s\S]*treeSitterRuntime/);
  assert.match(routes, /\/api\/tree-sitter\/capabilities/);
  assert.match(routes, /\/api\/tree-sitter\/parse/);
  assert.doesNotMatch(routes, /podmanDriver\.create|windowsJobObjectDriver\.attach|macOsSandboxDriver\.prepare/);
  assert.match(sandbox, /nativeDrivers/);
});
