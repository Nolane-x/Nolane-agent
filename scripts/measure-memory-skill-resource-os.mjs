import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';
import { MemoryService } from '../src/memory/memory-service.mjs';
import { ProjectMemorySidecar } from '../src/memory/project-memory-sidecar.mjs';
import { MemoryOperatingSystem } from '../src/memory/memory-operating-system.mjs';
import { MemoryPolicyController } from '../src/memory/memory-policy-controller.mjs';
import { ModelTimeClock } from '../src/memory/model-time-clock.mjs';
import { ReplayScheduler } from '../src/memory/replay-scheduler.mjs';
import { CompositionalSkillCompiler } from '../src/skills/compositional-skill-compiler.mjs';
import { SkillRegistry } from '../src/skills/skill-registry.mjs';
import { StabilityPlasticityGuard } from '../src/skills/stability-plasticity-guard.mjs';
import { ResourceAdmissionController } from '../src/runtime/resource-admission-controller.mjs';
import { ResourceLifecycleCoordinator } from '../src/runtime/resource-lifecycle-coordinator.mjs';
import { ContentAddressedArtifactStore } from '../src/storage/content-addressed-artifact-store.mjs';
import { DecisionPlane } from '../src/decision/decision-plane.mjs';

const digest = (value) => createHash('sha256').update(String(value)).digest('hex');
const fixedHash = (char) => char.repeat(64);
const metrics = (extra = {}) => ({ availableRamMb: 4_000, totalRamMb: 8_192, diskFreeMb: 20_000, errorRate: 0.01, activeAgents: 1, pendingIrreversibleActions: 0, unverifiedMemory: 2, policyDrift: 0.1, ...extra });
const request = (kind, extra = {}) => ({ resourceId: `${kind}-1`, kind, missionId: 'mission-1', taskId: 'task-1', owner: 'executor-1', expectedVerifiedUtility: 0.7, rssBudgetMb: 200, cpuBudgetSeconds: 60, fdBudget: 64, processBudget: 4, timeCostSeconds: 30, idleTtlMs: 30_000, reversible: true, ...extra });

async function createActiveMemory(sidecar, projectId, { title, content, kind = 'episodic' }) {
  const proposed = await sidecar.propose({ projectId, title, content, kind, citations: [] });
  return sidecar.approve(proposed.id, { actor: 'user:release-measurement', evidenceReceiptSha256: fixedHash('a') });
}

export async function measureMemorySkillResourceOs({ rootDirectory = process.cwd(), version } = {}) {
  const root = path.resolve(rootDirectory);
  const temp = await mkdtemp(path.join(os.tmpdir(), 'forge-226-measurement-'));
  let store = null;
  try {
    let now = 1_000;
    store = new StudioStore(path.join(temp, 'studio.db'));
    const project = store.createProject({ name: '2.26 measurement', workspaceRoot: temp });
    const memoryService = new MemoryService({ store, memoryRoot: path.join(temp, 'memory') });
    const sidecar = new ProjectMemorySidecar({ store, memoryService, clock: () => now });
    const memoryOs = new MemoryOperatingSystem({ store, memoryService, memorySidecar: sidecar, clock: () => now });
    const operationReceipts = [];

    const scoped = await createActiveMemory(sidecar, project.id, { title: 'Session cache', content: 'Session cache is invalidated by rotation events.' });
    operationReceipts.push(await memoryOs.apply({ projectId: project.id, memoryId: scoped.id, operation: 'suppress', actor: 'reviewer', scope: { taskId: 'task-private' }, reason: 'task irrelevant', sourceHash: digest(scoped.content), evidenceReceiptSha256: fixedHash('b') }));
    operationReceipts.push(await memoryOs.apply({ projectId: project.id, memoryId: scoped.id, operation: 'deprioritize', actor: 'reviewer', scope: { projectId: project.id }, priorityDelta: -0.3, reason: 'weak transfer', sourceHash: digest(scoped.content), evidenceReceiptSha256: fixedHash('c') }));

    const invalid = await createActiveMemory(sidecar, project.id, { title: 'Old endpoint', content: 'Use /v1/session.' });
    operationReceipts.push(await memoryOs.apply({ projectId: project.id, memoryId: invalid.id, operation: 'invalidate', actor: 'reviewer', reason: 'endpoint removed', sourceHash: digest(invalid.content), evidenceReceiptSha256: fixedHash('d') }));
    const archived = await createActiveMemory(sidecar, project.id, { title: 'Old queue', content: 'The old queue used polling.' });
    operationReceipts.push(await memoryOs.apply({ projectId: project.id, memoryId: archived.id, operation: 'archive', actor: 'reviewer', reason: 'historical only', sourceHash: digest(archived.content), evidenceReceiptSha256: fixedHash('e') }));

    now = 2_000;
    const schema = await createActiveMemory(sidecar, project.id, { title: 'Module schema', content: 'All packages use ESM.', kind: 'semantic' });
    operationReceipts.push(await memoryOs.apply({ projectId: project.id, memoryId: schema.id, operation: 'abstract', actor: 'reviewer', layer: 'semantic_schema', abstractedTitle: 'Module schema', abstractedContent: 'Packages use ESM unless a verified exception exists.', reason: 'verified schema', sourceHash: digest(schema.content), evidenceReceiptSha256: fixedHash('f') }));
    const exception = await createActiveMemory(sidecar, project.id, { title: 'Legacy exception', content: 'scripts/legacy-migration.cjs must remain CommonJS.', kind: 'exception' });
    await memoryOs.apply({ projectId: project.id, memoryId: exception.id, operation: 'abstract', actor: 'reviewer', layer: 'exception', abstractedTitle: exception.title, abstractedContent: exception.content, reason: 'legacy compatibility', sourceHash: digest(exception.content), evidenceReceiptSha256: fixedHash('1') });

    const privateMemory = await createActiveMemory(sidecar, project.id, { title: 'Private note', content: 'private bytes must disappear' });
    operationReceipts.push(await memoryOs.apply({ projectId: project.id, memoryId: privateMemory.id, operation: 'delete', actor: 'user', reason: 'privacy request', privacy: true, sourceHash: digest(privateMemory.content), evidenceReceiptSha256: fixedHash('2') }));
    const retrieved = memoryOs.retrieve(project.id, 'legacy migration commonjs esm');
    const scopeVersions = memoryOs.versions(scoped.id);
    const schemaVersions = memoryOs.versions(schema.id);

    const policy = new MemoryPolicyController();
    const selfReport = policy.decide({ operation: 'ADD', modelReportedUseful: true, evidenceReceiptSha256: fixedHash('3') });
    const verifiedPolicy = policy.decide({ operation: 'UPDATE', verifiedValue: 0.9, evidenceReceiptSha256: fixedHash('4') });

    const modelTime = new ModelTimeClock();
    const ignored = modelTime.observe({ rawSteps: 99_999 });
    const advanced = modelTime.observe({ policyDrift: 0.4, schemaChanges: 2, correctionRate: 0.3 });
    const replay = new ReplayScheduler({ maxQueue: 3 }).schedule({ modelTime: advanced.modelTime, episodes: [
      { episodeId: 'routine', predictionError: 0.1 },
      { episodeId: 'reverted', predictionError: 0.6, reverted: true, transferValue: 0.8 },
      { episodeId: 'conflict', conflict: 0.7, calibrationError: 0.5 },
    ] });

    const compiler = new CompositionalSkillCompiler();
    const registry = new SkillRegistry();
    const skill = registry.add(compiler.compile({
      name: 'repair stale schema cache',
      episodes: [{ episodeId: 'ep-verified', repositoryId: 'repo-a', verified: true, verificationReceiptSha256: fixedHash('5'), outcome: 'passed' }],
      preconditions: [{ key: 'schemaChanged', type: 'boolean', equals: true }],
      parameters: [{ name: 'schemaPath', type: 'path' }, { name: 'verificationCommand', type: 'command' }],
      effects: [{ target: 'cache.generated', operation: 'set', valueType: 'boolean' }],
      invariants: ['public API unchanged'], verifier: { kind: 'command', commandId: 'verify-schema-cache' },
      failureSignatures: ['generated output differs nondeterministically'], costEstimate: { tokens: 1800, timeSeconds: 40, rssMbSeconds: 1200 },
      rollback: { kind: 'git-checkpoint', required: true }, decomposition: ['locate generator', 'regenerate', 'compare semantic diff', 'run impacted tests'],
    }));
    let sameDomainTransferRejected = false;
    try { registry.recordTransfer(skill.skillId, { sourceRepositoryId: 'repo-a', targetRepositoryId: 'repo-a', sourceVocabulary: 'schema', targetVocabulary: 'schema', passed: true, receiptSha256: fixedHash('6') }); }
    catch { sameDomainTransferRejected = true; }
    const transferred = registry.recordTransfer(skill.skillId, { sourceRepositoryId: 'repo-a', targetRepositoryId: 'repo-b', sourceVocabulary: 'schema', targetVocabulary: 'contract', passed: true, receiptSha256: fixedHash('6') });
    const stability = new StabilityPlasticityGuard({ maxBackwardLoss: 0.03 }).evaluate({
      candidateSkillId: transferred.skillId, candidateState: transferred.state,
      baseline: { oldTaskSuccess: 0.9, newTaskSuccess: 0.6, lateTaskSuccess: 0.7, memoryItems: 100 },
      candidate: { oldTaskSuccess: 0.7, newTaskSuccess: 0.75, lateTaskSuccess: 0.72, memoryItems: 110 },
      exceptionRetention: true, sourceTaskOnly: false, policyLineage: ['policy-v1', 'policy-v2'],
      rollbackTarget: { policyId: 'policy-v1', receiptSha256: fixedHash('7') }, verificationReceiptSha256: fixedHash('8'),
    });

    let resourceNow = 1_000;
    const admission = new ResourceAdmissionController({ clock: () => resourceNow });
    const browserDenied = admission.admit(request('browser', { expectedVerifiedUtility: 0.05, rssBudgetMb: 500, timeCostSeconds: 120, taskProfile: { backendOnly: true } }), metrics());
    const targeted = admission.admit(request('test', { resourceId: 'test-targeted', expectedVerifiedUtility: 0.95, rssBudgetMb: 120, timeCostSeconds: 5 }), metrics());
    resourceNow = 6_000; admission.sample(targeted.lease.leaseId, { rssMb: 100, atMs: resourceNow });
    resourceNow = 11_000; const targetedClosed = admission.release(targeted.lease.leaseId, { atMs: resourceNow, reason: 'verified' });
    const embedding = admission.admit(request('embedding', { resourceId: 'embed-1', expectedVerifiedUtility: 0.8, rssBudgetMb: 700, idleTtlMs: 1 }), metrics());
    const predicted = admission.admit(request('browser', { resourceId: 'browser-predicted', expectedVerifiedUtility: 0.95, rssBudgetMb: 900, timeCostSeconds: 20, plannedDemand: { testRssMb: 500 } }), metrics({ availableRamMb: 2_000 }));
    const providerLease = admission.admit(request('provider', { resourceId: 'provider-mismatch', missionId: 'mission-mismatch', processRoot: 5252, expectedVerifiedUtility: 0.9, rssBudgetMb: 100, timeCostSeconds: 10 }), metrics());
    const terminated = [];
    const coordinator = new ResourceLifecycleCoordinator({ admissionController: admission, processLedger: { snapshot: () => ({ entries: [{ rootPid: 9999, missionId: 'mission-mismatch', state: 'running' }] }) }, processDriver: { async terminateTree(pid) { terminated.push(pid); } }, clock: () => 12_000 });
    const mismatch = await coordinator.stopMission({ missionId: 'mission-mismatch', leaseIds: [providerLease.lease.leaseId], reason: 'measurement' });

    const artifactStore = new ContentAddressedArtifactStore({ root: path.join(temp, 'artifacts'), maxPreviewBytes: 8 });
    const artifactA = await artifactStore.put({ kind: 'tool-output', data: 'abcdefghijklmnopqrstuvwxyz', refs: { missionId: 'mission-1' }, summary: 'alphabet' });
    const artifactB = await artifactStore.put({ kind: 'tool-output', data: 'abcdefghijklmnopqrstuvwxyz', refs: { missionId: 'mission-2' }, summary: 'same bytes' });
    const artifactSnapshot = artifactStore.snapshot();

    const decision = new DecisionPlane({ memorySkillResource: { artifacts: { root: path.join(temp, 'lazy-artifacts') } } });
    const fastPath = decision.snapshot().lifecycle.memorySkillResourceLoaded === false;
    decision.decideMemoryPolicy({ operation: 'RETRIEVE', evidenceReceiptSha256: fixedHash('9') });
    const lazySnapshot = decision.memorySkillResourceSnapshot();
    decision.close();

    const app = await readFile(path.join(root, 'src/app.mjs'), 'utf8');
    const operations = [...new Set(operationReceipts.map((item) => item.operation))].sort();
    const base = {
      schema: 'forge.studio.memory-skill-resource-os-measurement.v1', version: String(version),
      memory: {
        operations, versionHistory: scopeVersions.length >= 3 && schemaVersions.some((item) => item.validUntilMs != null),
        exceptionPrecedence: retrieved[0]?.layer === 'exception' && retrieved.some((item) => item.layer === 'semantic_schema'),
        privacyDeletionContentRetained: JSON.stringify(store.db.prepare('SELECT * FROM memory_tombstones').all()).includes('private bytes'),
        snapshotReceiptSha256: memoryOs.snapshot(project.id).receiptSha256,
      },
      policy: { selfReportRejected: selfReport.allowed === false && selfReport.selectedOperation === 'NOOP', verifiedConsolidationAllowed: verifiedPolicy.allowed === true, shadowOnly: selfReport.shadowOnly && verifiedPolicy.shadowOnly },
      replay: { modelTimeIgnoresRawSteps: ignored.modelTime === 0 && ignored.rawStepsIgnored === true, modelTimeAdvancedOnChange: advanced.modelTime > 0, revertedEpisodePrioritized: replay.queue[0]?.episodeId === 'reverted', modelInvoked: replay.claims.modelInvoked },
      skills: { typedOperator: skill.parameters.some((item) => item.type === 'path') && skill.effects.length > 0 && skill.verifier.commandId === 'verify-schema-cache', transferRequired: sameDomainTransferRejected && transferred.state === 'transfer-tested', regressionBlocked: stability.promotable === false && stability.reasons.some((item) => /backward/i.test(item)), automaticPromotionExecuted: stability.claims.automaticPromotionExecuted },
      resources: { lowValueBrowserDenied: browserDenied.allowed === false, targetedTestAdmitted: targeted.allowed === true, rssMbSecondsMeasured: targetedClosed.rssMbSeconds === 500, predictedEviction: predicted.allowed === true && predicted.evictLeaseIds.includes(embedding.lease.resourceId), pidMismatchProtected: terminated.length === 0 && mismatch.skipped[0]?.reason === 'process-identity-mismatch', activeLeaseCount: admission.snapshot().active.length },
      artifacts: { deduplicated: artifactA.sha256 === artifactB.sha256 && artifactB.deduplicated === true && artifactSnapshot.uniqueBlobs === 1, rawBytesInSnapshot: JSON.stringify(artifactSnapshot).includes('ijklmnopqrstuvwxyz'), boundedPreviewBytes: Buffer.byteLength(artifactA.projection.preview) },
      lazy: { fastPathUnloaded: fastPath, loadedOnDemand: lazySnapshot.lifecycle.policyLoaded === true && lazySnapshot.lifecycle.skillsLoaded === false && lazySnapshot.lifecycle.admissionLoaded === false },
      privacy: { hiddenReasoningStored: false, rawPromptsStored: false, rawArtifactsStoredInSnapshot: artifactSnapshot.claims.rawArtifactBytesStoredInSnapshot },
      composition: { appStaticImports: (app.match(/^import\s.+$/gm) ?? []).length, appConstructors: (app.match(/\bnew\s+[A-Z][A-Za-z0-9_$]*/g) ?? []).length },
      boundaries: { productionMemoryPolicyChanged: false, automaticSkillPromotionExecuted: false, directOsBudgetEnforcementCertified: false, longTermSkillSurvivalCertified: false, productionNeuralEmbeddingUnloadCertified: false, crossRepositorySkillGeneralizationCertified: false, comparativeSuperiorityClaimed: false },
    };
    return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  } finally {
    try { store?.close(); } catch {}
    await rm(temp, { recursive: true, force: true });
  }
}

async function main() {
  const root = path.resolve(process.argv[2] ?? '.');
  const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const releaseVersion = String(process.argv[4] ?? metadata.version);
  const output = path.resolve(root, process.argv[3] ?? `docs/memory-skill-resource-os-measurement-${releaseVersion}.json`);
  const report = await measureMemorySkillResourceOs({ rootDirectory: root, version: releaseVersion });
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ version: releaseVersion, output: path.relative(root, output).replaceAll('\\', '/'), receiptSha256: report.receiptSha256 })}\n`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
