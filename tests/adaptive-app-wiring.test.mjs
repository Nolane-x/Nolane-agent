import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('application bootstrap composes the adaptive intelligence plane into agent runtime and authenticated HTTP API', async () => {
  const source = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  const repositoryFabric = await readFile(new URL('../src/repository/repository-intelligence-fabric.mjs', import.meta.url), 'utf8');
  for (const fragment of [
    "OutcomeAwareProviderRouter",
    "OutcomeMetricsStore",
    "createRepositoryIntelligenceFabric",
    "ProjectMemorySidecar",
    "DynamicContextStore",
    "ContextHistoryArchive",
    "TerminalHistoryRecorder",
    "DynamicToolCatalog",
    "IndependentReviewService",
    "DurableAutomationService",
    "DesignContextService",
    "AdaptiveIntelligencePlane",
    "EnvironmentSupervisor",
    "EnvironmentControlService",
    "adaptiveIntelligence",
  ]) assert.match(source, new RegExp(fragment));
  assert.match(repositoryFabric, /AdaptiveRepositoryIntelligence/);
  assert.match(repositoryFabric, /SecureSemanticIndex/);
  assert.match(source, /repositoryIndex:\s*repositoryIntelligence|repositoryIndex,\s*instructionDiscovery/);
  assert.match(source, /memoryService:\s*projectMemorySidecar|memoryService,\s*mcpGateway/);
  assert.match(source, /createHttpServer\(\{[\s\S]*adaptiveIntelligence/);
  assert.match(source, /createHttpServer\(\{[\s\S]*environmentControl/);
  assert.match(source, /new VerificationRunner\(\{[\s\S]*environmentService:\s*environmentControl/);
  assert.match(source, /contextStore:\s*dynamicContextStore/);
  assert.match(source, /history:\s*contextHistoryArchive/);
  assert.match(source, /new TerminalHistoryRecorder\(\{[\s\S]*archive:\s*contextHistoryArchive/);
  assert.match(source, /new AgentLoop\(\{[\s\S]*dynamicToolCatalog/);
});

test('automation completion is bound to the terminal mission state rather than its dispatch', async () => {
  const source = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.match(source, /await runCoordinator\.whenSettled\(snapshot\.mission\.id\)/);
  assert.match(source, /const mission = store\.getMission\(snapshot\.mission\.id\)/);
  assert.match(source, /if \(mission\?\.status !== 'completed'\)\s*\{\s*return \{\s*status: 'fail'/);
  assert.match(source, /memory: `mission:\$\{mission\.id\}:completed`/);
});
