import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { ConstructionContractRuntime } from '../src/construction/construction-contract-runtime.mjs';
import { SemanticChangeSafetyRuntime } from '../src/construction/semantic-change-safety-runtime.mjs';
import { IndependentVerificationRuntime } from '../src/verification/independent-verification-runtime.mjs';
import { CausalInterventionLab } from '../src/cognition/causal-intervention-lab.mjs';
import { CounterfactualChangeRuntime } from '../src/world-model/counterfactual-change-runtime.mjs';

const execFileAsync = promisify(execFile);
const sha = (value) => canonicalSha256(value);
const fileSha = (value) => createHash('sha256').update(value).digest('hex');
const citation = (kind, relative = 'src/api.mjs') => ({ path: relative, line: 1, kind, sourceHash: sha(`${kind}:${relative}`) });

export const CONSTRUCTION_SAFETY_COMPLETION_REQUIREMENT_IDS = Object.freeze([
  '34.16',
  '35.6','35.7','35.11','35.12','35.13','35.15',
  '36.4','36.5','36.6','36.11','36.14','36.16',
  '37.4','37.5','37.11','37.15',
  '46.9','46.11','46.13','46.16',
]);

async function git(cwd, args, env = {}) {
  return execFileAsync('git', args, {
    cwd,
    windowsHide: true,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

async function createFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-construction-safety-measure-'));
  await mkdir(path.join(root, 'src'), { recursive: true });
  await mkdir(path.join(root, 'tests'), { recursive: true });
  await writeFile(path.join(root, 'src', 'api.mjs'), 'export function run(value = 1) { return value; }\n');
  await writeFile(path.join(root, 'tests', 'api.test.mjs'), "import { run } from '../src/api.mjs';\nif (run() !== 1) throw new Error('fail');\n");
  await git(root, ['init', '-q', '-b', 'main']);
  await git(root, ['config', 'user.email', 'construction-measure@example.invalid']);
  await git(root, ['config', 'user.name', 'Construction Safety Measurement']);
  await git(root, ['add', '.']);
  await git(root, ['commit', '-qm', 'deterministic baseline'], {
    GIT_AUTHOR_DATE: '2000-01-01T00:00:00Z',
    GIT_COMMITTER_DATE: '2000-01-01T00:00:00Z',
  });
  const head = (await git(root, ['rev-parse', 'HEAD'])).stdout.trim();
  return { root, head };
}

export async function measureConstructionSafetyCompletion({ rootDirectory = process.cwd(), version = '3.4.0' } = {}) {
  void rootDirectory;
  const fixture = await createFixture();
  const stateRoot = path.join(fixture.root, '.forge-state');
  const vaultRoot = path.join(fixture.root, '.forge-hidden');
  const contractRuntime = new ConstructionContractRuntime({ workspaceRoot: fixture.root, stateRoot });
  let candidateSet;
  try {
    const contract = contractRuntime.compileContract({
      contractId: 'service-v2',
      types: [{ name: 'Result', shape: '{ ok: boolean }' }],
      interfaces: [{ name: 'Service', methods: ['run(): Result'] }],
      errors: [{ code: 'RUN_FAILED', recoverable: true }],
      states: [{ from: 'ready', event: 'run', to: 'complete' }],
      compatibility: { publicApi: 'backward-compatible', data: 'no-destructive-migration', runtime: 'local-only' },
    });
    let incompletePlanRejected = false;
    try {
      contractRuntime.createVerticalPlan({
        planId: 'incomplete', contractReceiptSha256: contract.receiptSha256,
        slices: [{ sliceId: 's0', taskIds: ['t0'], allowedFiles: ['src/api.mjs'], contractIds: ['service-v2'], checkpoints: ['parse', 'test'] }],
      });
    } catch { incompletePlanRejected = true; }
    const plan = contractRuntime.createVerticalPlan({
      planId: 'plan-v2', contractReceiptSha256: contract.receiptSha256,
      slices: [
        { sliceId: 's1', taskIds: ['keep', 'obsolete'], allowedFiles: ['src/api.mjs'], contractIds: ['service-v2'], checkpoints: ['parse', 'type', 'test'] },
        { sliceId: 's2', taskIds: ['verify'], allowedFiles: ['tests/api.test.mjs'], contractIds: ['service-v2'], checkpoints: ['parse', 'type', 'test'] },
      ],
    });
    const replanned = contractRuntime.replan({
      plan, obsoleteTaskIds: ['obsolete'], reason: 'superseded by verified slice',
      verificationReceiptSha256: sha('verified-replan'),
    });
    const ownership = contractRuntime.bindOwnership({
      milestoneId: 'm1', maxFilesPerOwner: 2, maxContractsPerOwner: 1,
      assignments: [
        { ownerId: 'builder-a', files: ['src/api.mjs'], contracts: ['service-v2'] },
        { ownerId: 'builder-b', files: ['tests/api.test.mjs'], contracts: [] },
      ],
    });
    const verificationContractSha256 = sha({ checks: ['parse', 'type', 'test'], version: 1 });
    candidateSet = await contractRuntime.launchCandidates({
      verificationContractSha256,
      candidates: [{ candidateId: 'candidate-a' }, { candidateId: 'candidate-b' }],
    });
    const realCandidateWorktrees = candidateSet.candidates.length === 2 && (await Promise.all(candidateSet.candidates.map(async (candidate) => {
      const inside = (await git(candidate.worktreePath, ['rev-parse', '--is-inside-work-tree'])).stdout.trim();
      const head = (await git(candidate.worktreePath, ['rev-parse', 'HEAD'])).stdout.trim();
      return inside === 'true' && head === fixture.head && candidate.isolated === true && candidate.verificationContractSha256 === verificationContractSha256;
    }))).every(Boolean);

    const fingerprint = sha({ repository: 'deterministic-construction-fixture', head: fixture.head });
    await contractRuntime.saveState({
      capsuleId: 'exact-state', missionId: 'mission-1', planId: plan.planId, planRevision: 2, invariantRevision: 1,
      repositoryFingerprint: fingerprint, goal: 'complete safety slice', completedCriterionIds: ['contract'], decisionReceiptIds: ['decision-1'],
      changedSymbolIds: ['symbol:run'], verificationReceiptIds: ['verification-1'], residualRisks: ['external-gates-unchanged'],
      gitCheckpoint: fixture.head, nextStepIds: ['verify-release'],
    });
    const restarted = new ConstructionContractRuntime({ workspaceRoot: fixture.root, stateRoot });
    const restored = await restarted.restoreState('exact-state', {
      repositoryFingerprint: fingerprint, gitCheckpoint: fixture.head, planRevision: 2, invariantRevision: 1,
    });

    const safety = new SemanticChangeSafetyRuntime({ duplicateThreshold: 0.7 });
    const apiDiff = safety.diffApi({
      before: [{ symbolId: 'run', signature: 'run(value?: number): number', type: 'function', errors: ['E_OLD'], defaultValue: '1', events: ['done'], sideEffects: ['read:file'], citation: citation('before') }],
      after: [{ symbolId: 'run', signature: 'run(value: string): string', type: 'callable', errors: ['E_NEW'], defaultValue: null, events: ['complete'], sideEffects: ['write:file'], citation: citation('after') }],
    });
    const blast = safety.blastRadius({
      changedSymbolIds: ['symbol:run'],
      callerEdges: [{ from: 'symbol:caller', to: 'symbol:run', citation: citation('caller') }],
      testEdges: [{ from: 'test:run', to: 'symbol:run', citation: citation('test', 'tests/api.test.mjs') }],
      schemaEdges: [{ from: 'schema:result', to: 'symbol:run', citation: citation('schema') }],
      runtimeEdges: [{ from: 'runtime:request', to: 'symbol:run', citation: citation('runtime') }],
    });
    const duplicate = safety.detectExistingAbstraction({
      proposedName: 'executeRequest', proposedBehavior: 'validate input execute request return result',
      symbols: [{ symbolId: 'symbol:existing', name: 'executeRequest', behavior: 'validate input execute request return result', citation: citation('symbol') }],
    });
    const migrationBlocked = safety.migrationImpact({ schemaChanges: ['sessions.token'], configChanges: ['session.ttl'], migrations: [], rollbackPlan: null });
    const migrationReady = safety.migrationImpact({
      schemaChanges: ['sessions.token'], configChanges: ['session.ttl'], migrations: ['001_sessions_token'],
      rollbackPlan: { steps: ['restore previous column', 'restore session.ttl'], verificationReceiptSha256: sha('rollback-verified') },
    });
    const comparison = await safety.compareCandidates({
      verificationContractSha256,
      candidates: candidateSet.candidates,
      verifyCandidate: async ({ candidateId }) => ({
        status: 'pass', verificationContractSha256, receiptSha256: sha(`verification:${candidateId}`),
        verifiedCriteriaScore: candidateId === 'candidate-a' ? 10 : 9, requiredCriteriaScore: 10,
        criticalInvariantFailures: 0, regressionFailures: 0, semanticFootprint: candidateId === 'candidate-a' ? 2 : 3,
        tokenCost: 100, rssMbSeconds: 20, editCost: 2, changedLines: candidateId === 'candidate-a' ? 4 : 6,
      }),
    });
    const reviewBlocked = safety.reviewGate({
      executorId: 'agent-a', executorProviderId: 'provider-a', changeKinds: ['public-api'], risk: 0.9,
      reviewReceipt: { reviewerId: 'agent-a', reviewerProviderId: 'provider-a', status: 'approved', receiptSha256: sha('self-review') },
    });
    const reviewApproved = safety.reviewGate({
      executorId: 'agent-a', executorProviderId: 'provider-a', changeKinds: ['public-api'], risk: 0.9,
      reviewReceipt: { reviewerId: 'agent-b', reviewerProviderId: 'provider-b', status: 'approved', receiptSha256: sha('independent-review') },
    });

    const verifyRuntime = new IndependentVerificationRuntime({ vaultRoot, vaultKey: Buffer.alloc(32, 7) });
    const mutationFile = path.join(fixture.root, 'src', 'api.mjs');
    const originalBytes = await readFile(mutationFile);
    const mutation = await verifyRuntime.runMutationProbe({
      probeId: 'boundary-mutation', filePath: mutationFile,
      mutate: (source) => source.replace('return value', 'return value + 1'),
      verify: async () => ({ status: 'fail', failureCount: 1, receiptSha256: sha('mutation-caught') }),
    });
    const restoredBytes = await readFile(mutationFile);
    const independentReview = verifyRuntime.requireIndependentReview({
      risk: 0.9,
      executor: { identity: 'agent-a', provider: 'provider-a' },
      reviewer: { identity: 'agent-b', provider: 'provider-b' },
      review: { status: 'approved', receiptSha256: sha('verified-independent-review') },
    });
    const journey = verifyRuntime.verifyJourney({
      journeyId: 'api-run', kind: 'api', steps: [{ action: 'POST', target: '/run' }],
      beforeArtifact: { artifactId: 'request.json', sha256: sha('before-request') },
      afterArtifact: { artifactId: 'response.json', sha256: sha('after-response') },
      runtimeReceiptSha256: sha('runtime-journey'), assertions: [{ id: 'response-ok', status: 'pass' }],
    });
    const hiddenRegistration = await verifyRuntime.registerHiddenCase({
      caseId: 'held-out-rename', taskKind: 'rename', executorInput: { source: 'const oldName = 1;' },
      expected: { output: 'const newName = 1;' }, tags: ['held-out'],
    });
    let executorSawExpected = false;
    const hiddenResult = await verifyRuntime.evaluateHiddenCase('held-out-rename', async (input) => {
      executorSawExpected = Object.prototype.hasOwnProperty.call(input, 'expected');
      return { output: input.source.replace('oldName', 'newName') };
    });
    const hiddenEnvelope = await readFile(path.join(vaultRoot, 'held-out-rename.hidden'), 'utf8');

    const causal = await new CausalInterventionLab().run({
      interventionId: 'timeout-only', baselineState: { timeoutMs: 1000, retryCount: 2, payload: 'same' },
      intervention: { variable: 'timeoutMs', value: 2000 }, heldConstantVariables: ['retryCount', 'payload'],
      execute: async (state) => ({ observedState: state, outcome: { failures: 0 }, receiptSha256: sha(state) }),
    });
    const counterfactualRuntime = new CounterfactualChangeRuntime();
    const imagined = counterfactualRuntime.imagine({
      changeId: 'change-1', baselineCandidateId: 'no-change', candidates: [
        { candidateId: 'no-change', reliability: 1, effects: { api: 0, dependency: 0, state: 0, test: 0, userVisible: 0 }, utility: 1, citations: [{ kind: 'baseline', sourceHash: sha('baseline') }] },
        { candidateId: 'patch', reliability: 0.9, effects: { api: 0, dependency: 1, state: 1, test: 2, userVisible: 1 }, utility: 5, citations: [{ kind: 'patch', sourceHash: sha('patch') }] },
      ],
    });
    let executeBeforeVerifyRejected = false;
    try {
      await counterfactualRuntime.execute(imagined.receiptSha256, { executionReceiptSha256: sha('premature'), apply: async () => ({ status: 'pass', receiptSha256: sha('bad') }) });
    } catch { executeBeforeVerifyRejected = true; }
    const observedEffects = { api: 0, dependency: 1, state: 1, test: 2, userVisible: 1 };
    const verified = counterfactualRuntime.verify(imagined.receiptSha256, { observedReceiptSha256: sha('observed-probe'), observedEffects, status: 'pass' });
    const executed = await counterfactualRuntime.execute(verified.receiptSha256, {
      executionReceiptSha256: sha('execution-request'),
      apply: async () => ({ status: 'pass', receiptSha256: sha('execution-applied') }),
    });
    const improved = counterfactualRuntime.recordOutcome(executed.receiptSha256, { observedUtility: 7, baselineObservedUtility: 2, observedReceiptSha256: sha('outcome-improved') });
    const worsened = counterfactualRuntime.recordOutcome(executed.receiptSha256, { observedUtility: 0, baselineObservedUtility: 2, observedReceiptSha256: sha('outcome-worsened') });

    const expectedApiDimensions = ['default','errors','events','side-effects','signature','type'];
    const base = {
      schema: 'forge.studio.construction-safety-completion-measurement.v1',
      version: String(version),
      promotedRequirementIds: CONSTRUCTION_SAFETY_COMPLETION_REQUIREMENT_IDS,
      construction: {
        contractFirst: contract.claims.contractFirst === true,
        verticalCheckpointsRequired: incompletePlanRejected && plan.claims.checkpointAfterEverySlice === true,
        obsoleteTaskRevoked: replanned.revokedTaskIds.includes('obsolete') && !replanned.activeTaskIds.includes('obsolete'),
        boundedOwnership: ownership.status === 'bound' && ownership.claims.overlappingOwnershipAllowed === false,
        realCandidateWorktrees,
        exactStateResume: restored.exactMatch === true && restored.nextStepIds.includes('verify-release'),
      },
      changeSafety: {
        semanticApiDimensionsCovered: expectedApiDimensions.every((dimension) => apiDiff.dimensionsChanged.includes(dimension)),
        citedBlastRadius: blast.evidence.length === 4 && blast.uncitedEdgesRejected === 0,
        duplicateAbstractionDetected: duplicate.matches.length === 1 && duplicate.allowCreate === false,
        migrationRollbackRequired: migrationBlocked.status === 'blocked' && migrationReady.status === 'ready',
        candidatesComparedUnderOneContract: comparison.verificationContractSha256 === verificationContractSha256 && comparison.candidates.length === 2,
        independentReviewRequired: reviewBlocked.status === 'blocked' && reviewApproved.status === 'approved',
      },
      verification: {
        mutationCaught: mutation.mutationCaught === true,
        bytesRestoredExactly: mutation.restoredExactBytes === true && fileSha(originalBytes) === fileSha(restoredBytes),
        reviewerIndependent: independentReview.status === 'approved' && independentReview.identityIndependent === true && independentReview.providerIndependent === true,
        journeyArtifactsHashed: journey.status === 'pass' && journey.artifacts.before.sha256 === sha('before-request') && journey.artifacts.after.sha256 === sha('after-response'),
        hiddenExpectedEncrypted: hiddenRegistration.payloadExposed === false && !hiddenEnvelope.includes('const newName') && !hiddenEnvelope.includes('expected'),
        hiddenExpectedExecutorBlind: hiddenResult.status === 'pass' && hiddenResult.expectedExposedToExecutor === false && executorSawExpected === false,
      },
      counterfactual: {
        singleVariableIntervention: causal.changedVariables.length === 1 && causal.changedVariables[0] === 'timeoutMs',
        heldConstantsVerified: causal.heldConstantsVerified.length === 2,
        effectDimensionsCovered: ['api','dependency','state','test','userVisible'].every((dimension) => Object.hasOwn(imagined.effectDimensions, dimension)),
        imagineVerifyExecuteEnforced: executeBeforeVerifyRejected && imagined.phase === 'imagine' && verified.phase === 'verify' && executed.phase === 'execute',
        improvedOutcomeMeasured: improved.decisionImpact === 'improved',
        worsenedOutcomeMeasured: worsened.decisionImpact === 'worsened',
      },
      boundaries: {
        externalGateCountChanged: false,
        comparativeSuperiorityClaimed: false,
        simulationClaimedAsObserved: causal.claims.observationIsProductionEvidence === true || imagined.claims.simulationIsProductionEvidence === true,
        selfReviewAccepted: reviewBlocked.status === 'approved',
        hiddenExpectedExposed: hiddenRegistration.payloadExposed === true || hiddenResult.expectedExposedToExecutor === true || executorSawExpected,
      },
    };
    return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  } finally {
    if (candidateSet) await contractRuntime.cleanupCandidates(candidateSet);
    await rm(fixture.root, { recursive: true, force: true });
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  const version = process.argv[2] ?? '3.4.0';
  const result = await measureConstructionSafetyCompletion({ rootDirectory: process.cwd(), version });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
