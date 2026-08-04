export { RuntimeLeasePool } from './runtime-lease-pool.mjs';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { createPlatformResourceDriver } from '../sandbox/platform-resource-driver.mjs';
import { MissionProcessLedger } from './mission-process-ledger.mjs';
import { ProviderSessionHost } from '../providers/provider-session-host.mjs';
import { IncrementalIntelligenceJournal } from '../repository/incremental-intelligence-journal.mjs';
import { BrowserJourneyRecorder } from '../browser/browser-journey-recorder.mjs';
import { HostedLifecycleCoordinator } from '../orchestration/hosted-lifecycle-coordinator.mjs';
import { DecisionPlane } from '../decision/decision-plane.mjs';

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const item of Object.values(value)) freeze(item);
  return Object.freeze(value);
}
function receipt(base) { return freeze({ ...base, receiptSha256: canonicalSha256(base) }); }

export class MissionResourceFabric {
  constructor({ governor, processDriver = null, canary, projectRootResolver, hostedAdapter = null, memorySkillResource = {}, verifiedMission = {}, superiority = {}, clock = () => Date.now(), eventSink = () => {}, limits = {} } = {}) {
    if (!governor?.snapshot) throw new TypeError('governor with snapshot() is required');
    if (!canary?.snapshot) throw new TypeError('canary with snapshot() is required');
    if (typeof projectRootResolver !== 'function') throw new TypeError('projectRootResolver is required');
    const sink = typeof eventSink === 'function' ? eventSink : () => {};
    this.governor = governor;
    this.canary = canary;
    this.clock = clock;
    this.closed = false;
    this.lastGovernorState = String(governor.snapshot()?.state ?? 'normal');
    this.processDriver = processDriver ?? createPlatformResourceDriver();
    this.processLedger = new MissionProcessLedger({ driver: this.processDriver, clock, maxEntries: limits.maxProcessEntries ?? 2_000, eventSink: sink });
    this.sessionHost = new ProviderSessionHost({ governor, processLedger: this.processLedger, clock, idleTtlMs: limits.sessionIdleTtlMs ?? 120_000, maxUses: limits.maxSessionUses ?? 32, maxSessions: limits.maxSessions ?? 8, eventSink: sink });
    this.journal = new IncrementalIntelligenceJournal({ clock, maxEntries: limits.maxIntelligenceChanges ?? 20_000, eventSink: sink });
    this.journeys = new BrowserJourneyRecorder({ projectRootResolver, clock, maxEntries: limits.maxJourneys ?? 500, eventSink: sink });
    this.hostedLifecycle = new HostedLifecycleCoordinator({ adapter: hostedAdapter, maxRepairAttempts: limits.maxHostedRepairs ?? 2, clock, eventSink: sink });
    this.decision = new DecisionPlane({ clock, superiority, verifiedMission: { ...verifiedMission, processDriver: verifiedMission.processDriver ?? this.processDriver }, memorySkillResource: { ...memorySkillResource, resources: { ...(memorySkillResource.resources ?? {}), processLedger: this.processLedger, processDriver: this.processDriver } }, limits: { maxDecisionEfficiencyEntries: limits.maxDecisionEfficiencyEntries ?? 2_000, maxDecisionReceipts: limits.maxDecisionReceipts ?? 200 } });
    this.decisionEfficiency = this.decision.efficiency;
  }

  publicView() {
    const base = {
      schema: 'forge.mission-resource-fabric.v1', closed: this.closed, governorState: this.lastGovernorState,
      resources: this.processLedger.snapshot(), sessions: this.sessionHost.snapshot(), intelligence: this.journal.snapshot(),
      canary: this.canary.snapshot(), journeys: this.journeys.snapshot(), hosted: this.hostedLifecycle.snapshot(), decision: this.decision.snapshot(), verifiedMission: this.decision.verifiedMissionSnapshot(), memorySkillResource: this.decision.memorySkillResourceSnapshot(), decisionEfficiency: this.decision.efficiency.snapshot(), superiority: this.decision.superioritySnapshot(),
      claims: freeze({ processAttribution: true, logicalSessionReuseOnlyWhenSupported: true, rawPromptsStored: false, automaticHostedMerge: false, visualCorrectnessInferred: false, comparativeSuperiorityClaimAllowed: false }),
    };
    return receipt(base);
  }

  registerVerifiedMission(input) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.registerVerifiedMission(input); }
  registerVerifiedMilestone(input) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.registerVerifiedMilestone(input); }
  registerVerifiedTask(input) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.registerVerifiedTask(input); }
  registerVerifiedDecision(input) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.registerVerifiedDecision(input); }
  recordVerifiedMissionOutcome(input) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.recordVerifiedMissionOutcome(input); }
  appendVerifiedMissionLog(streamId, record) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.appendVerifiedMissionLog(streamId, record); }
  observeVerifiedMissionProgress(input) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.observeVerifiedMissionProgress(input); }
  reapVerifiedMission(input) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.reapVerifiedMission(input); }
  compileProofMission(input) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.compileProofMission(input); }
  recordProofEvidence(planId, input) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.recordProofEvidence(planId, input); }
  evaluateProofMission(planId) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.evaluateProofMission(planId); }

  registerMissionConstitution(input) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.registerMissionConstitution(input); }
  evaluateConstitutionAction(constitutionId, input) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.evaluateConstitutionAction(constitutionId, input); }
  amendMissionConstitution(constitutionId, input) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.amendMissionConstitution(constitutionId, input); }
  openCounterfactualPlan(input) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.openCounterfactualPlan(input); }
  registerCounterfactualCandidate(planningId, input) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.registerCounterfactualCandidate(planningId, input); }
  decideCounterfactualPlan(planningId) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.decideCounterfactualPlan(planningId); }
  proposeVerifiedMemory(input) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.proposeVerifiedMemory(input); }
  recordVerifiedMemoryOutcome(memoryId, input) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.recordVerifiedMemoryOutcome(memoryId, input); }
  evaluateVerifiedMemory(memoryId) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.evaluateVerifiedMemory(memoryId); }
  promoteVerifiedMemory(memoryId, input) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.promoteVerifiedMemory(memoryId, input); }
  invalidateVerifiedMemory(memoryId, input) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.invalidateVerifiedMemory(memoryId, input); }
  tombstoneVerifiedMemory(memoryId, input) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.tombstoneVerifiedMemory(memoryId, input); }
  registerSelfHealingComponent(input) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.registerSelfHealingComponent(input); }
  observeSelfHealingAnomaly(input) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.observeSelfHealingAnomaly(input); }
  planSelfHealingRepair(componentId, input) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.planSelfHealingRepair(componentId, input); }
  executeSelfHealingRepair(planId, input) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.executeSelfHealingRepair(planId, input); }
  scheduleProofBudget(input) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.scheduleProofBudget(input); }
  createComparativeStudy(input) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.createComparativeStudy(input); }
  ingestComparativeRun(studyId, input) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.ingestComparativeRun(studyId, input); }
  evaluateComparativeStudy(studyId) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.evaluateComparativeStudy(studyId); }
  certifyLocalUi(input) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.certifyLocalUi(input); }
  createDogfoodSuite(input) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.createDogfoodSuite(input); }
  verifyDogfoodReceipt(suiteId, input) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.verifyDogfoodReceipt(suiteId, input); }
  evaluateDogfoodSuite(suiteId) { if (this.closed) throw new Error('Mission resource fabric is closed'); return this.decision.evaluateDogfoodSuite(suiteId); }

  recordDecisionEfficiency(input = {}) {
    if (this.closed) throw new Error('Mission resource fabric is closed');
    return this.decision.recordEfficiency(input);
  }

  async onGovernorSnapshot(snapshot = {}) {
    if (this.closed) throw new Error('Mission resource fabric is closed');
    this.lastGovernorState = String(snapshot?.state ?? this.governor.snapshot()?.state ?? 'normal');
    const sessionPolicy = await this.sessionHost.applyGovernorState();
    const base = { schema: 'forge.mission-resource-fabric-governor-application.v1', state: this.lastGovernorState, sessionPolicyReceiptSha256: sessionPolicy.receiptSha256, appliedAtMs: this.clock() };
    return receipt(base);
  }

  async close() {
    if (this.closed) return this.publicView();
    await this.sessionHost.close();
    this.processLedger.close();
    this.decision.close();
    this.closed = true;
    return this.publicView();
  }
}

export function createMissionResourceFabric(options = {}) {
  return new MissionResourceFabric(options);
}
