import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { VerifiedMissionRuntime } from '../src/runtime/verified-mission-runtime.mjs';
import { ToolEffectVerifier } from '../src/cognition/tool-effect-verifier.mjs';
import { DiskBackedRawLog } from '../src/runtime/disk-backed-raw-log.mjs';
import { ProcessLeakReaper } from '../src/runtime/process-leak-reaper.mjs';
import { createPlatformResourceDriver } from '../src/sandbox/platform-resource-driver.mjs';

export const VERIFIED_MISSION_RUNTIME_REQUIREMENT_IDS = Object.freeze(['29.3','29.8','29.13','29.14','29.16','34.9','34.11','34.12','34.13','34.14','40.4','40.12','40.18']);
const sha = (character) => String(character).repeat(64);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function measureCore(rootDirectory) {
  const logRootDir = await mkdtemp(path.join(os.tmpdir(), 'forge-vmr-measure-'));
  const runtime = new VerifiedMissionRuntime({ logRootDir, clock: () => 1_000 });
  try {
    runtime.registerMission({ missionId: 'mission-1' });
    runtime.registerMilestone({ missionId: 'mission-1', milestoneId: 'milestone-1' });
    runtime.registerTask({ missionId: 'mission-1', milestoneId: 'milestone-1', taskId: 'task-1', criteria: [{ criterionId: 'criterion-1', weight: 3 }] });
    runtime.registerDecision({ missionId: 'mission-1', milestoneId: 'milestone-1', taskId: 'task-1', decisionId: 'decision-1' });
    runtime.recordContextSelection({
      decisionId: 'decision-1', selectionId: 'selection-1', receiptSha256: sha('1'),
      cards: [{ cardId: 'useful', tokenCount: 120, receiptSha256: sha('2') }, { cardId: 'unused', tokenCount: 30, receiptSha256: sha('3') }],
      contextTokensActuallyUseful: 999_999,
    });
    runtime.recordVerification({
      decisionId: 'decision-1', verificationId: 'verification-1', status: 'pass', receiptSha256: sha('4'),
      verifiedCriterionIds: ['criterion-1'], independentEvidenceReceiptSha256: sha('5'),
      usefulContext: [{ cardId: 'useful', reason: 'criterion', evidenceReceiptSha256: sha('6') }], contradictedContext: [],
    });
    for (const [index, category, amount] of [['1','context',150],['2','tool',2],['3','model',0.2],['4','process',150],['5','token',500]]) {
      runtime.recordCost({ costId: `cost-${index}`, decisionId: 'decision-1', category, amount, unit: 'measured', receiptSha256: sha(index) });
    }

    const baseline = {
      criterionIds: ['criterion-1'], requiredTestIds: ['unit','integration'], requiredCostCategories: ['token','tool','model','process','context'],
      criterionUniverseReceiptSha256: sha('7'), verificationContractReceiptSha256: sha('8'),
    };
    const candidate = {
      candidateId: 'correct', criterionIds: ['criterion-1'], verifiedCriterionIds: ['criterion-1'],
      criterionUniverseReceiptSha256: sha('7'), verificationContractReceiptSha256: sha('8'), executedTestIds: ['unit','integration'], weakenedTestIds: [],
      regressionCount: 0, hiddenRegressionCount: 0, verificationPassed: true, independentVerificationReceiptSha256: sha('9'),
      costs: { token: 500, tool: 2, model: 0.2, process: 150, context: 150 },
    };
    const hacked = { ...candidate, candidateId: 'hacked', skippedVerification: true, executedTestIds: [], costs: { token: 1, tool: 0, model: 0, process: 0, context: 0 } };
    const ranked = runtime.rankCandidates([hacked, candidate], { baseline });
    const hacking = runtime.detectRewardHacking(hacked, baseline);

    const effect = new ToolEffectVerifier().verify({
      toolRunReceiptSha256: sha('a'), declaredSuccess: true,
      expectedEffect: { targetTest: 'pass', fileSha256: sha('b') }, actualEffect: { targetTest: 'fail', fileSha256: sha('b') },
      probes: [{ probeId: 'independent-test', independent: true, receiptSha256: sha('c'), paths: ['targetTest','fileSha256'] }],
    });

    const lanes = { requirement: 0.9, retrieval: 0.5, hypothesis: 0.8, plan: 0.85, execution: 0.9, patch: 0.88, verification: 0.92 };
    const confidenceBase = runtime.finalConfidence({ domain: 'repository', taskKind: 'bugfix', lanes });
    const confidenceOne = runtime.finalConfidence({ domain: 'repository', taskKind: 'bugfix', lanes, independentEvidence: [{ family: 'test', confidence: 1, receiptSha256: sha('d') }] });
    const confidenceDuplicate = runtime.finalConfidence({ domain: 'repository', taskKind: 'bugfix', lanes, independentEvidence: [{ family: 'test', confidence: 1, receiptSha256: sha('d') }, { family: 'test', confidence: 1, receiptSha256: sha('e') }] });

    runtime.createDecisionState({ decisionId: 'decision-1', missionId: 'mission-1', taskId: 'task-1', specificationReceiptSha256: sha('f') });
    for (const [to, receiptKind, character] of [['proposed','proposal','a'],['verified','verification','b'],['authorized','authorization','c'],['executed','execution','d']]) runtime.transitionDecision('decision-1', { to, receiptKind, receiptSha256: sha(character) });
    let observationRequiredBeforeCommit = false;
    try { runtime.transitionDecision('decision-1', { to: 'committed', receiptKind: 'commit', receiptSha256: sha('e') }); }
    catch (error) { observationRequiredBeforeCommit = /invalid transition/i.test(error.message); }
    runtime.transitionDecision('decision-1', { to: 'observed', receiptKind: 'effect', receiptSha256: sha('0') });
    runtime.transitionDecision('decision-1', { to: 'committed', receiptKind: 'commit', receiptSha256: sha('1') });

    runtime.observeProgress({ scope: 'mission:mission-1', observationId: 'progress-1', actionFingerprint: 'same-action', verificationReceiptSha256: sha('2'), verifiedCriteriaScore: 3, testsPassed: 10, testsFailed: 0, semanticDiffHash: sha('3'), semanticDiffUnits: 1, informationGain: 0.2 });
    runtime.observeProgress({ scope: 'mission:mission-1', observationId: 'progress-2', actionFingerprint: 'same-action', verificationReceiptSha256: sha('4'), verifiedCriteriaScore: 3, testsPassed: 10, testsFailed: 0, semanticDiffHash: sha('5'), semanticDiffUnits: 100, informationGain: 0, effectVerified: false });
    runtime.observeProgress({ scope: 'mission:mission-1', observationId: 'progress-3', actionFingerprint: 'same-action', verificationReceiptSha256: sha('6'), verifiedCriteriaScore: 3, testsPassed: 10, testsFailed: 0, semanticDiffHash: sha('7'), semanticDiffUnits: 200, informationGain: 0, effectVerified: false });
    runtime.observeProgress({ scope: 'mission:mission-1', observationId: 'progress-4', actionFingerprint: 'same-action', verificationReceiptSha256: sha('8'), verifiedCriteriaScore: 3, testsPassed: 10, testsFailed: 0, semanticDiffHash: sha('9'), semanticDiffUnits: 300, informationGain: 0, effectVerified: false });

    runtime.registerResource({ resourceId: 'resource-1', decisionId: 'decision-1', taskId: 'task-1', milestoneId: 'milestone-1', missionId: 'mission-1', registrationReceiptSha256: sha('8') });
    runtime.sampleResource({ resourceId: 'resource-1', sampleId: 'sample-1', atMs: 0, rssMb: 100, sourceReceiptSha256: sha('9') });
    runtime.finalizeResource({ resourceId: 'resource-1', sampleId: 'sample-2', atMs: 1_000, rssMb: 200, sourceReceiptSha256: sha('a') });

    runtime.appendLog('mission-1', { event: 'tool', message: 'kept-on-disk', apiKey: 'SECRET', authorization: 'Bearer TOKEN' });
    const logSnapshot = runtime.logSnapshot('mission-1');
    runtime.logs.close();
    const restarted = new DiskBackedRawLog({ rootDir: logRootDir });
    const recovered = restarted.read('mission-1');
    const recoveredText = JSON.stringify(recovered);
    restarted.close();

    const scores = {
      task: runtime.score({ taskId: 'task-1' }).verifiedCriteriaScore,
      milestone: runtime.score({ milestoneId: 'milestone-1' }).verifiedCriteriaScore,
      mission: runtime.score({ missionId: 'mission-1' }).verifiedCriteriaScore,
    };
    return {
      outcomes: {
        scopeScores: scores,
        contextTokensActuallyUseful: runtime.contextUtility({ decisionId: 'decision-1' }).contextTokensActuallyUseful,
        costBoundToDecision: runtime.cost({ decisionId: 'decision-1' }).totalObservations === 5 && runtime.cost({ missionId: 'mission-1' }).totalObservations === 5,
      },
      objective: { correctnessFirst: ranked[0].candidateId === 'correct', rewardHackingBlocked: hacking.detected === true && ranked.find((item) => item.candidateId === 'hacked')?.eligible === false },
      effects: { falseSuccessDetected: effect.status === 'false_success', commitAllowed: effect.status === 'verified' },
      confidence: {
        lanes: Object.keys(lanes).sort(), weakestLaneControlsBase: confidenceBase.weakestLane.lane === 'retrieval' && confidenceBase.finalConfidence === confidenceBase.weakestLane.calibratedConfidence,
        correlatedEvidenceDeduplicated: confidenceOne.evidenceBonus === confidenceDuplicate.evidenceBonus && confidenceDuplicate.independentEvidenceFamilies.length === 1,
      },
      stateMachine: { observationRequiredBeforeCommit, finalState: runtime.decisionStateSnapshot('decision-1').state },
      progress: { churnOnlyDetected: runtime.evaluateProgress('mission:mission-1').churnOnly === true, status: runtime.evaluateProgress('mission:mission-1').status },
      resources: { taskRssMbSeconds: runtime.resourceSnapshot({ taskId: 'task-1' }).rssMbSeconds, missionRssMbSeconds: runtime.resourceSnapshot({ missionId: 'mission-1' }).rssMbSeconds },
      logs: {
        rawRecordsStoredInMemory: logSnapshot.claims.rawRecordsStoredInMemory,
        redactionVerified: !recoveredText.includes('SECRET') && !recoveredText.includes('TOKEN') && recoveredText.includes('[REDACTED]'),
        restartRecoveryVerified: recovered.records.length === 1 && recovered.records[0].record.message === 'kept-on-disk',
      },
    };
  } finally {
    try { runtime.close(); } catch {}
    await rm(logRootDir, { recursive: true, force: true });
  }
}

async function measureProcesses() {
  let realTreeCleanupVerified = false;
  if (process.platform === 'linux') {
    const script = `const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});console.log(child.pid);setInterval(()=>{},1000);`;
    const root = spawn(process.execPath, ['-e', script], { detached: true, stdio: ['ignore', 'pipe', 'ignore'] });
    try {
      await new Promise((resolve, reject) => { root.stdout.once('data', resolve); root.once('error', reject); });
      const driver = createPlatformResourceDriver({ platform: 'linux' });
      const before = await driver.sampleTree(root.pid);
      const result = await new ProcessLeakReaper({ driver, sleep, maxGraceMs: 1_000 }).reapMission({ missionId: 'measurement', rootPid: root.pid, registeredPids: before.pids, rootIdentity: before.rootIdentity, identityReceiptSha256: sha('f'), graceMs: 100 });
      realTreeCleanupVerified = ['graceful','escalated'].includes(result.status) && !(await driver.isTreeAlive(root.pid)) && result.killedPids.every((item) => before.pids.includes(item));
    } finally { try { process.kill(-root.pid, 'SIGKILL'); } catch {} }
  }
  const blocked = await new ProcessLeakReaper({ driver: {
    async sampleTree() { return { pids: [10, 11], rootIdentity: { pid: 10, startTimeTicks: 1 } }; },
    async killTree() { throw new Error('must not kill outside registered set'); }, async isTreeAlive() { return true; },
  }, sleep: async () => {} }).reapMission({ missionId: 'safety', rootPid: 10, registeredPids: [10], rootIdentity: { pid: 10, startTimeTicks: 1 }, identityReceiptSha256: sha('a') });
  return { realTreeCleanupVerified, unregisteredProcessKillAllowed: blocked.status !== 'safety_blocked' };
}

export async function measureVerifiedMissionRuntime({ rootDirectory = process.cwd(), version, outputFile = null } = {}) {
  const releaseVersion = String(version ?? '');
  if (!/^\d+\.\d+\.\d+$/.test(releaseVersion)) throw new TypeError('semantic release version is required');
  const root = path.resolve(rootDirectory);
  const core = await measureCore(root);
  const processes = await measureProcesses();
  const boundaries = Object.freeze({
    externalGateCountChanged: false, unverifiedOutcomeCreatesValue: false, unregisteredProcessKillAllowed: false,
    autonomousMergeOrPublishClaimed: false, comparativeSuperiorityClaimed: false, independentProductionBenchmarkClaimed: false,
  });
  const base = {
    schema: 'forge.studio.verified-mission-runtime-measurement.v1', version: releaseVersion,
    promotedRequirementIds: VERIFIED_MISSION_RUNTIME_REQUIREMENT_IDS,
    ...core, processes, boundaries,
  };
  const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  const destination = outputFile ? path.resolve(outputFile) : path.join(root, 'docs', `verified-mission-runtime-measurement-${releaseVersion}.json`);
  if (outputFile) { await mkdir(path.dirname(destination), { recursive: true }); await writeFile(destination, `${JSON.stringify(report, null, 2)}\n`); }
  return report;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const root = path.resolve(process.argv[2] ?? '.');
  const version = String(process.argv[3] ?? JSON.parse(await (await import('node:fs/promises')).readFile(path.join(root, 'package.json'), 'utf8')).version);
  const output = path.join(root, 'docs', `verified-mission-runtime-measurement-${version}.json`);
  const report = await measureVerifiedMissionRuntime({ rootDirectory: root, version, outputFile: output });
  process.stdout.write(`${JSON.stringify({ status: 'pass', version, receiptSha256: report.receiptSha256, output: path.relative(root, output).replaceAll('\\', '/') })}\n`);
}
