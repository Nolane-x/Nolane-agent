import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelArtifactRegistry } from '../src/small-model/model-artifact-registry.mjs';
import { trainBootstrapSpecialistSuite } from '../src/small-model/bootstrap-specialist-suite-training.mjs';
import { SpecialistDecisionSupport } from '../src/small-model/specialist-decision-support.mjs';

async function promotedRegistry() {
  const suite = await trainBootstrapSpecialistSuite({ root: process.cwd(), variants: 12 });
  const registry = new ModelArtifactRegistry();
  for (const [specialist, value] of Object.entries(suite.specialists)) {
    registry.register(value.artifact);
    registry.promote({ artifactSha256: value.artifact.artifactSha256, evaluation: value.heldOut, approvedBy: 'checkpoint-owner' });
  }
  return registry;
}

const safeInput = {
  context: { specialist:'context-scorer', relevance:'high', fresh:true, trusted:true, contradiction:false, userPinned:false, authoritative:false, generatedNoise:false, sourcePath:'src/app.mjs', testPath:'tests/app.test.mjs', variant:99, tokenCost:20, ageHours:1, repositoryScope:'nolane-agent' },
  test: { specialist:'test-selector', sourcePath:'src/app.mjs', testPath:'tests/app.test.mjs', variant:99, changedFiles:1, changedSymbols:2, risk:'low', publicApiChanged:false, crossModule:false, dependencyChanged:false, assertionChanged:false, regressionUnknown:false },
  patch: { specialist:'patch-ranker', sourcePath:'src/app.mjs', testPath:'tests/app.test.mjs', variant:99, scopeMatch:true, testsPassed:true, hiddenTestsPassed:true, securityFindings:0, risk:'low', regressionDetected:false, apiChange:false, evidenceComplete:true, reversible:true },
  risk: { specialist:'risk-classifier', sourcePath:'src/app.mjs', testPath:'tests/app.test.mjs', variant:99, reversible:true, outsideWorkspace:false, destructive:false, secretAccess:false, networkEgress:false, operation:'read-or-local-test', filesAffected:1, schemaChange:false, authChange:false },
};

test('decision support fails closed until every required specialist is promoted', async () => {
  const registry = new ModelArtifactRegistry();
  const support = new SpecialistDecisionSupport({ artifactRegistry: registry });
  assert.throws(() => support.decide(safeInput), /active promoted artifact.*context-scorer/i);
});

test('decision support combines four independent specialist receipts and allows a safe patch', async () => {
  const support = new SpecialistDecisionSupport({ artifactRegistry: await promotedRegistry() });
  const result = support.decide(safeInput);
  assert.equal(result.status, 'allow');
  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, false);
  assert.equal(result.decisions.context.action, 'support');
  assert.equal(result.decisions.test.action, 'unit');
  assert.equal(result.decisions.patch.action, 'accept');
  assert.equal(result.decisions.risk.action, 'low');
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(result.claims.generalCodingIntelligence, false);
});

test('decision support blocks critical or rollback decisions even when other specialists succeed', async () => {
  const support = new SpecialistDecisionSupport({ artifactRegistry: await promotedRegistry() });
  const result = support.decide({
    ...safeInput,
    patch: { ...safeInput.patch, risk:'critical', testsPassed:false, regressionDetected:true, previousKnownGood:true, evidenceComplete:true, reversible:true },
    risk: { ...safeInput.risk, operation:'destructive-external-secret', filesAffected:20, schemaChange:true, authChange:true, reversible:false, outsideWorkspace:true, destructive:true, secretAccess:true, networkEgress:true },
  });
  assert.equal(result.status, 'blocked');
  assert.equal(result.allowed, false);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.decisions.patch.action, 'rollback');
  assert.equal(result.decisions.risk.action, 'critical');
});
