import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
const http = await readFile(new URL('../src/server/http-server.mjs', import.meta.url), 'utf8');
const routes = await readFile(new URL('../src/server/routes.mjs', import.meta.url), 'utf8');

test('application wires GitCompletionGovernanceService through the authenticated HTTP plane', () => {
  assert.match(app, /import\s+\{\s*GitCompletionGovernanceService\s*\}\s+from\s+'\.\/repository\/git-completion-governance-service\.mjs'/);
  assert.match(app, /const gitGovernance\s*=\s*new GitCompletionGovernanceService\(\{\s*store,\s*gatewayFactory:\s*gitGatewayFactory\s*\}\)/);
  assert.match(app, /createHttpServer\(\{[^}]*gitGovernance/s);
  assert.match(http, /gitGovernance\s*=\s*null/);
  assert.match(http, /createRoutes\(\{[^}]*gitGovernance/s);
  assert.match(routes, /gitGovernance\s*=\s*null/);
  assert.match(routes, /\/api\/git-governance\/commit/);
  assert.match(routes, /\/api\/git-governance\/checkpoint/);
  assert.match(routes, /\/api\/git-governance\/collisions/);
  assert.match(routes, /principal:\s*req\.forgePrincipal/);
  assert.doesNotMatch(routes, /gitGovernance\.(?:commit|checkpoint|collisionMap)\(\{[^}]*projectRoot/s);
  assert.doesNotMatch(routes, /gitGovernance\.(?:commit|checkpoint|collisionMap)\(\{[^}]*argv/s);
});
