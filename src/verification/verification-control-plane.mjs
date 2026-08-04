import { VerificationPyramidPlanner } from './verification-pyramid-planner.mjs';
import { TestIntegrityGuard } from './test-integrity-guard.mjs';
import { ApiExistenceGate } from './api-existence-gate.mjs';
import { AdversarialReviewCoordinator } from './adversarial-review-coordinator.mjs';
import { FailureInjectionLab } from './failure-injection-lab.mjs';
import { TrajectoryConfidenceCalibrator } from './trajectory-confidence-calibrator.mjs';
import { SemanticCompletionGate } from './semantic-completion-gate.mjs';
import { VerifiedOutcomeBandit } from '../providers/verified-outcome-bandit.mjs';
import { signed } from '../construction/construction-utils.mjs';
import { IndependentVerificationRuntime } from './independent-verification-runtime.mjs';

export class VerificationControlPlane {
  constructor({ reviewService = null, bandit = {}, minimumConfidence = 0.6, clock = Date.now, hiddenVaultRoot = null, hiddenVaultKey = null } = {}) {
    this.reviewService = reviewService;
    this.banditOptions = bandit;
    this.minimumConfidence = minimumConfidence;
    this.clock = clock;
    this.closed = false;
    this.hiddenVaultRoot = hiddenVaultRoot;
    this.hiddenVaultKey = hiddenVaultKey;
    this._planner = null;
    this._testIntegrity = null;
    this._api = null;
    this._review = null;
    this._failure = null;
    this._calibrator = null;
    this._bandit = null;
    this._completion = null;
    this._independent = null;
  }
  #open() { if (this.closed) throw new Error('Verification Control Plane is closed'); }
  get planner() { this.#open(); return this._planner ??= new VerificationPyramidPlanner(); }
  get testIntegrity() { this.#open(); return this._testIntegrity ??= new TestIntegrityGuard(); }
  get api() { this.#open(); return this._api ??= new ApiExistenceGate(); }
  get review() { this.#open(); if (!this.reviewService) throw new Error('Independent review service is not configured'); return this._review ??= new AdversarialReviewCoordinator({ reviewService: this.reviewService }); }
  get failure() { this.#open(); return this._failure ??= new FailureInjectionLab({ clock: this.clock }); }
  get calibrator() { this.#open(); return this._calibrator ??= new TrajectoryConfidenceCalibrator(); }
  get bandit() { this.#open(); return this._bandit ??= new VerifiedOutcomeBandit({ ...this.banditOptions, clock: this.clock }); }
  get completion() { this.#open(); return this._completion ??= new SemanticCompletionGate({ minimumConfidence: this.minimumConfidence }); }
  get independent() { this.#open(); if (!this.hiddenVaultRoot || !this.hiddenVaultKey) throw new Error('Hidden regression vault is not configured'); return this._independent ??= new IndependentVerificationRuntime({ vaultRoot: this.hiddenVaultRoot, vaultKey: this.hiddenVaultKey }); }

  planVerification(input) { return this.planner.plan(input); }
  assessTestIntegrity(input) { return this.testIntegrity.assess(input); }
  verifyApiExistence(input) { return this.api.verify(input); }
  runAdversarialReview(input) { return this.review.review(input); }
  runFailureInjection(input) { return this.failure.run(input); }
  calibrateTrajectory(input) { return this.calibrator.assess(input); }
  recordCalibrationOutcome(input) { return this.calibrator.recordOutcome(input); }
  recordBanditOutcome(input) { return this.bandit.recordOutcome(input); }
  rankBandit(input) { return this.bandit.rank(input); }
  decideSemanticCompletion(input) { return this.completion.decide(input); }
  runTemporaryMutationProbe(input) { return this.independent.runMutationProbe(input); }
  requireIndependentRuntimeReview(input) { return this.independent.requireIndependentReview(input); }
  verifyRuntimeJourney(input) { return this.independent.verifyJourney(input); }
  registerHiddenRegressionCase(input) { return this.independent.registerHiddenCase(input); }
  evaluateHiddenRegressionCase(caseId, executor) { return this.independent.evaluateHiddenCase(caseId, executor); }

  snapshot() {
    return signed({
      schema: 'forge.verification-control-plane-snapshot.v1',
      lifecycle: { closed: this.closed, plannerLoaded: this._planner !== null, testIntegrityLoaded: this._testIntegrity !== null, apiGateLoaded: this._api !== null, reviewLoaded: this._review !== null, failureLabLoaded: this._failure !== null, calibratorLoaded: this._calibrator !== null, banditLoaded: this._bandit !== null, completionGateLoaded: this._completion !== null, independentRuntimeLoaded: this._independent !== null },
      calibration: this._calibrator ? this._calibrator.snapshot() : null,
      bandit: this._bandit ? this._bandit.snapshot() : null,
      claims: { privateReasoningStored: false, rawPromptsStored: false, rawModelOutputsStored: false, productionRoutingChanged: false },
    });
  }
  close() { this.closed = true; return this.snapshot(); }
}
