import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { VerifiedOutcomeLedger } from '../decision/verified-outcome-ledger.mjs';
import { detectRewardHacking, evaluateCandidate, rankCandidates } from '../decision/correctness-first-objective.mjs';
import { ConfidenceCalibrationService } from '../cognition/confidence-calibration-service.mjs';
import { DecisionStateMachine } from '../cognition/decision-state-machine.mjs';
import { SemanticProgressDetector } from '../cognition/semantic-progress-detector.mjs';
import { ResourceAttributionLedger } from './resource-attribution-ledger.mjs';
import { DiskBackedRawLog } from './disk-backed-raw-log.mjs';
import { ProcessLeakReaper } from './process-leak-reaper.mjs';
import { createPlatformResourceDriver } from '../sandbox/platform-resource-driver.mjs';

function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; for (const child of Object.values(value)) freeze(child); return Object.freeze(value); }
function signed(base) { return freeze({ ...base, receiptSha256: canonicalSha256(base) }); }

export class VerifiedMissionRuntime {
  constructor({ clock = () => Date.now(), logRootDir = join(tmpdir(), 'forge-studio-verified-mission-logs'), processDriver = null, limits = {} } = {}) {
    this.clock = typeof clock === 'function' ? clock : () => Date.now();
    this.outcomes = new VerifiedOutcomeLedger({ clock: this.clock, maxMissions: limits.maxMissions, maxVerifications: limits.maxVerifications, maxCosts: limits.maxCosts });
    this.confidence = new ConfidenceCalibrationService({ maxBuckets: limits.maxConfidenceBuckets, maxOutcomes: limits.maxConfidenceOutcomes });
    this.decisionStates = new DecisionStateMachine({ clock: this.clock, maxDecisions: limits.maxDecisionStates, maxHistory: limits.maxDecisionHistory });
    this.progress = new SemanticProgressDetector({ clock: this.clock, maxScopes: limits.maxProgressScopes, maxObservationsPerScope: limits.maxProgressObservations, noProgressWindow: limits.noProgressWindow });
    this.resources = new ResourceAttributionLedger({ maxResources: limits.maxAttributedResources, maxSamplesPerResource: limits.maxResourceSamples });
    this.logs = new DiskBackedRawLog({ rootDir: logRootDir, maxRecordBytes: limits.maxLogRecordBytes, maxReadBytes: limits.maxLogReadBytes, maxRecordsPerRead: limits.maxLogRecordsPerRead, maxStreams: limits.maxLogStreams });
    this.processDriver = processDriver ?? createPlatformResourceDriver();
    this.reaper = new ProcessLeakReaper({ driver: this.processDriver, maxGraceMs: limits.maxProcessGraceMs });
    this.progressScopes = new Set();
    this.decisionIds = new Set();
    this.closed = false;
  }

  registerMission(input) { this.#open(); return this.outcomes.registerMission(input); }
  registerMilestone(input) { this.#open(); return this.outcomes.registerMilestone(input); }
  registerTask(input) { this.#open(); return this.outcomes.registerTask(input); }
  registerDecision(input) { this.#open(); const result = this.outcomes.registerDecision(input); this.decisionIds.add(result.decisionId); return result; }
  recordContextSelection(input) { this.#open(); return this.outcomes.recordContextSelection(input); }
  recordVerification(input) { this.#open(); return this.outcomes.recordVerification(input); }
  recordCost(input) { this.#open(); return this.outcomes.recordCost(input); }
  score(scope) { return this.outcomes.score(scope); }
  contextUtility(scope) { return this.outcomes.contextUtility(scope); }
  cost(scope) { return this.outcomes.cost(scope); }

  detectRewardHacking(candidate, baseline) { this.#open(); return detectRewardHacking(candidate, baseline); }
  evaluateCandidate(candidate, options) { this.#open(); return evaluateCandidate(candidate, options); }
  rankCandidates(candidates, options) { this.#open(); return rankCandidates(candidates, options); }

  recordConfidenceOutcome(input) { this.#open(); return this.confidence.recordOutcome(input); }
  calibrateConfidence(input) { this.#open(); return this.confidence.calibrate(input); }
  finalConfidence(input) { this.#open(); return this.confidence.finalConfidence(input); }

  createDecisionState(input) { this.#open(); this.decisionIds.add(String(input?.decisionId ?? '').trim()); return this.decisionStates.create(input); }
  transitionDecision(decisionId, input) { this.#open(); return this.decisionStates.transition(decisionId, input); }
  decisionStateSnapshot(decisionId) { return this.decisionStates.snapshot(decisionId); }

  observeProgress(input) { this.#open(); const result = this.progress.observe(input); this.progressScopes.add(String(input?.scope ?? '').trim()); return result; }
  evaluateProgress(scope) { return this.progress.evaluate(scope); }
  progressSnapshot(scope) { return this.progress.snapshot(scope); }

  registerResource(input) { this.#open(); return this.resources.registerResource(input); }
  sampleResource(input) { this.#open(); return this.resources.sample(input); }
  finalizeResource(input) { this.#open(); return this.resources.finalize(input); }
  resourceSnapshot(scope = {}) { return this.resources.snapshot(scope); }

  appendLog(streamId, record) { this.#open(); return this.logs.append(streamId, record); }
  readLog(streamId, options) { return this.logs.read(streamId, options); }
  logSnapshot(streamId = null) { return this.logs.snapshot(streamId); }

  async reapMission(input) { this.#open(); return this.reaper.reapMission(input); }

  snapshot() {
    const progress = [...this.progressScopes].filter(Boolean).sort().map((scope) => this.progress.evaluate(scope));
    const decisionStates = [...this.decisionIds].filter(Boolean).sort().map((decisionId) => {
      try { return this.decisionStates.snapshot(decisionId); } catch { return null; }
    }).filter(Boolean);
    return signed({
      schema: 'forge.verified-mission-runtime.v1', closed: this.closed,
      outcomes: this.outcomes.snapshot(), confidence: this.confidence.snapshot(), decisionStates,
      progress, resources: this.resources.snapshot(), logs: this.logs.snapshot(),
      claims: { verifiedOutcomesOnlyCreateValue: true, rawLogsStoredInMemory: false, unregisteredProcessesKilled: false, superiorityClaimed: false },
    });
  }

  close() {
    if (this.closed) return this.snapshot();
    this.outcomes.close();
    this.logs.close();
    this.closed = true;
    return this.snapshot();
  }

  #open() { if (this.closed) throw new Error('Verified Mission Runtime is closed'); }
}
