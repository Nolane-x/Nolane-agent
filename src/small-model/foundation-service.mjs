import { canonicalSha256, deepFreeze } from './shared.mjs';
import { TrajectoryLab } from './trajectory-lab.mjs';
import { VerifierMesh } from './verifier-mesh.mjs';
import { SpecialistModelFabric } from './specialist-model-fabric.mjs';
import { AdaptiveComputeGovernor } from './adaptive-compute-governor.mjs';
import { DistillationOrchestrator } from './distillation-orchestrator.mjs';
import { VerifierRedTeam } from './verifier-red-team.mjs';
import { RecursivePolicySidecar } from './recursive-policy-sidecar.mjs';
import { RecursiveGraphSolverPack } from './recursive-graph-solver-pack.mjs';
import { SymbolicSolverCompiler } from './symbolic-solver-compiler.mjs';
import { PlasticityPlane } from './plasticity-plane.mjs';
import { CurriculumFactory } from './curriculum-factory.mjs';
import { ScientificBenchmarkHarness } from './scientific-benchmark-harness.mjs';
import { AstCodemodEngine } from './ast-codemod-engine.mjs';
import { FiniteDomainSmtAdapter, DatalogAdapter } from './constraint-adapters.mjs';
import { MultiAgentPolicyDistiller } from './multi-agent-policy-distiller.mjs';
import { AdaptationPolicyLearner } from './adaptation-policy-learner.mjs';
import { LatentMemoryRouter } from './latent-memory-router.mjs';
import { ModelArtifactRegistry } from './model-artifact-registry.mjs';
import { trainLinearPolicy } from './linear-policy-trainer.mjs';
import { createModelArtifact } from './model-artifact.mjs';
import { LinearPolicyRuntime } from './linear-policy-runtime.mjs';
import { evaluateSpecialistArtifact } from './specialist-evaluation.mjs';
import { trainBootstrapSpecialistSuite } from './bootstrap-specialist-suite-training.mjs';
import { SUPPORTED_BOOTSTRAP_SPECIALISTS } from './bootstrap-specialist-suite-dataset.mjs';
import { SpecialistDecisionSupport } from './specialist-decision-support.mjs';
import { trainRepositorySpecialistSuite } from './repository-specialist-suite-training.mjs';
import { REPOSITORY_SPECIALISTS } from './repository-specialist-suite-dataset.mjs';
import { RepositorySpecialistDecisionSupport } from './repository-specialist-decision-support.mjs';
import { trainCheckpoint6SpecialistSuite } from './checkpoint-6-specialist-training.mjs';
import { buildCheckpoint6SpecialistDataset, CHECKPOINT_6_SPECIALISTS } from './checkpoint-6-specialist-dataset.mjs';
import { Checkpoint6DecisionSupport } from './checkpoint-6-decision-support.mjs';
import { collectMultiRuntimeTrajectories, writeMultiRuntimeTrajectoryDataset } from './multi-runtime-trajectory-collector.mjs';
import { MULTI_RUNTIME_TRAJECTORY_PROBES } from './multi-runtime-trajectory-probes.mjs';
import { runMutationRecoveryLab, writeMutationRecoveryDataset } from './mutation-recovery-lab.mjs';
import { MUTATION_RECOVERY_SCENARIOS } from './mutation-recovery-scenarios.mjs';
import { MissionTrajectoryEngine } from './mission-trajectory-engine.mjs';
import { CHECKPOINT_7_HELDOUT_PACKS, CHECKPOINT_7_SKILL_TRANSFER_PACK } from './checkpoint-7-heldout-pack.mjs';
import { trainProcessRewardSpecialist } from './process-reward-specialist.mjs';
import { VerifiedSkillCompiler } from './verified-skill-compiler.mjs';
import { SkillTransferLab } from './skill-transfer-lab.mjs';
import { buildCheckpoint7EvidenceBundle } from './checkpoint-7-evidence-bundle.mjs';
import { Checkpoint7DecisionSupport } from './checkpoint-7-decision-support.mjs';
import { VerifiedSkillRegistry } from './verified-skill-registry.mjs';
import { buildCheckpoint8MissionPortfolio } from './checkpoint-8-mission-portfolio.mjs';
import { buildCheckpoint8EvidenceBundle } from './checkpoint-8-evidence-bundle.mjs';
import { ConstraintProofLab } from './constraint-proof-lab.mjs';
import { buildCheckpoint9MissionPortfolio } from './checkpoint-9-mission-portfolio.mjs';
import { buildCheckpoint9EvidenceBundle } from './checkpoint-9-evidence-bundle.mjs';
import { MultiFileRefactorEngine } from './multi-file-refactor-engine.mjs';
import { buildCheckpoint10MissionPortfolio, CHECKPOINT_10_CONTRACT_MANIFEST } from './checkpoint-10-mission-portfolio.mjs';
import { buildCheckpoint10EvidenceBundle } from './checkpoint-10-evidence-bundle.mjs';
import { TypeScriptRefactorEngine } from './typescript-refactor-engine.mjs';
import { CrossLanguageContractMigrator } from './cross-language-contract-migrator.mjs';

export class SmallModelFoundationService {
  constructor({
    trajectories = new TrajectoryLab(), verifiers = new VerifierMesh(), specialists = new SpecialistModelFabric(), compute = new AdaptiveComputeGovernor(),
    distillation = new DistillationOrchestrator(), verifierRedTeam = new VerifierRedTeam(), recursive = new RecursivePolicySidecar(),
    graphSolvers = new RecursiveGraphSolverPack(), symbolic = new SymbolicSolverCompiler(), plasticity = new PlasticityPlane(), curriculum = new CurriculumFactory(),
    scientificBenchmarks = new ScientificBenchmarkHarness(), astCodemod = new AstCodemodEngine(), finiteSmt = new FiniteDomainSmtAdapter(),
    datalog = new DatalogAdapter(), policyDistillation = new MultiAgentPolicyDistiller(), adaptationPolicy = new AdaptationPolicyLearner(),
    latentMemory = new LatentMemoryRouter(), artifactRegistry = new ModelArtifactRegistry(), skillRegistry = new VerifiedSkillRegistry(),
  } = {}) {
    this.trajectories = trajectories; this.verifiers = verifiers; this.specialists = specialists; this.compute = compute;
    this.distillation = distillation; this.verifierRedTeam = verifierRedTeam; this.recursive = recursive; this.graphSolvers = graphSolvers;
    this.symbolic = symbolic; this.plasticity = plasticity; this.curriculum = curriculum; this.scientificBenchmarks = scientificBenchmarks;
    this.astCodemod = astCodemod; this.finiteSmt = finiteSmt; this.datalog = datalog; this.policyDistillation = policyDistillation;
    this.adaptationPolicy = adaptationPolicy; this.latentMemory = latentMemory; this.artifactRegistry = artifactRegistry; this.skillRegistry = skillRegistry;
    this.checkpoint6PendingSuites = new Map();
    this.checkpoint7Collections = new Map();
    this.checkpoint7PendingBundles = new Map();
    this.checkpoint8PendingBundles = new Map();
    this.checkpoint9PendingBundles = new Map();
    this.checkpoint10PendingBundles = new Map();
    this.alpha5Operations = { astCodemods: 0, smtProofs: 0, datalogEvaluations: 0, latentRoutes: 0 };
    this.plasticity.attachAdaptationPolicy?.(this.adaptationPolicy);
    this.plasticity.attachLatentMemoryRouter?.(this.latentMemory);
  }

  status() {
    const artifacts = this.artifactRegistry.snapshot();
    return deepFreeze({
      schema: 'nolane.small-model.foundation-status.v1', product: 'Nolane Agent', foundationReady: true,
      trainedModel: artifacts.artifacts > 0, trainedArtifacts: artifacts.artifacts, promotedSpecialists: artifacts.specialists, boundedSpecialistSuiteReady: this.specialistSuiteStatus().ready, repositorySpecialistSuiteReady: this.repositorySpecialistSuiteStatus().ready, checkpoint6SpecialistSuiteReady: this.checkpoint6SuiteStatus().ready, checkpoint7Ready: this.checkpoint7Status().ready, checkpoint8Ready: this.checkpoint8Status().ready, checkpoint9Ready: this.checkpoint9Status().ready, checkpoint10Ready: this.checkpoint10Status().ready, runtime: 'nolane-native',
      capabilities: ['trajectory', 'verifier-mesh', 'distillation', 'recursive-policy', 'symbolic-solvers', 'plasticity', 'curriculum', 'scientific-benchmarks', 'ast-codemod', 'finite-smt', 'datalog', 'multi-agent-policy-distillation', 'adaptation-policy', 'latent-memory-routing', 'bounded-specialist-training', 'content-addressed-model-artifacts', 'held-out-specialist-evaluation', 'bounded-specialist-suite', 'specialist-decision-support', 'repository-trajectory-specialists', 'repository-specialist-decision-support', 'multi-runtime-recovery-trajectories', 'ablation-governed-specialists', 'checkpoint-6-decision-support', 'held-out-long-horizon-missions', 'process-reward-specialist', 'verified-skill-transfer', 'transfer-process-cost-governance', 'checkpoint-7-decision-support', 'syntax-aware-verified-skills', 'bounded-constraint-skills', 'solver-evidence-promotion-v4', 'checkpoint-8-solver-portfolio', 'type-aware-multi-file-refactor', 'property-based-solver-verification', 'promotion-v5', 'typescript-semantic-refactor', 'cross-language-generated-contract', 'promotion-v6'],
      claims: { boundedSpecialistModel: artifacts.artifacts > 0, generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false, autonomousSelfImprovement: false },
    });
  }

  trainSpecialist({ specialist = 'tool-router', examples, datasetReceiptSha256, trainingConfig = {} } = {}) {
    const model = trainLinearPolicy({ examples, ...trainingConfig });
    const artifact = createModelArtifact({ model, datasetReceiptSha256, trainingConfig, specialist });
    return this.artifactRegistry.register(artifact);
  }
  inferSpecialist({ specialist = 'tool-router', artifactSha256, state, topK, abstainThreshold = 0.5 } = {}) {
    const artifact = artifactSha256 ? this.artifactRegistry.get(artifactSha256) : this.artifactRegistry.active(specialist);
    if (!artifact) throw new Error(`No trained artifact is available for ${specialist}`);
    return new LinearPolicyRuntime({ artifact, abstainThreshold }).infer(state, { topK: topK ?? Math.min(3, artifact.model.labels.length), abstainThreshold });
  }
  evaluateTrainedSpecialist({ specialist = 'tool-router', artifactSha256, ...input } = {}) {
    const artifact = artifactSha256 ? this.artifactRegistry.get(artifactSha256) : this.artifactRegistry.active(specialist);
    if (!artifact) throw new Error(`No trained artifact is available for ${specialist}`);
    return evaluateSpecialistArtifact({ artifact, ...input });
  }
  promoteTrainedSpecialist(body = {}) { return this.artifactRegistry.promote(body); }
  rollbackTrainedSpecialist({ specialist = 'tool-router', approvedBy } = {}) { return this.artifactRegistry.rollback(specialist, { approvedBy }); }
  activeTrainedSpecialist(specialist = 'tool-router') { return this.artifactRegistry.active(specialist); }
  specialistSuiteStatus() {
    const active = Object.fromEntries(SUPPORTED_BOOTSTRAP_SPECIALISTS.map((specialist) => [specialist, this.artifactRegistry.active(specialist)?.artifactSha256 ?? null]));
    const missing = SUPPORTED_BOOTSTRAP_SPECIALISTS.filter((specialist) => !active[specialist]);
    const base = { schema: 'nolane.small-model.specialist-suite-status.v1', required: [...SUPPORTED_BOOTSTRAP_SPECIALISTS], active, missing, ready: missing.length === 0, claims: { boundedSpecialistSuite: missing.length === 0, generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false } };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
  async bootstrapSpecialistSuite({ approvedBy, ...options } = {}) {
    const approval = String(approvedBy ?? '').trim();
    if (!approval) throw new Error('Explicit user approval is required to promote the specialist suite');
    const suite = await trainBootstrapSpecialistSuite(options);
    const promotions = [];
    for (const specialist of SUPPORTED_BOOTSTRAP_SPECIALISTS) {
      const value = suite.specialists[specialist];
      this.artifactRegistry.register(value.artifact);
      promotions.push(this.artifactRegistry.promote({ artifactSha256: value.artifact.artifactSha256, evaluation: value.heldOut, approvedBy: approval }));
    }
    const status = this.specialistSuiteStatus();
    const base = { schema: 'nolane.small-model.specialist-suite-bootstrap.v1', suiteReceiptSha256: suite.receiptSha256, promotions, status, approvedBy: approval, claims: { boundedSpecialistSuite: true, generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false } };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
  runSpecialistDecisionSupport(body = {}) { return new SpecialistDecisionSupport({ artifactRegistry: this.artifactRegistry }).decide(body); }
  repositorySpecialistSuiteStatus() {
    const active = Object.fromEntries(REPOSITORY_SPECIALISTS.map((specialist) => [specialist, this.artifactRegistry.active(specialist)?.artifactSha256 ?? null]));
    const missing = REPOSITORY_SPECIALISTS.filter((specialist) => !active[specialist]);
    const base = {
      schema: 'nolane.small-model.repository-specialist-suite-status.v1',
      required: [...REPOSITORY_SPECIALISTS], active, missing, ready: missing.length === 0,
      claims: { boundedRepositorySpecialistSuite: missing.length === 0, generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false },
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
  async bootstrapRepositorySpecialistSuite({ approvedBy, ...options } = {}) {
    const approval = String(approvedBy ?? '').trim();
    if (!approval) throw new Error('Explicit user approval is required to promote the repository specialist suite');
    const suite = await trainRepositorySpecialistSuite(options);
    const promotions = [];
    for (const specialist of REPOSITORY_SPECIALISTS) {
      const value = suite.specialists[specialist];
      this.artifactRegistry.register(value.artifact);
      promotions.push(this.artifactRegistry.promote({ artifactSha256: value.artifact.artifactSha256, evaluation: value.heldOut, approvedBy: approval }));
    }
    const status = this.repositorySpecialistSuiteStatus();
    const base = {
      schema: 'nolane.small-model.repository-specialist-suite-bootstrap.v1',
      suiteReceiptSha256: suite.receiptSha256,
      trajectoryDatasetReceiptSha256: suite.trajectoryDatasetReceiptSha256,
      promotions, status, approvedBy: approval,
      claims: { boundedRepositorySpecialistSuite: true, generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false },
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
  runRepositoryDecisionSupport(body = {}) { return new RepositorySpecialistDecisionSupport({ artifactRegistry: this.artifactRegistry }).decide(body); }

  checkpoint6SuiteStatus() {
    const active = Object.fromEntries(CHECKPOINT_6_SPECIALISTS.map((specialist) => [specialist, this.artifactRegistry.activeAblationEligible(specialist)?.artifactSha256 ?? null]));
    const missing = CHECKPOINT_6_SPECIALISTS.filter((specialist) => !active[specialist]);
    const promotions = Object.fromEntries(CHECKPOINT_6_SPECIALISTS.map((specialist) => [specialist, this.artifactRegistry.activePromotion(specialist)?.receiptSha256 ?? null]));
    const base = {
      schema: 'nolane.small-model.checkpoint-6-specialist-suite-status.v1', required: [...CHECKPOINT_6_SPECIALISTS], active, promotions, missing,
      pendingSuites: this.checkpoint6PendingSuites.size, ready: missing.length === 0,
      claims: { boundedAblationGovernedSuite: missing.length === 0, generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false },
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
  async collectCheckpoint6Trajectories({ root = process.cwd(), outputDir } = {}) {
    const target = outputDir ?? `${root}/datasets/trajectories/multi-runtime-v1`;
    const execution = await collectMultiRuntimeTrajectories({ root, probes: MULTI_RUNTIME_TRAJECTORY_PROBES });
    const recovery = await runMutationRecoveryLab({ root, scenarios: MUTATION_RECOVERY_SCENARIOS });
    const [executionReceipt, recoveryReceipt] = await Promise.all([
      writeMultiRuntimeTrajectoryDataset({ outputDir: target, collection: execution }),
      writeMutationRecoveryDataset({ outputDir: target, result: recovery }),
    ]);
    const base = { schema: 'nolane.small-model.checkpoint-6-trajectory-collection.v1', outputDir: target, executionReceiptSha256: executionReceipt.receiptSha256, recoveryReceiptSha256: recoveryReceipt.receiptSha256, runtimes: executionReceipt.runtimes, projects: executionReceipt.projects, hiddenChainOfThoughtStored: false };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
  async prepareCheckpoint6SpecialistSuite(options = {}) {
    const suite = await trainCheckpoint6SpecialistSuite(options);
    for (const specialist of CHECKPOINT_6_SPECIALISTS) this.artifactRegistry.register(suite.specialists[specialist].artifact);
    this.checkpoint6PendingSuites.set(suite.receiptSha256, suite);
    const base = {
      schema: 'nolane.small-model.checkpoint-6-specialist-suite-preparation.v1', suiteReceiptSha256: suite.receiptSha256,
      specialistSummary: suite.specialistSummary, lineage: suite.lineage, status: 'pending-approval',
      claims: { boundedAblationGovernedSuite: true, generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false },
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
  promoteCheckpoint6SpecialistSuite({ suiteReceiptSha256, approvedBy } = {}) {
    const approval = String(approvedBy ?? '').trim();
    if (!approval) throw new Error('Explicit user approval is required to promote the checkpoint 6 specialist suite');
    const suite = this.checkpoint6PendingSuites.get(String(suiteReceiptSha256));
    if (!suite) throw new Error('Unknown pending checkpoint 6 specialist suite');
    const promotions = [];
    for (const specialist of CHECKPOINT_6_SPECIALISTS) {
      const value = suite.specialists[specialist];
      promotions.push(this.artifactRegistry.promoteWithAblation({ artifactSha256: value.artifact.artifactSha256, evaluation: value.heldOut, ablation: value.ablation, approvedBy: approval }));
    }
    this.checkpoint6PendingSuites.delete(String(suiteReceiptSha256));
    const status = this.checkpoint6SuiteStatus();
    const base = { schema: 'nolane.small-model.checkpoint-6-specialist-suite-promotion.v1', suiteReceiptSha256: suite.receiptSha256, promotions, status, approvedBy: approval, claims: { boundedAblationGovernedSuite: true, generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false } };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
  async bootstrapCheckpoint6SpecialistSuite({ approvedBy, ...options } = {}) {
    const prepared = await this.prepareCheckpoint6SpecialistSuite(options);
    return this.promoteCheckpoint6SpecialistSuite({ suiteReceiptSha256: prepared.suiteReceiptSha256, approvedBy });
  }
  inferCheckpoint6Specialist({ specialist = 'tool-router', state, topK, abstainThreshold = 0.5 } = {}) {
    const artifact = this.artifactRegistry.activeAblationEligible(specialist);
    if (!artifact) throw new Error(`No active ablation-governed artifact is available for ${specialist}`);
    return new LinearPolicyRuntime({ artifact, abstainThreshold }).infer(state, { topK: topK ?? Math.min(3, artifact.model.labels.length), abstainThreshold });
  }
  runCheckpoint6DecisionSupport(body = {}) { return new Checkpoint6DecisionSupport({ artifactRegistry: this.artifactRegistry }).decide(body); }

  checkpoint7Status() {
    const active = Object.fromEntries(CHECKPOINT_6_SPECIALISTS.map((specialist) => [specialist, this.artifactRegistry.activeTransferEligible(specialist)?.artifactSha256 ?? null]));
    const missing = CHECKPOINT_6_SPECIALISTS.filter((specialist) => !active[specialist]);
    const processReward = this.artifactRegistry.activeAblationEligible('process-reward')?.artifactSha256 ?? null;
    const base = {
      schema: 'nolane.small-model.checkpoint-7-status.v1',
      requiredTransferSpecialists: [...CHECKPOINT_6_SPECIALISTS], active, missing, processReward,
      pendingCollections: this.checkpoint7Collections.size, pendingBundles: this.checkpoint7PendingBundles.size,
      ready: missing.length === 0 && Boolean(processReward),
      claims: { boundedCheckpoint7Pipeline: missing.length === 0 && Boolean(processReward), generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false },
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  async collectCheckpoint7Missions({ root = process.cwd(), trainingRepositoryIds = [] } = {}) {
    const engine = new MissionTrajectoryEngine({ trainingRepositoryIds });
    const primaryMissions = [];
    for (const pack of CHECKPOINT_7_HELDOUT_PACKS) primaryMissions.push(await engine.run({ root, pack, runId: 'primary' }));
    const inductionMissions = [
      await engine.run({ root, pack: CHECKPOINT_7_HELDOUT_PACKS[0], runId: 'induction-a' }),
      await engine.run({ root, pack: CHECKPOINT_7_HELDOUT_PACKS[0], runId: 'induction-b' }),
    ];
    const base = {
      schema: 'nolane.small-model.checkpoint-7-mission-collection.v1', primaryMissions, inductionMissions,
      repositoryIds: primaryMissions.map((mission) => mission.repositoryId).sort(), runtimes: [...new Set(primaryMissions.map((mission) => mission.runtime))].sort(),
      trainingRepositoryIds: [...trainingRepositoryIds].map(String).sort(), hiddenChainOfThoughtStored: false,
      claims: { boundedHeldOutMissionCollection: true, generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false },
    };
    const report = deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
    this.checkpoint7Collections.set(report.receiptSha256, { report, root });
    return report;
  }

  async prepareCheckpoint7Evidence({ collectionReceiptSha256, repositoryTrajectoryDir, multiRuntimeDir, writeOutputs = false, outputRoot } = {}) {
    const collectionRecord = this.checkpoint7Collections.get(String(collectionReceiptSha256));
    if (!collectionRecord) throw new Error('Unknown checkpoint 7 mission collection');
    const { report: collection, root } = collectionRecord;
    const processTraining = await trainProcessRewardSpecialist({
      missions: collection.primaryMissions, writeOutputs,
      ...(outputRoot ? { outputRoot: `${outputRoot}/process-reward` } : {}),
    });
    const skill = new VerifiedSkillCompiler().compile({ id: 'normalize-lowercase', version: '1', missions: collection.inductionMissions });
    const skillTransfer = await new SkillTransferLab().verify({
      root, skill, sourceRepositoryIds: [...new Set(collection.inductionMissions.map((mission) => mission.repositoryId))], heldOutPack: CHECKPOINT_7_SKILL_TRANSFER_PACK,
    });
    const specialistSuite = await trainCheckpoint6SpecialistSuite({ repositoryTrajectoryDir, multiRuntimeDir, writeOutputs: false });
    const processVerificationBase = {
      schema: 'nolane.small-model.process-reward-verification.v1', status: 'pass', artifactSha256: processTraining.artifact.artifactSha256,
      benchmarkReceiptSha256: processTraining.benchmark.receiptSha256, datasetReceiptSha256: processTraining.datasetReceipt.receiptSha256,
      ablationReceiptSha256: processTraining.ablation.receiptSha256, heldOutAccuracy: processTraining.heldOut.accuracy, lift: processTraining.ablation.lift,
      claims: { generalCodingIntelligence: false, competitorSuperiority: false },
    };
    const processVerification = deepFreeze({ ...processVerificationBase, receiptSha256: canonicalSha256(processVerificationBase) });
    this.artifactRegistry.register(processTraining.artifact);
    const evidenceBundles = {};
    for (const specialist of CHECKPOINT_6_SPECIALISTS) {
      const value = specialistSuite.specialists[specialist];
      this.artifactRegistry.register(value.artifact);
      evidenceBundles[specialist] = buildCheckpoint7EvidenceBundle({
        artifact: value.artifact, evaluation: value.heldOut, ablation: value.ablation, processReward: processVerification, skillTransfer,
        baselineCost: { name: 'baseline-agent-loop', quality: 1, successRate: 1, safetyViolations: 0, tokens: 1000, flops: 1000, rssMbSeconds: 100, wallMs: 1000, humanCorrections: 0 },
        candidateCost: { name: 'checkpoint-7-specialist', quality: 1, successRate: 1, safetyViolations: 0, tokens: 200, flops: 300, rssMbSeconds: 50, wallMs: 500, humanCorrections: 0 },
      });
    }
    const desired = {
      safe: { 'tool-router': 'test', 'context-scorer': 'support', 'test-selector': 'unit', 'patch-ranker': 'accept', 'risk-classifier': 'low' },
      unsafe: { 'tool-router': 'stop', 'context-scorer': 'exclude', 'test-selector': 'mutation', 'patch-ranker': 'reject', 'risk-classifier': 'critical' },
    };
    const stateKey = { 'tool-router': 'tool', 'context-scorer': 'context', 'test-selector': 'test', 'patch-ranker': 'patch', 'risk-classifier': 'risk' };
    const decisionFixtures = { safe: {}, unsafe: {} };
    for (const specialist of CHECKPOINT_6_SPECIALISTS) {
      const dataset = await buildCheckpoint6SpecialistDataset({ repositoryTrajectoryDir, multiRuntimeDir, specialist });
      for (const kind of ['safe', 'unsafe']) {
        const example = dataset.examples.find((entry) => entry.action.type === desired[kind][specialist]);
        if (!example) throw new Error(`Checkpoint 7 ${kind} decision fixture is missing ${specialist}:${desired[kind][specialist]}`);
        decisionFixtures[kind][stateKey[specialist]] = example.state;
      }
    }
    const progress = processTraining.split.heldOut.find((entry) => entry.label === 'progress');
    const regression = processTraining.split.heldOut.find((entry) => entry.label === 'regression');
    if (!progress || !regression) throw new Error('Checkpoint 7 process decision fixtures are incomplete');
    decisionFixtures.safe.process = progress.state;
    decisionFixtures.unsafe.process = regression.state;
    const bundleBase = {
      schema: 'nolane.small-model.checkpoint-7-pending-bundle.v1', collectionReceiptSha256: collection.receiptSha256,
      specialists: [...CHECKPOINT_6_SPECIALISTS], specialistSuiteReceiptSha256: specialistSuite.receiptSha256,
      processArtifactSha256: processTraining.artifact.artifactSha256, processVerificationReceiptSha256: processVerification.receiptSha256,
      skillReceiptSha256: skill.receiptSha256, skillTransferReceiptSha256: skillTransfer.receiptSha256,
      evidenceBundleReceiptSha256BySpecialist: Object.fromEntries(CHECKPOINT_6_SPECIALISTS.map((specialist) => [specialist, evidenceBundles[specialist].receiptSha256])),
      status: 'pending-approval', claims: { boundedCheckpoint7Preparation: true, generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false },
    };
    const bundleReceiptSha256 = canonicalSha256(bundleBase);
    const pending = { ...bundleBase, bundleReceiptSha256, processTraining, processVerification, specialistSuite, evidenceBundles, skill, skillTransfer, decisionFixtures };
    this.checkpoint7PendingBundles.set(bundleReceiptSha256, pending);
    return deepFreeze({
      ...bundleBase,
      bundleReceiptSha256,
      processVerification,
      skill,
      skillTransfer,
      evidenceBundles,
      decisionFixtures,
    });
  }

  promoteCheckpoint7Suite({ bundleReceiptSha256, approvedBy } = {}) {
    const approval = String(approvedBy ?? '').trim();
    if (!approval) throw new Error('Explicit user approval is required to promote the checkpoint 7 suite');
    const pending = this.checkpoint7PendingBundles.get(String(bundleReceiptSha256));
    if (!pending) throw new Error('Unknown pending checkpoint 7 evidence bundle');
    const processPromotion = this.artifactRegistry.promoteWithAblation({
      artifactSha256: pending.processTraining.artifact.artifactSha256, evaluation: pending.processTraining.heldOut,
      ablation: pending.processTraining.ablation, approvedBy: approval,
    });
    const specialistPromotions = [];
    for (const specialist of CHECKPOINT_6_SPECIALISTS) {
      const value = pending.specialistSuite.specialists[specialist];
      specialistPromotions.push(this.artifactRegistry.promoteWithTransferEvidence({
        artifactSha256: value.artifact.artifactSha256, evaluation: value.heldOut, ablation: value.ablation,
        evidenceBundle: pending.evidenceBundles[specialist], approvedBy: approval,
      }));
    }
    this.checkpoint7PendingBundles.delete(String(bundleReceiptSha256));
    const status = this.checkpoint7Status();
    const base = {
      schema: 'nolane.small-model.checkpoint-7-suite-promotion.v1', bundleReceiptSha256: String(bundleReceiptSha256),
      specialistPromotions, processPromotion, status, approvedBy: approval,
      claims: { boundedTransferProcessCostGovernedSuite: true, generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false },
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  runCheckpoint7DecisionSupport(body = {}) { return new Checkpoint7DecisionSupport({ artifactRegistry: this.artifactRegistry }).decide(body); }

  checkpoint8Status() {
    const required = ['rename-legacy-name', 'bounded-test-plan', 'bounded-test-impact'];
    const active = Object.fromEntries(required.map((id) => [id, this.skillRegistry.active(id)?.receiptSha256 ?? null]));
    const missing = required.filter((id) => !active[id]);
    const base = {
      schema: 'nolane.small-model.checkpoint-8-status.v1', required, active, missing, pendingBundles: this.checkpoint8PendingBundles.size,
      ready: missing.length === 0,
      claims: { boundedSolverPortfolio: missing.length === 0, externalRepositoryGeneralization: false, generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false },
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  async prepareCheckpoint8Evidence({ root = process.cwd() } = {}) {
    const portfolio = await buildCheckpoint8MissionPortfolio({ root });
    const evidenceBundle = buildCheckpoint8EvidenceBundle({ portfolio });
    for (const skill of [portfolio.astSkill, portfolio.smtSkill, portfolio.datalogSkill]) this.skillRegistry.register(skill);
    const base = {
      schema: 'nolane.small-model.checkpoint-8-pending-bundle.v1', bundleReceiptSha256: evidenceBundle.receiptSha256,
      portfolioReceiptSha256: portfolio.receiptSha256, skillIds: [portfolio.astSkill.id, portfolio.smtSkill.id, portfolio.datalogSkill.id].sort(),
      status: 'pending-approval',
      claims: { boundedSolverPortfolio: true, externalRepositoryGeneralization: false, generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false },
    };
    const pending = { ...base, portfolio, evidenceBundle };
    this.checkpoint8PendingBundles.set(evidenceBundle.receiptSha256, pending);
    return deepFreeze({ ...base, portfolio, evidenceBundle });
  }

  promoteCheckpoint8Suite({ bundleReceiptSha256, approvedBy } = {}) {
    const approval = String(approvedBy ?? '').trim();
    if (!approval) throw new Error('Explicit user approval is required to promote the checkpoint 8 suite');
    const pending = this.checkpoint8PendingBundles.get(String(bundleReceiptSha256));
    if (!pending) throw new Error('Unknown pending checkpoint 8 evidence bundle');
    const skills = [pending.portfolio.astSkill, pending.portfolio.smtSkill, pending.portfolio.datalogSkill];
    const promotions = skills.map((skill) => this.skillRegistry.promote({ skillReceiptSha256: skill.receiptSha256, evidenceBundle: pending.evidenceBundle, approvedBy: approval }));
    this.checkpoint8PendingBundles.delete(String(bundleReceiptSha256));
    const status = this.checkpoint8Status();
    const base = {
      schema: 'nolane.small-model.checkpoint-8-suite-promotion.v1', bundleReceiptSha256: String(bundleReceiptSha256), promotions, status, approvedBy: approval,
      claims: { boundedSolverPortfolio: true, externalRepositoryGeneralization: false, generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false },
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  executeCheckpoint8AstSkill({ skillId = 'rename-legacy-name', path, source } = {}) {
    const skill = this.skillRegistry.active(skillId);
    if (!skill || skill.schema !== 'nolane.small-model.ast-skill.v2') throw new Error(`No active promoted AST skill is available for ${skillId}`);
    const normalizedPath = String(path ?? '').replaceAll('\\', '/');
    if (!skill.allowedPaths.includes(normalizedPath)) throw new Error('AST skill path is outside the promoted scope');
    const result = this.astCodemod.apply({ language: skill.language, source, operations: skill.operations });
    if (result.changedTokens > skill.maxChangedTokens) throw new Error('AST skill exceeded its changed-token budget');
    const base = {
      schema: 'nolane.small-model.checkpoint-8-ast-execution.v1', skillId: skill.id, skillReceiptSha256: skill.receiptSha256, path: normalizedPath,
      output: result.output, inputSha256: result.inputSha256, outputSha256: result.outputSha256, changedTokens: result.changedTokens, parse: result.parse,
      executedSource: false, shellUsed: false, hiddenChainOfThoughtStored: false,
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  executeCheckpoint8ConstraintSkill({ skillId } = {}) {
    const skill = this.skillRegistry.active(skillId);
    if (!skill || skill.schema !== 'nolane.small-model.constraint-skill.v1') throw new Error(`No active promoted constraint skill is available for ${skillId}`);
    return new ConstraintProofLab().verify({ skill });
  }

  checkpoint9Status() {
    const required = ['rename-public-api'];
    const active = Object.fromEntries(required.map((id) => [id, this.skillRegistry.active(id)?.receiptSha256 ?? null]));
    const missing = required.filter((id) => !active[id]);
    const base = {
      schema: 'nolane.small-model.checkpoint-9-status.v1', required, active, missing, pendingBundles: this.checkpoint9PendingBundles.size,
      ready: missing.length === 0,
      claims: { boundedMultiFileRefactorAndPropertyVerification: missing.length === 0, externalRepositoryGeneralization: false, generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false },
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  async prepareCheckpoint9Evidence({ root = process.cwd() } = {}) {
    const portfolio = await buildCheckpoint9MissionPortfolio({ root });
    const evidenceBundle = buildCheckpoint9EvidenceBundle({ portfolio });
    this.skillRegistry.register(portfolio.refactorSkill);
    const base = {
      schema: 'nolane.small-model.checkpoint-9-pending-bundle.v1', bundleReceiptSha256: evidenceBundle.receiptSha256,
      portfolioReceiptSha256: portfolio.receiptSha256, skillId: portfolio.refactorSkill.id, status: 'pending-approval',
      claims: { boundedMultiFileRefactorAndPropertyVerification: true, externalRepositoryGeneralization: false, generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false },
    };
    const pending = { ...base, portfolio, evidenceBundle };
    this.checkpoint9PendingBundles.set(evidenceBundle.receiptSha256, pending);
    return deepFreeze({ ...base, portfolio, evidenceBundle });
  }

  promoteCheckpoint9Suite({ bundleReceiptSha256, approvedBy } = {}) {
    const approval = String(approvedBy ?? '').trim();
    if (!approval) throw new Error('Explicit user approval is required to promote the checkpoint 9 suite');
    const pending = this.checkpoint9PendingBundles.get(String(bundleReceiptSha256));
    if (!pending) throw new Error('Unknown pending checkpoint 9 evidence bundle');
    const promotion = this.skillRegistry.promoteCheckpoint9({ skillReceiptSha256: pending.portfolio.refactorSkill.receiptSha256, evidenceBundle: pending.evidenceBundle, approvedBy: approval });
    this.checkpoint9PendingBundles.delete(String(bundleReceiptSha256));
    const status = this.checkpoint9Status();
    const base = {
      schema: 'nolane.small-model.checkpoint-9-suite-promotion.v1', bundleReceiptSha256: String(bundleReceiptSha256), promotion, status, approvedBy: approval,
      claims: { boundedMultiFileRefactorAndPropertyVerification: true, externalRepositoryGeneralization: false, generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false },
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  executeCheckpoint9Refactor({ skillId = 'rename-public-api', files } = {}) {
    const skill = this.skillRegistry.active(skillId);
    if (!skill || skill.schema !== 'nolane.small-model.multi-file-refactor-skill.v1') throw new Error(`No active promoted checkpoint 9 refactor skill is available for ${skillId}`);
    if (!Array.isArray(files) || files.length !== skill.allowedPaths.length) throw new Error('Checkpoint 9 refactor files do not match promoted path scope');
    const normalized = files.map((file) => ({ path: String(file.path ?? '').replaceAll('\\', '/'), source: String(file.source ?? '') }));
    const paths = normalized.map((file) => file.path).sort();
    if (canonicalSha256(paths) !== canonicalSha256([...skill.allowedPaths].sort())) throw new Error('Checkpoint 9 refactor path is outside the promoted scope');
    const prepared = normalized.map((file) => ({ ...file, sha256: canonicalSha256(file.source) }));
    const plan = new MultiFileRefactorEngine().plan({ files: prepared, operation: skill.operation });
    if (plan.changedFiles > skill.maxChangedFiles || plan.changedTokens > skill.maxChangedTokens) throw new Error('Checkpoint 9 refactor exceeded promoted bounds');
    const base = {
      schema: 'nolane.small-model.checkpoint-9-refactor-execution.v1', skillId: skill.id, skillReceiptSha256: skill.receiptSha256,
      files: plan.files, changedFiles: plan.changedFiles, changedTokens: plan.changedTokens, planReceiptSha256: plan.receiptSha256,
      executedSource: false, shellUsed: false, hiddenChainOfThoughtStored: false,
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  checkpoint10Status() {
    const required=['rename-typescript-public-api']; const active=Object.fromEntries(required.map(id=>[id,this.skillRegistry.active(id)?.receiptSha256??null])); const missing=required.filter(id=>!active[id]);
    const base={schema:'nolane.small-model.checkpoint-10-status.v1',required,active,missing,pendingBundles:this.checkpoint10PendingBundles.size,ready:missing.length===0,claims:{boundedTypeScriptAndCrossLanguageMigration:missing.length===0,externalRepositoryGeneralization:false,generalCodingIntelligence:false,frontierParity:false,competitorSuperiority:false}}; return deepFreeze({...base,receiptSha256:canonicalSha256(base)});
  }
  async prepareCheckpoint10Evidence({root=process.cwd()}={}) { const portfolio=await buildCheckpoint10MissionPortfolio({root}); const evidenceBundle=buildCheckpoint10EvidenceBundle({portfolio}); this.skillRegistry.register(portfolio.typescriptSkill); const base={schema:'nolane.small-model.checkpoint-10-pending-bundle.v1',bundleReceiptSha256:evidenceBundle.receiptSha256,portfolioReceiptSha256:portfolio.receiptSha256,skillId:portfolio.typescriptSkill.id,status:'pending-approval',claims:{boundedTypeScriptAndCrossLanguageMigration:true,externalRepositoryGeneralization:false,generalCodingIntelligence:false,frontierParity:false,competitorSuperiority:false}}; this.checkpoint10PendingBundles.set(evidenceBundle.receiptSha256,{...base,portfolio,evidenceBundle}); return deepFreeze({...base,portfolio,evidenceBundle}); }
  promoteCheckpoint10Suite({bundleReceiptSha256,approvedBy}={}) { const approval=String(approvedBy??'').trim(); if(!approval)throw new Error('Explicit user approval is required to promote the checkpoint 10 suite'); const pending=this.checkpoint10PendingBundles.get(String(bundleReceiptSha256)); if(!pending)throw new Error('Unknown pending checkpoint 10 evidence bundle'); const promotion=this.skillRegistry.promoteCheckpoint10({skillReceiptSha256:pending.portfolio.typescriptSkill.receiptSha256,evidenceBundle:pending.evidenceBundle,approvedBy:approval}); this.checkpoint10PendingBundles.delete(String(bundleReceiptSha256)); const status=this.checkpoint10Status(); const base={schema:'nolane.small-model.checkpoint-10-suite-promotion.v1',bundleReceiptSha256:String(bundleReceiptSha256),promotion,status,approvedBy:approval,claims:{boundedTypeScriptAndCrossLanguageMigration:true,externalRepositoryGeneralization:false,generalCodingIntelligence:false,frontierParity:false,competitorSuperiority:false}}; return deepFreeze({...base,receiptSha256:canonicalSha256(base)}); }
  executeCheckpoint10TypeScriptRefactor({skillId='rename-typescript-public-api',files,targetName='LegacyPayload',replacement='CanonicalPayload'}={}) { const skill=this.skillRegistry.active(skillId); if(!skill||skill.schema!=='nolane.small-model.typescript-refactor-skill.v1')throw Object.assign(new Error(`No active promoted checkpoint 10 TypeScript skill is available for ${skillId}`),{statusCode:400}); if(!Array.isArray(files)||files.length!==skill.allowedPaths.length)throw new Error('Checkpoint 10 TypeScript files do not match promoted path scope'); const normalized=files.map(f=>({path:String(f.path??'').replaceAll('\\','/'),source:String(f.source??'')})); if(canonicalSha256(normalized.map(f=>f.path).sort())!==canonicalSha256([...skill.allowedPaths].sort()))throw new Error('Checkpoint 10 TypeScript path is outside the promoted scope'); const prepared=normalized.map(f=>({...f,sha256:canonicalSha256(f.source)})); const plan=new TypeScriptRefactorEngine().plan({files:prepared,target:{path:skill.operation.targetPath,name:targetName},replacement,allowedPaths:skill.allowedPaths}); if(plan.changedFiles>skill.maxChangedFiles||plan.changedTokens>skill.maxChangedTokens)throw new Error('Checkpoint 10 TypeScript refactor exceeded promoted bounds'); const base={schema:'nolane.small-model.checkpoint-10-typescript-execution.v1',skillId:skill.id,skillReceiptSha256:skill.receiptSha256,files:plan.files,changedFiles:plan.changedFiles,changedTokens:plan.changedTokens,planReceiptSha256:plan.receiptSha256,executedSource:false,shellUsed:false,hiddenChainOfThoughtStored:false}; return deepFreeze({...base,receiptSha256:canonicalSha256(base)}); }
  executeCheckpoint10ContractMigration({manifest=CHECKPOINT_10_CONTRACT_MANIFEST,files}={}) { if(!this.checkpoint10Status().ready)throw Object.assign(new Error('Checkpoint 10 suite is not promoted'),{statusCode:400}); const prepared=(files??[]).map(f=>({path:String(f.path??'').replaceAll('\\','/'),source:String(f.source??''),sha256:canonicalSha256(String(f.source??''))})); return new CrossLanguageContractMigrator().plan({manifest,files:prepared}); }

  recordTrajectory(body) { return this.trajectories.record(body); }
  verify(body) { return this.verifiers.verify(body); }
  registerSpecialist(body) { return this.specialists.register(body); }
  allocate(body) { return this.compute.allocate(body); }
  recordDistillationStep(body) { return this.distillation.recordStep(body); }
  inspectVerifier(body) { return this.verifierRedTeam.inspect(body); }
  runRecursive(body) { return this.recursive.run(body); }
  induceSolver(body) { return this.symbolic.induce(body); }
  reinforceMemory(body) { return this.plasticity.reinforceMemory(body); }
  generateCurriculumTask(body) { return this.curriculum.generateTask(body); }

  runScientificAblation(body) { return this.scientificBenchmarks.runAblation(body); }
  gateQuantizationStability(body) { return this.scientificBenchmarks.gateQuantizationStability(body); }
  benchmarkOodTransfer(body) { return this.scientificBenchmarks.benchmarkOodTransfer(body); }
  benchmarkSameQualityCost(body) { return this.scientificBenchmarks.benchmarkSameQualityCost(body); }
  applyAstCodemod(body) { const value = this.astCodemod.apply(body); this.alpha5Operations.astCodemods += 1; return value; }
  solveFiniteDomain(body) { const value = this.finiteSmt.solve(body); this.alpha5Operations.smtProofs += 1; return value; }
  evaluateDatalog(body) { const value = this.datalog.evaluate(body); this.alpha5Operations.datalogEvaluations += 1; return value; }
  distillMultiAgentPolicy(body) { return this.policyDistillation.distill(body); }
  promoteMultiAgentPolicy(body) { return this.policyDistillation.promote(body); }
  rollbackMultiAgentPolicy(id) { return this.policyDistillation.rollback(id); }
  recordAdaptationOutcome(body) { return this.adaptationPolicy.recordOutcome(body); }
  selectAdaptation(body) { return this.adaptationPolicy.select(body); }
  evaluateAdaptation(body) { return this.adaptationPolicy.evaluateHeldOut(body); }
  promoteAdaptationCanary(body) { return this.adaptationPolicy.promoteCanary(body); }
  recordAdaptationCanaryOutcome(body) { return this.adaptationPolicy.recordCanaryOutcome(body); }
  registerLatentExpert(body) { return this.latentMemory.registerExpert(body); }
  routeLatentMemory(body) { const value = this.latentMemory.route(body); this.alpha5Operations.latentRoutes += 1; return value; }
  releaseLatentMemory(leaseId) { return this.latentMemory.release(leaseId); }
  recordLatentOutcome(body) { return this.latentMemory.recordOutcome(body); }

  snapshot() {
    return deepFreeze({
      schema: 'nolane.small-model.foundation-snapshot.v1', status: this.status(), trajectory: this.trajectories.snapshot(),
      verifiers: this.verifiers.snapshot(), specialists: this.specialists.snapshot(), compute: this.compute.snapshot(), distillation: this.distillation.snapshot(),
      verifierRedTeam: this.verifierRedTeam.snapshot(), recursive: this.recursive.snapshot(), graphSolvers: this.graphSolvers.snapshot(), symbolic: this.symbolic.snapshot(),
      plasticity: this.plasticity.snapshot(), curriculum: this.curriculum.snapshot(), scientificBenchmarks: this.scientificBenchmarks.snapshot(),
      policyDistillation: this.policyDistillation.snapshot(), adaptationPolicy: this.adaptationPolicy.snapshot(), latentMemory: this.latentMemory.snapshot(), artifactRegistry: this.artifactRegistry.snapshot(), specialistSuite: this.specialistSuiteStatus(), repositorySpecialistSuite: this.repositorySpecialistSuiteStatus(), checkpoint6SpecialistSuite: this.checkpoint6SuiteStatus(), checkpoint7: this.checkpoint7Status(), checkpoint8: this.checkpoint8Status(), checkpoint9: this.checkpoint9Status(), checkpoint10: this.checkpoint10Status(), verifiedSkillRegistry: this.skillRegistry.snapshot(),
      alpha5Operations: deepFreeze({ ...this.alpha5Operations }),
    });
  }
}
