import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
const http = await readFile(new URL('../src/server/http-server.mjs', import.meta.url), 'utf8');
const routes = await readFile(new URL('../src/server/routes.mjs', import.meta.url), 'utf8');

test('application wires authenticated local task handoff without arbitrary path input', () => {
  assert.match(app, /import \{ LocalTaskHandoffService \} from '\.\/execution\/local-task-handoff-service\.mjs'/);
  assert.match(app, /const localTaskHandoff = new LocalTaskHandoffService\(\{ store, workspaceService \}\)/);
  assert.match(app, /createHttpServer\(\{[\s\S]*localTaskHandoff/);
  assert.match(http, /localTaskHandoff = null/);
  assert.match(http, /createRoutes\(\{[\s\S]*localTaskHandoff/);
  assert.match(routes, /\/api\/local-task-handoffs/);
  assert.match(routes, /principalId: req\.forgePrincipal\?\.subject/);
  assert.doesNotMatch(routes, /localTaskHandoff\.prepare\(\{[\s\S]{0,240}localWorkspace/);
  assert.doesNotMatch(routes, /localTaskHandoff\.prepare\(\{[\s\S]{0,240}worktree/);
});
