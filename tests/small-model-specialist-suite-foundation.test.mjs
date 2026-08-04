import test from 'node:test';
import assert from 'node:assert/strict';
import { SmallModelFoundationService } from '../src/small-model/foundation-service.mjs';

const safeInput = {
  context: { specialist:'context-scorer', relevance:'high', fresh:true, trusted:true, contradiction:false, userPinned:false, authoritative:false, generatedNoise:false, sourcePath:'src/app.mjs', testPath:'tests/app.test.mjs', variant:77, tokenCost:20, ageHours:1, repositoryScope:'nolane-agent' },
  test: { specialist:'test-selector', sourcePath:'src/app.mjs', testPath:'tests/app.test.mjs', variant:77, changedFiles:1, changedSymbols:2, risk:'low', publicApiChanged:false, crossModule:false, dependencyChanged:false, assertionChanged:false, regressionUnknown:false },
  patch: { specialist:'patch-ranker', sourcePath:'src/app.mjs', testPath:'tests/app.test.mjs', variant:77, scopeMatch:true, testsPassed:true, hiddenTestsPassed:true, securityFindings:0, risk:'low', regressionDetected:false, apiChange:false, evidenceComplete:true, reversible:true },
  risk: { specialist:'risk-classifier', sourcePath:'src/app.mjs', testPath:'tests/app.test.mjs', variant:77, reversible:true, outsideWorkspace:false, destructive:false, secretAccess:false, networkEgress:false, operation:'read-or-local-test', filesAffected:1, schemaChange:false, authChange:false },
};

test('foundation bootstraps, promotes and reports the complete bounded specialist suite only with explicit approval', async () => {
  const service = new SmallModelFoundationService();
  await assert.rejects(service.bootstrapSpecialistSuite({ root: process.cwd(), variants: 12 }), /approval/i);
  const result = await service.bootstrapSpecialistSuite({ root: process.cwd(), variants: 12, approvedBy: 'checkpoint-owner' });
  assert.equal(result.promotions.length, 4);
  assert.equal(service.specialistSuiteStatus().ready, true);
  assert.deepEqual(service.specialistSuiteStatus().missing, []);
  assert.equal(service.status().claims.generalCodingIntelligence, false);
  assert.equal(service.status().boundedSpecialistSuiteReady, true);
  const decision = service.runSpecialistDecisionSupport(safeInput);
  assert.equal(decision.status, 'allow');
});

test('foundation suite status is fail-closed before promotion', () => {
  const service = new SmallModelFoundationService();
  const status = service.specialistSuiteStatus();
  assert.equal(status.ready, false);
  assert.equal(status.missing.length, 4);
  assert.throws(() => service.runSpecialistDecisionSupport(safeInput), /active promoted artifact/i);
});
