import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('application composes workspace trust into all behavior-shaping project surfaces', async () => {
  const app = await readFile('src/app.mjs', 'utf8');
  const loop = await readFile('src/agent/agent-loop.mjs', 'utf8');
  const routes = await readFile('src/server/routes.mjs', 'utf8');
  assert.match(app, /new SqliteWorkspaceTrustStore/);
  assert.match(app, /new WorkspaceTrustService/);
  assert.match(app, /new TrustAwareInstructionDiscovery/);
  assert.match(app, /new TrustAwareMcpGateway/);
  assert.match(app, /new TrustAwarePluginContext/);
  assert.match(app, /workspaceTrust\.status\(task\.projectId\)/);
  assert.match(app, /workspaceTrust\.requireTrusted\(request\.projectId, 'background'\)/);
  assert.match(app, /workspaceTrustStateStore\.close\(\)/);
  assert.match(loop, /discover\(instructionRoot, \{ projectId: task\.projectId, taskId: task\.id \}\)/);
  assert.match(routes, /workspace-trust/);
  assert.match(routes, /requireTrusted\(body\.projectId, 'plugins'\)/);
  assert.match(routes, /requireTrusted\(body\.projectId, 'background'\)/);
});
