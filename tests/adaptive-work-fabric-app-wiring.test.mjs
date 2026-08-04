import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('application wires provider and browser lease pools into runtime status and shutdown', async () => {
  const source = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.match(source, /import \{ RuntimeLeasePool, createMissionResourceFabric \} from '\.\/runtime\/mission-resource-fabric\.mjs';/);
  assert.match(source, /const providerRuntimePool = new RuntimeLeasePool\(/);
  assert.match(source, /const providers = new ProviderRegistry\(\{ executionPool: providerRuntimePool, sessionHost: missionResourceFabric\.sessionHost \}\);/);
  assert.match(source, /const browserRuntimePool = new RuntimeLeasePool\(/);
  assert.match(source, /new BrowserAgentService\(\{ driver: browserDriver, leasePool: browserRuntimePool, journeyRecorder: missionResourceFabric\.journeys,/);
  assert.match(source, /workFabric: Object\.freeze\(\{\s*providers: providerRuntimePool\.snapshot\(\),\s*browser: browserRuntimePool\.snapshot\(\)/s);
  assert.match(source, /providerRuntimePool\.close\(\);\s*browserRuntimePool\.close\(\);/s);
});

test('agent and browser tool calls attach mission and task lease context', async () => {
  const agent = await readFile(new URL('../src/agent/agent-loop.mjs', import.meta.url), 'utf8');
  const browser = await readFile(new URL('../src/browser/browser-tool-gateway.mjs', import.meta.url), 'utf8');
  assert.match(agent, /leaseContext: \{(?=[^}]*missionId: task\.missionId)(?=[^}]*taskId: task\.id)(?=[^}]*role: task\.role \?\? 'executor')(?=[^}]*harnessProfileId: composed\.profileId)(?=[^}]*harnessRevision: composed\.profileRevision)[^}]*\}/);
  assert.match(browser, /leaseContext: \{ missionId: task\.missionId, taskId: task\.id, action \}, signal: context\.signal \?\? null/);
});
