import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('application composes the governed agent operating plane into the model loop and HTTP server', async () => {
  const [app, http] = await Promise.all([
    readFile(new URL('../src/app.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../src/server/http-server.mjs', import.meta.url), 'utf8'),
  ]);
  for (const name of [
    'OperatingPlaneToolGateway', 'OperatingPlaneService', 'AgentProfileLoader', 'HookEngine',
    'LanguageServerRegistry', 'CodeIntelligenceService', 'GitGateway', 'SecretScanner',
    'ImageComparisonService', 'SessionLedger', 'SymbolEditService', 'AdvancedSearchService', 'AstIntelligenceService', 'TestEngine', 'DiagnosticDeltaService', 'SelfFixController',
    'ProviderOutcomeFeedbackService', 'CapabilityGrantLedger', 'SqliteCapabilityStore', 'ActionGuardrailPipeline', 'SecretAccessService', 'VaultKvV2Provider', 'RemoteSecretManagerProvider', 'ArtifactSecurityScanner',
  ]) assert.match(app, new RegExp(`import \\{[^}]*${name}[^}]*\\}`, 's'), name);
  assert.match(app, /const symbolEditFactory =/);
  assert.match(app, /const advancedSearchFactory =/);
  assert.match(app, /const astIntelligenceFactory =/);
  assert.match(app, /const providerOutcomeFeedback = new ProviderOutcomeFeedbackService/);
  assert.match(app, /const testEngineFactory =/);
  assert.match(app, /const captureTaskTestBaseline =/);
  assert.match(app, /const selfFixFactory =/);
  assert.match(app, /const artifactSecurityFactory =/);
  assert.match(app, /const secretAccessService =/);
  assert.match(app, /const capabilityStateStore = new SqliteCapabilityStore/);
  assert.match(app, /createHttpServer\(\{[^}]*capabilityLedger: capabilityGrantLedger/s);
  assert.match(app, /new OperatingPlaneToolGateway\(\{[^}]*symbolEditFactory[^}]*advancedSearchFactory[^}]*astIntelligenceFactory[^}]*testEngineFactory[^}]*artifactSecurityFactory/s);
  assert.match(app, /new OperatingPlaneService\(\{[^}]*symbolEditFactory[^}]*advancedSearchFactory[^}]*astIntelligenceFactory[^}]*testEngineFactory[^}]*artifactSecurityFactory/s);
  assert.match(app, /'symbol-aware-edits'/);
  assert.match(app, /'advanced-repository-search'/);
  assert.match(app, /'local-ast-query-patch'/);
  assert.match(app, /'governed-test-engine'/);
  assert.match(app, /'external-secret-providers'/);
  assert.match(app, /'artifact-dependency-security'/);
  assert.match(app, /new AgentLoop\(\{[^}]*operatingPlaneGateway[^}]*hookEngineFactory/s);
  assert.match(app, /const missionRunner = new MissionRunner\(\{[^}]*baselineProvider: captureTaskTestBaseline[^}]*outcomeService: providerOutcomeFeedback/s);
  assert.match(app, /const verificationRunner = new VerificationRunner\(\{[\s\S]*?testEngineFactory:/);
  assert.match(app, /const autopilot = new MissionAutopilot\(\{[^}]*selfFixFactory/s);
  assert.match(app, /new AdaptiveIntelligencePlane\(\{[\s\S]*?outcomes: providerOutcomeFeedback/);
  assert.match(app, /createHttpServer\(\{[^}]*operatingPlane/s);
  assert.match(http, /createHttpServer\(\{[^}]*operatingPlane = null/s);
  assert.match(http, /createRoutes\(\{[^}]*operatingPlane/s);
});
