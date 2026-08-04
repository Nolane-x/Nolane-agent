import { signed } from '../world-model/world-model-utils.mjs';
import { WorldModelRegistry } from '../world-model/world-model-registry.mjs';
import { ForesightController } from '../world-model/foresight-controller.mjs';
import { CounterfactualSimulator } from '../world-model/counterfactual-simulator.mjs';
import { VerifiedSelfModel } from '../development/verified-self-model.mjs';
import { DevelopmentalGoalEngine } from '../development/developmental-goal-engine.mjs';
import { DevelopmentalStageController } from '../development/developmental-stage-controller.mjs';
import { CounterfactualChangeRuntime } from '../world-model/counterfactual-change-runtime.mjs';
import { AdaptiveLearningControlPlane } from '../learning/adaptive-learning-control-plane.mjs';

export class WorldDevelopmentPlane {
  constructor({ registry = {}, foresight = {}, simulator = {}, selfModel = {}, goals = {}, stages = {}, counterfactualChange = {}, adaptiveLearning = {} } = {}) {
    this.options = { registry, foresight, simulator, selfModel, goals, stages, counterfactualChange, adaptiveLearning }; this.closed = false;
    this._registry = null; this._foresight = null; this._simulator = null; this._selfModel = null; this._goals = null; this._stages = null; this._counterfactualChange = null; this._adaptiveLearning = null;
  }
  #open() { if (this.closed) throw new Error('World Development Plane is closed'); }
  get registry() { this.#open(); return this._registry ??= new WorldModelRegistry(this.options.registry); }
  get foresight() { this.#open(); return this._foresight ??= new ForesightController(this.options.foresight); }
  get simulator() { this.#open(); return this._simulator ??= new CounterfactualSimulator(this.options.simulator); }
  get selfModel() { this.#open(); return this._selfModel ??= new VerifiedSelfModel(this.options.selfModel); }
  get goals() { this.#open(); return this._goals ??= new DevelopmentalGoalEngine(this.options.goals); }
  get stages() { this.#open(); return this._stages ??= new DevelopmentalStageController(this.options.stages); }
  get counterfactualChange() { this.#open(); return this._counterfactualChange ??= new CounterfactualChangeRuntime(this.options.counterfactualChange); }
  get adaptiveLearning() { this.#open(); return this._adaptiveLearning ??= new AdaptiveLearningControlPlane(this.options.adaptiveLearning); }
  registerModel(input) { return this.registry.register(input); }
  selectModel(input) { return this.registry.select(input); }
  recordModelOutcome(id, input) { return this.registry.recordOutcome(id, input); }
  decideForesight(input) { return this.foresight.decide(input); }
  simulateCounterfactual(input) { return this.simulator.simulate(input); }
  imagineChange(input) { return this.counterfactualChange.imagine(input); }
  verifyImaginedChange(receipt, input) { return this.counterfactualChange.verify(receipt, input); }
  executeVerifiedChange(receipt, input) { return this.counterfactualChange.execute(receipt, input); }
  recordCounterfactualOutcome(receipt, input) { return this.counterfactualChange.recordOutcome(receipt, input); }
  validateCounterfactual(receipt, input) { return this.simulator.validate(receipt, input); }
  recordSelfOutcome(input) { return this.selfModel.recordOutcome(input); }
  updateToolTrust(input) { return this.selfModel.updateToolTrust(input); }
  assignResponsibility(input) { return this.selfModel.assignResponsibility(input); }
  proposeDevelopmentalGoal(input) { return this.goals.propose(input); }
  recordDevelopmentalOutcome(input) { return this.goals.recordOutcome(input); }
  evaluateStageAdvance(input) { return this.stages.evaluateAdvance(input); }
  evaluateDevelopmentPolicy(input) { return this.stages.evaluatePolicyUpdate(input); }
  assessLearningTrajectory(input) { return this.adaptiveLearning.assessTrajectory(input); }
  recordLearningTrajectoryOutcome(input) { return this.adaptiveLearning.recordTrajectoryOutcome(input); }
  createTeacherPair(input) { return this.adaptiveLearning.createTeacherPair(input); }
  createTeacherChallenges(input) { return this.adaptiveLearning.createTeacherChallenges(input); }
  projectDomainTrust(input) { return this.adaptiveLearning.projectTrust(input); }
  snapshot() { return signed({ schema: 'forge.world-development-plane-snapshot.v1', lifecycle: { closed: this.closed, registryLoaded: this._registry !== null, foresightLoaded: this._foresight !== null, simulatorLoaded: this._simulator !== null, selfModelLoaded: this._selfModel !== null, goalsLoaded: this._goals !== null, stagesLoaded: this._stages !== null, counterfactualChangeLoaded: this._counterfactualChange !== null, adaptiveLearningLoaded: this._adaptiveLearning !== null }, registry: this._registry?.snapshot() ?? null, simulator: this._simulator?.snapshot() ?? null, selfModel: this._selfModel?.snapshot() ?? null, goals: this._goals?.snapshot() ?? null, stages: this._stages?.snapshot() ?? null, adaptiveLearning: this._adaptiveLearning?.snapshot() ?? null, claims: { rawPayloadStored: false, rawPromptStored: false, chainOfThoughtStored: false, fileCommitAllowed: false, durableMemoryWriteAllowed: false, productionPolicyPromotionAllowed: false, autonomousGoalExecutionAllowed: false } }); }
  close() { if (this._registry) this._registry.close(); if (this._adaptiveLearning) this._adaptiveLearning.close(); this.closed = true; return this.snapshot(); }
}
