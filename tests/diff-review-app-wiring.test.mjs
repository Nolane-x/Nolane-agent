import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('application composes DiffReviewService with stale-safe ToolBroker mutation and HTTP routes', async () => {
  const app = await readFile('src/app.mjs', 'utf8');
  const server = await readFile('src/server/http-server.mjs', 'utf8');
  const routes = await readFile('src/server/routes.mjs', 'utf8');
  assert.match(app, /new DiffReviewService\(/);
  assert.match(app, /current\.snapshotSha256 !== expectedSnapshotSha256/);
  assert.match(app, /tool: 'fs\.patch'/);
  assert.match(app, /expectedSha256: read\.output\.sha256/);
  assert.match(app, /createHttpServer\([^\n]+diffReview/);
  assert.match(server, /createRoutes\([^\n]+diffReview/);
  assert.match(routes, /diff-review\\\/decisions/);
  assert.match(routes, /workspaceTrust\.requireTrusted\(snapshot\.projectId, 'background'\)/);
  assert.match(routes, /principal: req\.forgePrincipal/);
});
