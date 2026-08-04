import { signed, text, uniqueStrings } from './learning-utils.mjs';
import { TaskFeatureEncoder } from './task-feature-encoder.mjs';
import { HeldOutPolicyEvaluator } from './held-out-policy-evaluator.mjs';
import { CohortCanaryGovernor } from './cohort-canary-governor.mjs';
import { StrategyPolicyLearner } from './strategy-policy-learner.mjs';
import { DomainTrustLedger } from './domain-trust-ledger.mjs';
import { ModelSwitchCoordinator } from './model-switch-coordinator.mjs';
import { TrajectoryConfidenceCalibrator } from '../verification/trajectory-confidence-calibrator.mjs';
import { TeacherChallengeLab } from '../development/teacher-challenge-lab.mjs';

export class AdaptiveLearningControlPlane {
  constructor(options = {}) {
    this.options = options;
    this.closed = false;
    this._features = null;
    this._heldOut = null;
    this._canary = null;
    this._strategy = null;
    this._trust = null;
    this._switching = null;
    this._trajectory = null;
    this._teacher = null;
  }
  #open() { if (this.closed) throw new Error('Adaptive Learning Control Plane is closed'); }
  get features() { this.#open(); return this._features ??= new TaskFeatureEncoder(this.options.features ?? { capabilityMatrixRevision: this.options.capabilityMatrixRevision }); }
  get heldOut() { this.#open(); return this._heldOut ??= new HeldOutPolicyEvaluator(this.options.heldOut ?? {}); }
  get canary() { this.#open(); return this._canary ??= new CohortCanaryGovernor(this.options.canary ?? { cohorts: this.options.cohorts }); }
  get strategy() { this.#open(); return this._strategy ??= new StrategyPolicyLearner(this.options.strategy ?? {}); }
  get trust() { this.#open(); return this._trust ??= new DomainTrustLedger(this.options.trust ?? {}); }
  get switching() { this.#open(); return this._switching ??= new ModelSwitchCoordinator({ capsuleStore: this.options.capsuleStore }); }
  get trajectory() { this.#open(); return this._trajectory ??= new TrajectoryConfidenceCalibrator(this.options.trajectory ?? {}); }
  get teacher() { this.#open(); return this._teacher ??= new TeacherChallengeLab(this.options.teacher ?? { challengeRevisionSha256: this.options.challengeRevisionSha256 }); }

  encodeTask(input) { return this.features.encode(input); }
  evaluateHeldOut(input) { return this.heldOut.evaluate(input); }
  assignCanary(input) { return this.canary.assign(input); }
  recordCanary(input) { return this.canary.record(input); }
  evaluateCanary(cohort) { return this.canary.evaluate(cohort); }
  recordStrategy(input) { return this.strategy.recordOutcome(input); }
  recommendStrategy(input) { return this.strategy.recommend(input); }
  recordPatchSurvival(input) { return this.strategy.recordPatchSurvival(input); }
  recordTrust(input) { return this.trust.record(input); }
  projectTrust(input) { return this.trust.project(input); }
  switchModel(input) { return this.switching.switchSession(input); }
  createTeacherPair(input) { return this.teacher.createPair(input); }
  createTeacherChallenges(input) { return this.teacher.createChallengeSet(input); }

  assessTrajectory(input = {}) {
    this.#open();
    if (!Array.isArray(input.turns) || input.turns.length === 0) throw new TypeError('turns must be a non-empty array');
    const turns = input.turns.map((turn, index) => Object.freeze({
      turnId: text(turn?.turnId, `turns[${index}].turnId`, 128),
      toolType: text(turn?.toolType, `turns[${index}].toolType`, 128).toLowerCase(),
      confidence: turn?.confidence,
      critical: turn?.critical !== false,
      evidenceReceiptSha256: turn?.evidenceReceiptSha256,
    }));
    const trajectory = this.trajectory.assess({
      domain: input.domain,
      taskType: input.taskType,
      stages: turns.map((turn) => ({ kind: `${turn.turnId}:${turn.toolType}`, confidence: turn.confidence, critical: turn.critical, evidenceReceiptSha256: turn.evidenceReceiptSha256 })),
      independentReceipts: input.independentReceipts ?? [],
    });
    return signed({
      schema: 'forge.multi-turn-tool-trajectory-assessment.v1',
      domain: text(input.domain ?? 'general', 'domain', 128), taskType: text(input.taskType ?? 'general', 'taskType', 128),
      turnCount: turns.length, toolTypes: uniqueStrings(turns.map((turn) => turn.toolType), 'toolTypes', 256), turns, trajectory,
      claims: Object.freeze({ multiTurnCalibrated: true, toolTypeConditioned: true, simpleAverageUsed: false }),
    });
  }

  recordTrajectoryOutcome(input = {}) {
    return this.trajectory.recordOutcome({
      domain: input.domain,
      taskType: `${text(input.taskType ?? 'general', 'taskType', 128)}/${text(input.toolType, 'toolType', 128).toLowerCase()}`,
      confidence: input.confidence,
      success: input.success,
      verificationReceiptSha256: input.verificationReceiptSha256,
    });
  }

  snapshot() {
    return signed({
      schema: 'forge.adaptive-learning-control-plane-snapshot.v1', lifecycle: {
        closed: this.closed, featuresLoaded: this._features !== null, heldOutLoaded: this._heldOut !== null,
        canaryLoaded: this._canary !== null, strategyLoaded: this._strategy !== null, trustLoaded: this._trust !== null,
        switchingLoaded: this._switching !== null, trajectoryLoaded: this._trajectory !== null, teacherLoaded: this._teacher !== null,
      },
      canary: this._canary?.snapshot() ?? null, strategy: this._strategy?.snapshot() ?? null,
      trust: this._trust?.snapshot() ?? null, trajectory: this._trajectory?.snapshot() ?? null,
      claims: Object.freeze({ productionRoutingAuthority: false, rawPromptsStored: false, chainOfThoughtStored: false, hiddenAnswersStoredInSnapshot: false }),
    });
  }
  close() { this.closed = true; return this.snapshot(); }
}
