import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
const http = await readFile(new URL('../src/server/http-server.mjs', import.meta.url), 'utf8');
const routes = await readFile(new URL('../src/server/routes.mjs', import.meta.url), 'utf8');

test('application wires LocalOperationsCenterService with controlled cache and authenticated routes', () => {
  assert.match(app, /import \{ LocalOperationsCenterService \} from '\.\/operations\/local-operations-center-service\.mjs'/);
  assert.match(app, /import \{ ControlledLocalCache \} from '\.\/operations\/controlled-local-cache\.mjs'/);
  assert.match(app, /const controlledLocalCache = new ControlledLocalCache\(/);
  assert.match(app, /const localOperations = new LocalOperationsCenterService\(\{[\s\S]*imageFactory: imageComparisonFactory[\s\S]*codeIntelligence[\s\S]*missionState: missionStateProgress[\s\S]*commandGovernance: commandExecutionGovernance[\s\S]*runCoordinator[\s\S]*sandbox: localResourceSandbox[\s\S]*cache: controlledLocalCache/);
  assert.match(app, /createHttpServer\(\{[\s\S]*localOperations/);
  assert.match(app, /controlledLocalCache\.close\(\)/);
  assert.match(http, /localOperations = null/);
  assert.match(http, /createRoutes\(\{[\s\S]*localOperations/);
  assert.match(routes, /\/api\/local-operations\/images\/content/);
  assert.doesNotMatch(routes, /localOperations[\s\S]{0,200}workspaceRoot\s*:/);
});
