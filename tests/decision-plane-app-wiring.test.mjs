import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { MissionResourceFabric } from '../src/runtime/mission-resource-fabric.mjs';

const digest = (value) => canonicalSha256(value);
const governor = { snapshot: () => ({ state: 'normal' }) };
const canary = { snapshot: () => ({ schema: 'test.canary.v1', cohorts: [] }) };
const processDriver = { async sampleTree() { return { cpuTimeMs: 0, rssBytes: 0, processCount: 0, pids: [], fileDescriptors: 0 }; }, async terminateTree() {} };

test('MissionResourceFabric exposes one lazy privacy-safe Decision Plane facade', async () => {
  const fabric = new MissionResourceFabric({ governor, canary, processDriver, projectRootResolver: () => process.cwd(), clock: () => 50 });
  const before = fabric.publicView();
  assert.equal(before.decision.schema, 'forge.decision-plane-snapshot.v1');
  assert.deepEqual(before.decision.lifecycle, { closed: false, criteriaLoaded: false, tokenizerLoaded: false, escalationLoaded: false, cognitionLoaded: false, constructionLoaded: false, verificationLoaded: false, memorySkillResourceLoaded: false, collaborationExperienceLoaded: false, securityCertificationLoaded: false, worldDevelopmentLoaded: false, frontierGovernanceLoaded: false, verifiedMissionLoaded: false, localFrontierCompletionLoaded: false, superiorityLoaded: false });

  const sourceHash = digest({ source: 'criterion-v1' });
  fabric.decision.registerTaskCriteria('task-1', [{ criterionId: 'criterion-1', description: 'Targeted behavior is verified', weight: 4, sourceHash }]);
  const unsigned = { schema: 'forge.acceptance-criterion-verification.v1', taskId: 'task-1', criterionId: 'criterion-1', status: 'pass', sourceHash, verifier: 'targeted-test' };
  fabric.decision.recordCriterionVerification('task-1', 'criterion-1', { ...unsigned, receiptSha256: digest(unsigned) });
  const criterionSnapshot = fabric.decision.criterionSnapshot('task-1');
  fabric.recordDecisionEfficiency({ taskId: 'task-1', providerId: 'provider-1', taskKind: 'bugfix', criterionSnapshot, inputTokens: 500, outputTokens: 100, contextTokensSelected: 300, contextTokensActuallyUseful: 220, rssMbSeconds: 120, changedLines: 7, changedFiles: 1, semanticFootprint: 2, correctionCycles: 0, revertedLines: 0, humanInterventions: 0, firstPatchPassed: true, observedAtMs: 50 });
  fabric.decision.createReceipt({ decisionId: 'decision-1', taskId: 'task-1', goal: 'Verify one criterion', hypotheses: [{ id: 'h1', confidence: 0.9, claim: 'The targeted behavior is correct' }], evidenceUsed: ['ev-support'], counterEvidenceUsed: ['ev-counter'], alternativesRejected: [], selectedAction: 'Keep the verified patch', expectedImpact: ['criterion-1'], actualImpact: ['criterion-1'], patchMetrics: { files: 1, changedLines: 7, semanticFootprint: 2, revertedLines: 0 }, verification: { targetedTests: 'passed', verifiedCriterionIds: ['criterion-1'] }, resourceCost: { inputTokens: 500, outputTokens: 100, contextTokens: 300, rssMbSeconds: 120, elapsedMs: 10 }, criterionSnapshot, createdAtMs: 50 });

  const after = fabric.publicView();
  assert.equal(after.decision.criteria.summary.verifiedCriteriaScore, 4);
  assert.equal(after.decision.efficiency.summary.samples, 1);
  assert.deepEqual(after.decision.recentDecisions[0].selectedEvidence, ['ev-support']);
  assert.deepEqual(after.decision.recentDecisions[0].counterEvidence, ['ev-counter']);
  assert.equal(after.decision.claims.rawPromptsStored, false);
  assert.equal(JSON.stringify(after).includes('Keep the verified patch'), false);
  assert.equal(after.decisionEfficiency.receiptSha256, after.decision.efficiency.receiptSha256);

  await fabric.close();
  assert.equal(fabric.publicView().decision.lifecycle.closed, true);
});

test('Decision Plane remains behind MissionResourceFabric without increasing app composition budget', async () => {
  const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  const fabric = await readFile(new URL('../src/runtime/mission-resource-fabric.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /AcceptanceCriteriaLedger|DecisionEfficiencyMetrics|TokenCostAdapter|ContextEscalationController|DecisionPlane|CognitiveKernel|VerificationControlPlane/);
  assert.match(fabric, /import \{ DecisionPlane \} from '\.\.\/decision\/decision-plane\.mjs';/);
  assert.equal((fabric.match(/new DecisionPlane\(/g) ?? []).length, 1);
  assert.match(app, /decisionPlane: missionResourceFabric\.decision/);
  assert.ok((app.match(/^import\s/mg) ?? []).length <= 160);
  assert.ok((app.match(/\bnew\s+[A-Z][A-Za-z0-9_$]*\s*\(/g) ?? []).length <= 180);
});
