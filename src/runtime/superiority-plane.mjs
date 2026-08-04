import { ProofMissionCompiler } from '../superiority/proof-mission-compiler.mjs';
import { CausalRepositoryTwin } from '../superiority/causal-repository-twin.mjs';
import { AdversarialSolutionTournament } from '../superiority/adversarial-solution-tournament.mjs';
import { AdaptiveModelGovernor } from '../superiority/adaptive-model-governor.mjs';
import { signed } from '../superiority/superiority-utils.mjs';
import { MissionConstitutionEngine } from '../superiority/deep/mission-constitution-engine.mjs';
import { CounterfactualExecutionPlanner } from '../superiority/deep/counterfactual-execution-planner.mjs';
import { VerificationMemoryCurator } from '../superiority/deep/verification-memory-curator.mjs';
import { SelfHealingRuntime } from '../superiority/deep/self-healing-runtime.mjs';
import { ProofBudgetScheduler } from '../superiority/deep/proof-budget-scheduler.mjs';
import { ComparativeBenchmarkLab } from '../superiority/deep/comparative-benchmark-lab.mjs';
import { LocalUICertificationLab } from '../superiority/deep/local-ui-certification-lab.mjs';
import { ProviderDogfoodReplayLab } from '../superiority/deep/provider-dogfood-replay-lab.mjs';

export class SuperiorityPlane {
  constructor({ clock = () => Date.now(), proofCompiler = {}, causalTwin = {}, tournament = {}, modelGovernor = {}, constitution = {}, counterfactual = {}, verificationMemory = {}, selfHealing = {}, proofBudget = {}, comparativeBenchmark = {}, localUiCertification = {}, dogfood = {} } = {}) {
    this.clock = typeof clock === 'function' ? clock : () => Date.now();
    this.closed = false;
    this.proof = new ProofMissionCompiler({ ...proofCompiler, clock: proofCompiler.clock ?? this.clock });
    this.twin = new CausalRepositoryTwin({ ...causalTwin, clock: causalTwin.clock ?? this.clock });
    this.tournament = new AdversarialSolutionTournament({ ...tournament, clock: tournament.clock ?? this.clock });
    this.models = new AdaptiveModelGovernor({ ...modelGovernor, clock: modelGovernor.clock ?? this.clock });
    this.constitution = new MissionConstitutionEngine({ ...constitution, clock: constitution.clock ?? this.clock });
    this.counterfactual = new CounterfactualExecutionPlanner({ ...counterfactual, clock: counterfactual.clock ?? this.clock });
    this.verificationMemory = new VerificationMemoryCurator({ ...verificationMemory, clock: verificationMemory.clock ?? this.clock });
    this.selfHealing = new SelfHealingRuntime({ ...selfHealing, clock: selfHealing.clock ?? this.clock });
    this.proofBudget = new ProofBudgetScheduler(proofBudget);
    this.comparativeBenchmark = new ComparativeBenchmarkLab({ ...comparativeBenchmark, clock: comparativeBenchmark.clock ?? this.clock });
    this.localUiCertification = new LocalUICertificationLab(localUiCertification);
    this.dogfood = new ProviderDogfoodReplayLab({ ...dogfood, clock: dogfood.clock ?? this.clock });
  }

  compileProofMission(input) { this.#assertOpen(); return this.proof.compile(input); }
  recordProofEvidence(planId, input) { this.#assertOpen(); return this.proof.recordEvidence(planId, input); }
  evaluateProofMission(planId) { this.#assertOpen(); return this.proof.evaluate(planId); }

  registerCausalTwinNode(input) { this.#assertOpen(); return this.twin.registerNode(input); }
  linkCausalTwin(input) { this.#assertOpen(); return this.twin.link(input); }
  predictCausalImpact(input) { this.#assertOpen(); return this.twin.predictImpact(input); }
  recordCausalOutcome(input) { this.#assertOpen(); return this.twin.recordObservedOutcome(input); }
  invalidateCausalEvidence(sourceHash) { this.#assertOpen(); return this.twin.invalidateEvidence(sourceHash); }

  openAdversarialTournament(input) { this.#assertOpen(); return this.tournament.open(input); }
  registerTournamentCandidate(tournamentId, input) { this.#assertOpen(); return this.tournament.registerCandidate(tournamentId, input); }
  recordTournamentAttack(tournamentId, input) { this.#assertOpen(); return this.tournament.recordAttack(tournamentId, input); }
  recordTournamentVerification(tournamentId, input) { this.#assertOpen(); return this.tournament.recordVerification(tournamentId, input); }
  decideAdversarialTournament(tournamentId) { this.#assertOpen(); return this.tournament.decide(tournamentId); }

  registerGovernedModel(input) { this.#assertOpen(); return this.models.registerModel(input); }
  routeGovernedModel(input) { this.#assertOpen(); return this.models.route(input); }
  recordGovernedModelOutcome(input) { this.#assertOpen(); return this.models.recordOutcome(input); }
  authorizeGovernedModelPromotion(modelId, input) { this.#assertOpen(); return this.models.authorizePromotion(modelId, input); }

  registerMissionConstitution(input) { this.#assertOpen(); return this.constitution.register(input); }
  evaluateConstitutionAction(constitutionId, input) { this.#assertOpen(); return this.constitution.evaluate(constitutionId, input); }
  amendMissionConstitution(constitutionId, input) { this.#assertOpen(); return this.constitution.amend(constitutionId, input); }

  openCounterfactualPlan(input) { this.#assertOpen(); return this.counterfactual.open(input); }
  registerCounterfactualCandidate(planningId, input) { this.#assertOpen(); return this.counterfactual.registerCandidate(planningId, input); }
  decideCounterfactualPlan(planningId) { this.#assertOpen(); return this.counterfactual.decide(planningId); }

  proposeVerifiedMemory(input) { this.#assertOpen(); return this.verificationMemory.propose(input); }
  recordVerifiedMemoryOutcome(memoryId, input) { this.#assertOpen(); return this.verificationMemory.recordOutcome(memoryId, input); }
  evaluateVerifiedMemory(memoryId) { this.#assertOpen(); return this.verificationMemory.evaluate(memoryId); }
  promoteVerifiedMemory(memoryId, input) { this.#assertOpen(); return this.verificationMemory.promote(memoryId, input); }
  invalidateVerifiedMemory(memoryId, input) { this.#assertOpen(); return this.verificationMemory.invalidate(memoryId, input); }
  tombstoneVerifiedMemory(memoryId, input) { this.#assertOpen(); return this.verificationMemory.tombstone(memoryId, input); }

  registerSelfHealingComponent(input) { this.#assertOpen(); return this.selfHealing.registerComponent(input); }
  observeSelfHealingAnomaly(input) { this.#assertOpen(); return this.selfHealing.observe(input); }
  planSelfHealingRepair(componentId, input) { this.#assertOpen(); return this.selfHealing.planRepair(componentId, input); }
  executeSelfHealingRepair(planId, input) { this.#assertOpen(); return this.selfHealing.executeRepair(planId, input); }

  scheduleProofBudget(input) { this.#assertOpen(); return this.proofBudget.schedule(input); }
  createComparativeStudy(input) { this.#assertOpen(); return this.comparativeBenchmark.createStudy(input); }
  ingestComparativeRun(studyId, input) { this.#assertOpen(); return this.comparativeBenchmark.ingestRun(studyId, input); }
  evaluateComparativeStudy(studyId) { this.#assertOpen(); return this.comparativeBenchmark.evaluate(studyId); }
  certifyLocalUi(input) { this.#assertOpen(); return this.localUiCertification.certify(input); }
  createDogfoodSuite(input) { this.#assertOpen(); return this.dogfood.createSuite(input); }
  verifyDogfoodReceipt(suiteId, input) { this.#assertOpen(); return this.dogfood.verifyReceipt(suiteId, input); }
  evaluateDogfoodSuite(suiteId) { this.#assertOpen(); return this.dogfood.evaluate(suiteId); }

  snapshot() {
    return signed({
      schema: 'nolane.superiority.plane.v1',
      lifecycle: { closed: this.closed },
      proof: this.proof.snapshot(),
      repositoryTwin: this.twin.snapshot(),
      tournament: this.tournament.snapshot(),
      modelGovernor: this.models.snapshot(),
      missionConstitution: this.constitution.snapshot(),
      counterfactualPlanner: this.counterfactual.snapshot(),
      verificationMemory: this.verificationMemory.snapshot(),
      selfHealing: this.selfHealing.snapshot(),
      proofBudget: this.proofBudget.snapshot(),
      comparativeBenchmark: this.comparativeBenchmark.snapshot(),
      localUiCertification: this.localUiCertification.snapshot(),
      providerDogfood: this.dogfood.snapshot(),
      claims: {
        proofCarryingMissionControl: true,
        causalRepositoryTwin: true,
        adversarialCandidateSelection: true,
        smallestSufficientModelRouting: true,
        missionConstitutionControl: true,
        counterfactualExecutionPlanning: true,
        verificationMemoryCuration: true,
        selfHealingRuntime: true,
        proofBudgetScheduling: true,
        comparativeBenchmarkLab: true,
        localUiCertification: true,
        providerRealDogfoodProtocol: true,
        hiddenReasoningStored: false,
        rawPromptStored: false,
        rawModelOutputStored: false,
        automaticCommitAllowed: false,
        automaticDeploymentAllowed: false,
        automaticModelPromotionAllowed: false,
        comparativeSuperiorityClaimAllowed: false,
      },
    });
  }

  close() { this.closed = true; return this.snapshot(); }
  #assertOpen() { if (this.closed) throw new Error('Superiority Plane is closed'); }
}
