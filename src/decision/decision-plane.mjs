import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { AcceptanceCriteriaLedger } from './acceptance-criteria-ledger.mjs';
import { createDecisionReceipt } from './decision-receipt-service.mjs';
import { DecisionEfficiencyMetrics } from './decision-efficiency-metrics.mjs';
import { TokenCostAdapter } from '../context/token-cost-adapter.mjs';
import { ContextEscalationController } from '../context/context-escalation-controller.mjs';
import { CognitiveKernel } from '../cognition/cognitive-kernel.mjs';
import { ConstructionControlPlane } from '../construction/construction-control-plane.mjs';
import { VerificationControlPlane } from '../verification/verification-control-plane.mjs';
import { MemorySkillResourcePlane } from '../runtime/memory-skill-resource-plane.mjs';
import { CollaborationExperiencePlane } from '../runtime/collaboration-experience-plane.mjs';
import { SecurityCertificationPlane } from '../security/security-certification-plane.mjs';
import { WorldDevelopmentPlane } from '../runtime/world-development-plane.mjs';
import { FrontierGovernancePlane } from '../runtime/frontier-governance-plane.mjs';
import { VerifiedMissionRuntime } from '../runtime/verified-mission-runtime.mjs';
import { LocalFrontierCompletionPlane } from '../frontier-completion/local-frontier-completion-plane.mjs';
import { SuperiorityPlane } from '../runtime/superiority-plane.mjs';

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}
function signed(base) { return freeze({ ...base, receiptSha256: canonicalSha256(base) }); }

export class DecisionPlane {
  constructor({ clock = () => Date.now(), tokenizers = {}, escalation = {}, construction = {}, verification = {}, memorySkillResource = {}, collaborationExperience = {}, securityCertification = {}, worldDevelopment = {}, frontierGovernance = {}, verifiedMission = {}, localFrontierCompletion = {}, superiority = {}, limits = {} } = {}) {
    this.clock = typeof clock === 'function' ? clock : () => Date.now();
    this.tokenizers = tokenizers;
    this.escalationOptions = escalation;
    this.maxDecisions = Math.max(1, Math.floor(Number(limits.maxDecisionReceipts) || 200));
    this.taskIds = new Set();
    this.decisionReceipts = [];
    this.closed = false;
    this._criteria = null;
    this._tokenCost = null;
    this._escalation = null;
    this._cognition = null;
    this._construction = null;
    this._verification = null;
    this._memorySkillResource = null;
    this._collaborationExperience = null;
    this._securityCertification = null;
    this._worldDevelopment = null;
    this._frontierGovernance = null;
    this._verifiedMission = null;
    this._localFrontierCompletion = null;
    this._superiority = null;
    this.cognitionOptions = { clock: this.clock, limits: { maxTasks: limits.maxCognitiveTasks ?? 1_000, maxReceipts: limits.maxCognitiveReceipts ?? 5_000 } };
    this.constructionOptions = construction;
    this.verificationOptions = { ...verification, clock: this.clock };
    this.memorySkillResourceOptions = { ...memorySkillResource, clock: this.clock };
    this.collaborationExperienceOptions = { ...collaborationExperience, clock: this.clock };
    this.securityCertificationOptions = { ...securityCertification, clock: securityCertification.clock ?? this.clock };
    this.worldDevelopmentOptions = worldDevelopment;
    this.frontierGovernanceOptions = { ...frontierGovernance, clock: frontierGovernance.clock ?? this.clock };
    this.verifiedMissionOptions = { ...verifiedMission, clock: verifiedMission.clock ?? this.clock, limits: { ...(verifiedMission.limits ?? {}), maxMissions: verifiedMission.limits?.maxMissions ?? limits.maxVerifiedMissions } };
    this.localFrontierCompletionOptions = localFrontierCompletion;
    this.superiorityOptions = { ...superiority, clock: superiority.clock ?? this.clock };
    this._efficiency = new DecisionEfficiencyMetrics({ maxEntries: limits.maxDecisionEfficiencyEntries ?? 2_000 });
  }

  get efficiency() { return this._efficiency; }
  get criteria() {
    this.#assertOpen();
    return this._criteria ??= new AcceptanceCriteriaLedger({ clock: this.clock, maxTasks: 10_000 });
  }
  get tokenCost() {
    this.#assertOpen();
    return this._tokenCost ??= new TokenCostAdapter({ tokenizers: this.tokenizers });
  }
  get escalation() {
    this.#assertOpen();
    return this._escalation ??= new ContextEscalationController(this.escalationOptions);
  }
  get cognition() {
    this.#assertOpen();
    return this._cognition ??= new CognitiveKernel(this.cognitionOptions);
  }
  get construction() {
    this.#assertOpen();
    return this._construction ??= new ConstructionControlPlane(this.constructionOptions);
  }
  get verification() {
    this.#assertOpen();
    return this._verification ??= new VerificationControlPlane(this.verificationOptions);
  }
  get memorySkillResource() {
    this.#assertOpen();
    return this._memorySkillResource ??= new MemorySkillResourcePlane(this.memorySkillResourceOptions);
  }
  get collaborationExperience() {
    this.#assertOpen();
    return this._collaborationExperience ??= new CollaborationExperiencePlane(this.collaborationExperienceOptions);
  }
  get securityCertification() {
    this.#assertOpen();
    return this._securityCertification ??= new SecurityCertificationPlane(this.securityCertificationOptions);
  }
  get worldDevelopment() {
    this.#assertOpen();
    return this._worldDevelopment ??= new WorldDevelopmentPlane(this.worldDevelopmentOptions);
  }
  get frontierGovernance() {
    this.#assertOpen();
    return this._frontierGovernance ??= new FrontierGovernancePlane(this.frontierGovernanceOptions);
  }
  get verifiedMission() {
    this.#assertOpen();
    return this._verifiedMission ??= new VerifiedMissionRuntime(this.verifiedMissionOptions);
  }
  get localFrontierCompletion() {
    this.#assertOpen();
    return this._localFrontierCompletion ??= new LocalFrontierCompletionPlane(this.localFrontierCompletionOptions);
  }
  get superiority() {
    this.#assertOpen();
    return this._superiority ??= new SuperiorityPlane(this.superiorityOptions);
  }

  registerTaskCriteria(taskId, criteria) {
    const snapshot = this.criteria.registerTask(taskId, criteria);
    this.taskIds.add(snapshot.taskId);
    return snapshot;
  }
  recordCriterionVerification(taskId, criterionId, receipt) { return this.criteria.recordVerification(taskId, criterionId, receipt); }
  criterionSnapshot(taskId) { return this.criteria.snapshot(taskId); }
  recordEfficiency(input) { this.#assertOpen(); return this._efficiency.record(input); }
  createReceipt(input) {
    this.#assertOpen();
    const receipt = createDecisionReceipt(input);
    this.decisionReceipts.push(receipt);
    while (this.decisionReceipts.length > this.maxDecisions) this.decisionReceipts.shift();
    return receipt;
  }
  async countTokens(text, harnessProfile, options) { return this.tokenCost.count(text, harnessProfile, options); }
  startEscalation(input) { return this.escalation.start(input); }
  evaluateEscalation(state, input) { return this.escalation.evaluate(state, input); }
  startCognitiveTask(input) { return this.cognition.startTask(input); }
  observeCognitiveEvent(taskId, event) { return this.cognition.observe(taskId, event); }
  proposeCognitiveAction(taskId, input) { return this.cognition.propose(taskId, input); }
  verifyCognitiveProposal(taskId, proposalId, verification) { return this.cognition.verify(taskId, proposalId, verification); }
  commitCognitiveProposal(taskId, verifiedProposalId) { return this.cognition.commit(taskId, verifiedProposalId); }
  cognitiveSnapshot(taskId = null) { return this._cognition ? this._cognition.snapshot(taskId) : null; }
  compileConstructionSpecification(input) { return this.construction.compileSpecification(input); }
  createExecutablePlan(input) { return this.construction.createPlan(input); }
  transitionExecutablePlan(planId, stepId, event) { return this.construction.transitionPlan(planId, stepId, event); }
  revalidateExecutablePlan(planId, evidence) { return this.construction.revalidatePlan(planId, evidence); }
  verifyConstructionInvariant(specificationId, invariantId, receipt) { return this.construction.verifyInvariant(specificationId, invariantId, receipt); }
  authorizeConstructionInvariants(specificationId, input) { return this.construction.authorizeInvariants(specificationId, input); }
  analyzeConstructionPatch(input) { return this.construction.analyzePatch(input); }
  selectConstructionVerification(input) { return this.construction.selectVerification(input); }
  selectConstructionCandidate(input) { return this.construction.selectCandidate(input); }
  buildConstructionProof(input) { return this.construction.buildCompletionProof(input); }
  constructionSnapshot() { return this._construction ? this._construction.snapshot() : null; }

  planVerification(input) { return this.verification.planVerification(input); }
  assessTestIntegrity(input) { return this.verification.assessTestIntegrity(input); }
  verifyApiExistence(input) { return this.verification.verifyApiExistence(input); }
  runAdversarialReview(input) { return this.verification.runAdversarialReview(input); }
  runFailureInjection(input) { return this.verification.runFailureInjection(input); }
  calibrateTrajectory(input) { return this.verification.calibrateTrajectory(input); }
  recordTrajectoryOutcome(input) { return this.verification.recordCalibrationOutcome(input); }
  recordVerifiedBanditOutcome(input) { return this.verification.recordBanditOutcome(input); }
  rankVerifiedBandit(input) { return this.verification.rankBandit(input); }
  decideSemanticCompletion(input) { return this.verification.decideSemanticCompletion(input); }
  verificationSnapshot() { return this._verification ? this._verification.snapshot() : null; }

  operateMemory(input) { return this.memorySkillResource.operateMemory(input); }
  decideMemoryPolicy(input) { return this.memorySkillResource.decideMemoryPolicy(input); }
  observeModelTime(input) { return this.memorySkillResource.observeModelTime(input); }
  scheduleMemoryReplay(input) { return this.memorySkillResource.scheduleReplay(input); }
  compileCompositionalSkill(input) { return this.memorySkillResource.compileSkill(input); }
  recombineCompositionalSkills(input) { return this.memorySkillResource.recombineSkills(input); }
  recordSkillTransfer(skillId, input) { return this.memorySkillResource.recordSkillTransfer(skillId, input); }
  transitionSkill(skillId, state, input) { return this.memorySkillResource.transitionSkill(skillId, state, input); }
  evaluateStabilityPlasticity(input) { return this.memorySkillResource.evaluateStability(input); }
  admitResource(input, metrics) { return this.memorySkillResource.admitResource(input, metrics); }
  sampleResource(leaseId, input) { return this.memorySkillResource.sampleResource(leaseId, input); }
  releaseResource(leaseId, input) { return this.memorySkillResource.releaseResource(leaseId, input); }
  diagnoseLocalDevice(input) { return this.memorySkillResource.diagnoseDevice(input); }
  stopMissionResources(input) { return this.memorySkillResource.stopMissionResources(input); }
  putArtifact(input) { return this.memorySkillResource.putArtifact(input); }
  getArtifact(sha256, options) { return this.memorySkillResource.getArtifact(sha256, options); }
  artifactProjection(sha256, options) { return this.memorySkillResource.artifactProjection(sha256, options); }
  deleteArtifact(sha256, input) { return this.memorySkillResource.deleteArtifact(sha256, input); }
  memorySkillResourceSnapshot() { return this._memorySkillResource ? this._memorySkillResource.snapshot() : null; }

  heartbeatCollaborationAgent(input) { return this.collaborationExperience.heartbeatAgent(input); }
  writeCollaborationBlackboard(input) { return this.collaborationExperience.writeBlackboard(input); }
  readCollaborationBlackboard(input) { return this.collaborationExperience.readBlackboard(input); }
  resolveCollaborationBlackboard(key) { return this.collaborationExperience.resolveBlackboard(key); }
  createJointCommitment(input) { return this.collaborationExperience.createCommitment(input); }
  renegotiateJointCommitment(input) { return this.collaborationExperience.renegotiateCommitment(input); }
  acknowledgeJointCommitment(input) { return this.collaborationExperience.acknowledgeCommitment(input); }
  selectCollaborationTopology(input) { return this.collaborationExperience.selectTopology(input); }
  analyzeSemanticMerge(input) { return this.collaborationExperience.analyzeSemanticMerge(input); }
  replayDeterministicJourney(input) { return this.collaborationExperience.replayBrowserJourney(input); }
  addReviewItem(input) { return this.collaborationExperience.addReviewItem(input); }
  decideReviewItem(input) { return this.collaborationExperience.decideReviewItem(input); }
  reviewQueueSnapshot() { return this.collaborationExperience.reviewQueueSnapshot(); }
  appendPlaybackEvent(input) { return this.collaborationExperience.appendPlaybackEvent(input); }
  addPlaybackCheckpoint(input) { return this.collaborationExperience.addPlaybackCheckpoint(input); }
  createPlaybackRewindPlan(input) { return this.collaborationExperience.createRewindPlan(input); }
  issueMissionSteering(input) { return this.collaborationExperience.issueSteering(input); }
  collaborationExperienceSnapshot() { return this._collaborationExperience ? this._collaborationExperience.snapshot() : null; }

  analyzeSecurityTaint(input) { return this.securityCertification.analyzeTaint(input); }
  detectSecurityInjection(input) { return this.securityCertification.detectContextualInjection(input); }
  quarantineSecurityPrompt(input) { return this.securityCertification.quarantinePromptInjection(input); }
  assessDependencySecurity(input) { return this.securityCertification.assessDependency(input); }
  generateSecuritySbom(input) { return this.securityCertification.generateSbom(input); }
  evaluateSecurityIntegrity(input) { return this.securityCertification.evaluateIntegrity(input); }
  inspectSecurityExfiltration(input) { return this.securityCertification.inspectExfiltration(input); }
  issueMissionCapabilityToken(input) { return this.securityCertification.issueMissionToken(input); }
  authorizeMissionCapabilityToken(input) { return this.securityCertification.authorizeMissionToken(input); }
  revokeMissionCapabilityToken(input) { return this.securityCertification.revokeMissionToken(input); }
  appendSecurityAudit(input) { return this.securityCertification.appendAudit(input); }
  verifySecurityAudit(input) { return this.securityCertification.verifyAudit(input); }
  authorizeProtectedSecurityBoundary(input) { return this.securityCertification.authorizeProtectedBoundary(input); }
  runSandboxEscapeSuite(input) { return this.securityCertification.runSandboxEscape(input); }
  runExtendedFailureScenario(input) { return this.securityCertification.runExtendedFailure(input); }
  verifyBenchmarkComparability(input) { return this.securityCertification.verifyBenchmarkComparability(input); }
  assessBenchmarkContamination(input) { return this.securityCertification.assessBenchmarkContamination(input); }
  recordBenchmarkEvidence(input) { return this.securityCertification.recordBenchmarkEvidence(input); }
  certifyBenchmarkComparison(input) { return this.securityCertification.certifyComparison(input); }
  securityCertificationSnapshot() { return this._securityCertification ? this._securityCertification.snapshot() : null; }

  registerWorldModel(input) { return this.worldDevelopment.registerModel(input); }
  selectWorldModel(input) { return this.worldDevelopment.selectModel(input); }
  recordWorldModelOutcome(id, input) { return this.worldDevelopment.recordModelOutcome(id, input); }
  decideWorldForesight(input) { return this.worldDevelopment.decideForesight(input); }
  simulateWorldCounterfactual(input) { return this.worldDevelopment.simulateCounterfactual(input); }
  validateWorldCounterfactual(receipt, input) { return this.worldDevelopment.validateCounterfactual(receipt, input); }
  recordVerifiedSelfOutcome(input) { return this.worldDevelopment.recordSelfOutcome(input); }
  updateVerifiedToolTrust(input) { return this.worldDevelopment.updateToolTrust(input); }
  assignDevelopmentResponsibility(input) { return this.worldDevelopment.assignResponsibility(input); }
  proposeDevelopmentalGoal(input) { return this.worldDevelopment.proposeDevelopmentalGoal(input); }
  recordDevelopmentalGoalOutcome(input) { return this.worldDevelopment.recordDevelopmentalOutcome(input); }
  evaluateDevelopmentalStage(input) { return this.worldDevelopment.evaluateStageAdvance(input); }
  evaluateDevelopmentalPolicy(input) { return this.worldDevelopment.evaluateDevelopmentPolicy(input); }
  worldDevelopmentSnapshot() { return this._worldDevelopment ? this._worldDevelopment.snapshot() : null; }

  registerFrontierRepository(input) { return this.frontierGovernance.registerRepository(input); }
  registerFrontierContract(input) { return this.frontierGovernance.registerContract(input); }
  linkFrontierDependency(input) { return this.frontierGovernance.linkDependency(input); }
  frontierWorkspaceSnapshot() { return this.frontierGovernance.workspaceSnapshot(); }
  compileFrontierTransaction(input) { return this.frontierGovernance.compileTransaction(input); }
  prepareFrontierCommitChain(plan, input) { return this.frontierGovernance.prepareCommitChain(plan, input); }
  recordFrontierPreparedCommit(chainId, input) { return this.frontierGovernance.recordPreparedCommit(chainId, input); }
  recordFrontierCommitVerification(chainId, input) { return this.frontierGovernance.recordCommitVerification(chainId, input); }
  recordFrontierRollback(chainId, input) { return this.frontierGovernance.recordSynchronizedRollback(chainId, input); }
  authorizeFrontierHumanMerge(chainId, input) { return this.frontierGovernance.authorizeHumanMerge(chainId, input); }
  ingestFrontierPostMergeSignal(input) { return this.frontierGovernance.ingestPostMergeSignal(input); }
  traceFrontierPostMergeIncident(input) { return this.frontierGovernance.tracePostMergeIncident(input); }
  registerFrontierChangeSurvival(input) { return this.frontierGovernance.registerChangeSurvival(input); }
  observeFrontierChangeSurvival(changeId, input) { return this.frontierGovernance.observeChangeSurvival(changeId, input); }
  evaluateFrontierChangeSurvival(changeId) { return this.frontierGovernance.evaluateChangeSurvival(changeId); }
  frontierChangeSurvivalShadowCredit(changeId) { return this.frontierGovernance.changeSurvivalShadowCredit(changeId); }
  proposeFrontierSelfHealing(input) { return this.frontierGovernance.proposeSelfHealing(input); }
  recordFrontierSelfHealingOutcome(proposalId, input) { return this.frontierGovernance.recordSelfHealingOutcome(proposalId, input); }
  registerFrontierCulturalLineage(input) { return this.frontierGovernance.registerCulturalLineage(input); }
  transitionFrontierCulturalLineage(artifactId, input) { return this.frontierGovernance.transitionCulturalLineage(artifactId, input); }
  evaluateFrontierSelfImprovement(input) { return this.frontierGovernance.evaluateSelfImprovementCandidate(input); }
  recordFrontierSelfImprovementStage(candidateId, input) { return this.frontierGovernance.recordSelfImprovementStage(candidateId, input); }
  authorizeFrontierSelfImprovementPromotion(candidateId, input) { return this.frontierGovernance.authorizeSelfImprovementPromotion(candidateId, input); }
  frontierGovernanceSnapshot() { return this._frontierGovernance ? this._frontierGovernance.snapshot() : null; }

  registerVerifiedMission(input) { return this.verifiedMission.registerMission(input); }
  registerVerifiedMilestone(input) { return this.verifiedMission.registerMilestone(input); }
  registerVerifiedTask(input) { return this.verifiedMission.registerTask(input); }
  registerVerifiedDecision(input) { return this.verifiedMission.registerDecision(input); }
  recordVerifiedMissionContext(input) { return this.verifiedMission.recordContextSelection(input); }
  recordVerifiedMissionOutcome(input) { return this.verifiedMission.recordVerification(input); }
  recordVerifiedMissionCost(input) { return this.verifiedMission.recordCost(input); }
  createVerifiedDecisionState(input) { return this.verifiedMission.createDecisionState(input); }
  transitionVerifiedDecision(decisionId, input) { return this.verifiedMission.transitionDecision(decisionId, input); }
  observeVerifiedMissionProgress(input) { return this.verifiedMission.observeProgress(input); }
  registerVerifiedMissionResource(input) { return this.verifiedMission.registerResource(input); }
  sampleVerifiedMissionResource(input) { return this.verifiedMission.sampleResource(input); }
  finalizeVerifiedMissionResource(input) { return this.verifiedMission.finalizeResource(input); }
  appendVerifiedMissionLog(streamId, record) { return this.verifiedMission.appendLog(streamId, record); }
  readVerifiedMissionLog(streamId, options) { return this.verifiedMission.readLog(streamId, options); }
  reapVerifiedMission(input) { return this.verifiedMission.reapMission(input); }
  verifiedMissionSnapshot() { return this._verifiedMission ? this._verifiedMission.snapshot() : null; }
  localFrontierCompletionSnapshot() { return this._localFrontierCompletion ? this._localFrontierCompletion.snapshot() : null; }

  compileProofMission(input) { return this.superiority.compileProofMission(input); }
  recordProofEvidence(planId, input) { return this.superiority.recordProofEvidence(planId, input); }
  evaluateProofMission(planId) { return this.superiority.evaluateProofMission(planId); }
  registerCausalTwinNode(input) { return this.superiority.registerCausalTwinNode(input); }
  linkCausalTwin(input) { return this.superiority.linkCausalTwin(input); }
  predictCausalImpact(input) { return this.superiority.predictCausalImpact(input); }
  recordCausalOutcome(input) { return this.superiority.recordCausalOutcome(input); }
  invalidateCausalEvidence(sourceHash) { return this.superiority.invalidateCausalEvidence(sourceHash); }
  openAdversarialTournament(input) { return this.superiority.openAdversarialTournament(input); }
  registerTournamentCandidate(tournamentId, input) { return this.superiority.registerTournamentCandidate(tournamentId, input); }
  recordTournamentAttack(tournamentId, input) { return this.superiority.recordTournamentAttack(tournamentId, input); }
  recordTournamentVerification(tournamentId, input) { return this.superiority.recordTournamentVerification(tournamentId, input); }
  decideAdversarialTournament(tournamentId) { return this.superiority.decideAdversarialTournament(tournamentId); }
  registerGovernedModel(input) { return this.superiority.registerGovernedModel(input); }
  routeGovernedModel(input) { return this.superiority.routeGovernedModel(input); }
  recordGovernedModelOutcome(input) { return this.superiority.recordGovernedModelOutcome(input); }
  authorizeGovernedModelPromotion(modelId, input) { return this.superiority.authorizeGovernedModelPromotion(modelId, input); }
  registerMissionConstitution(input) { return this.superiority.registerMissionConstitution(input); }
  evaluateConstitutionAction(constitutionId, input) { return this.superiority.evaluateConstitutionAction(constitutionId, input); }
  amendMissionConstitution(constitutionId, input) { return this.superiority.amendMissionConstitution(constitutionId, input); }
  openCounterfactualPlan(input) { return this.superiority.openCounterfactualPlan(input); }
  registerCounterfactualCandidate(planningId, input) { return this.superiority.registerCounterfactualCandidate(planningId, input); }
  decideCounterfactualPlan(planningId) { return this.superiority.decideCounterfactualPlan(planningId); }
  proposeVerifiedMemory(input) { return this.superiority.proposeVerifiedMemory(input); }
  recordVerifiedMemoryOutcome(memoryId, input) { return this.superiority.recordVerifiedMemoryOutcome(memoryId, input); }
  evaluateVerifiedMemory(memoryId) { return this.superiority.evaluateVerifiedMemory(memoryId); }
  promoteVerifiedMemory(memoryId, input) { return this.superiority.promoteVerifiedMemory(memoryId, input); }
  invalidateVerifiedMemory(memoryId, input) { return this.superiority.invalidateVerifiedMemory(memoryId, input); }
  tombstoneVerifiedMemory(memoryId, input) { return this.superiority.tombstoneVerifiedMemory(memoryId, input); }
  registerSelfHealingComponent(input) { return this.superiority.registerSelfHealingComponent(input); }
  observeSelfHealingAnomaly(input) { return this.superiority.observeSelfHealingAnomaly(input); }
  planSelfHealingRepair(componentId, input) { return this.superiority.planSelfHealingRepair(componentId, input); }
  executeSelfHealingRepair(planId, input) { return this.superiority.executeSelfHealingRepair(planId, input); }
  scheduleProofBudget(input) { return this.superiority.scheduleProofBudget(input); }
  createComparativeStudy(input) { return this.superiority.createComparativeStudy(input); }
  ingestComparativeRun(studyId, input) { return this.superiority.ingestComparativeRun(studyId, input); }
  evaluateComparativeStudy(studyId) { return this.superiority.evaluateComparativeStudy(studyId); }
  certifyLocalUi(input) { return this.superiority.certifyLocalUi(input); }
  createDogfoodSuite(input) { return this.superiority.createDogfoodSuite(input); }
  verifyDogfoodReceipt(suiteId, input) { return this.superiority.verifyDogfoodReceipt(suiteId, input); }
  evaluateDogfoodSuite(suiteId) { return this.superiority.evaluateDogfoodSuite(suiteId); }
  superioritySnapshot() { return this._superiority ? this._superiority.snapshot() : null; }

  snapshot() {
    const tasks = this._criteria ? [...this.taskIds].map((taskId) => this._criteria.snapshot(taskId)) : [];
    const totalCriteriaWeight = tasks.reduce((sum, item) => sum + item.totalCriteriaWeight, 0);
    const verifiedCriteriaScore = tasks.reduce((sum, item) => sum + item.verifiedCriteriaScore, 0);
    const criteriaBase = {
      schema: 'forge.decision-plane-criteria-projection.v1',
      tasks: tasks.map((item) => ({
        taskId: item.taskId,
        totalCriteriaWeight: item.totalCriteriaWeight,
        verifiedCriteriaScore: item.verifiedCriteriaScore,
        completionRatio: item.completionRatio,
        verifiedCriterionIds: item.criteria.filter((criterion) => criterion.verified).map((criterion) => criterion.criterionId),
        receiptSha256: item.receiptSha256,
      })),
      summary: { tasks: tasks.length, totalCriteriaWeight, verifiedCriteriaScore, completionRatio: totalCriteriaWeight ? verifiedCriteriaScore / totalCriteriaWeight : 0 },
    };
    const efficiency = this._efficiency.snapshot();
    const recentDecisions = this.decisionReceipts.slice(-100).reverse().map((item) => freeze({
      decisionId: item.decisionId,
      taskId: item.taskId,
      selectedEvidence: [...item.evidenceUsed].slice(0, 100),
      counterEvidence: [...item.counterEvidenceUsed].slice(0, 100),
      verifiedCriterionIds: [...(item.verification?.verifiedCriterionIds ?? [])].slice(0, 100),
      receiptSha256: item.receiptSha256,
      createdAtMs: item.createdAtMs,
    }));
    const base = {
      schema: 'forge.decision-plane-snapshot.v1',
      lifecycle: { closed: this.closed, criteriaLoaded: this._criteria !== null, tokenizerLoaded: this._tokenCost !== null, escalationLoaded: this._escalation !== null, cognitionLoaded: this._cognition !== null, constructionLoaded: this._construction !== null, verificationLoaded: this._verification !== null, memorySkillResourceLoaded: this._memorySkillResource !== null, collaborationExperienceLoaded: this._collaborationExperience !== null, securityCertificationLoaded: this._securityCertification !== null, worldDevelopmentLoaded: this._worldDevelopment !== null, frontierGovernanceLoaded: this._frontierGovernance !== null, verifiedMissionLoaded: this._verifiedMission !== null, localFrontierCompletionLoaded: this._localFrontierCompletion !== null, superiorityLoaded: this._superiority !== null },
      criteria: signed(criteriaBase),
      efficiency,
      recentDecisions,
      cognition: this._cognition ? this._cognition.snapshot() : null,
      construction: this._construction ? this._construction.snapshot() : null,
      verification: this._verification ? this._verification.snapshot() : null,
      memorySkillResource: this._memorySkillResource ? this._memorySkillResource.snapshot() : null,
      collaborationExperience: this._collaborationExperience ? this._collaborationExperience.snapshot() : null,
      securityCertification: this._securityCertification ? this._securityCertification.snapshot() : null,
      worldDevelopment: this._worldDevelopment ? this._worldDevelopment.snapshot() : null,
      frontierGovernance: this._frontierGovernance ? this._frontierGovernance.snapshot() : null,
      verifiedMission: this._verifiedMission ? this._verifiedMission.snapshot() : null,
      localFrontierCompletion: this._localFrontierCompletion ? this._localFrontierCompletion.snapshot() : null,
      superiority: this._superiority ? this._superiority.snapshot() : null,
      claims: {
        rawPromptsStored: false,
        modelOutputsStored: false,
        chainOfThoughtStored: false,
        verifiedCriteriaOnlyCreateValue: true,
        shadowMetricsChangeRouting: false,
        frontierSuperiorityClaimAllowed: false,
        proofCarryingMissionControl: this._superiority !== null,
        comparativeSuperiorityClaimAllowed: false,
      },
    };
    return signed(base);
  }

  close() { if (this._cognition) this._cognition.close(); if (this._construction) this._construction.close(); if (this._verification) this._verification.close(); if (this._memorySkillResource) this._memorySkillResource.close(); if (this._collaborationExperience) this._collaborationExperience.close(); if (this._securityCertification) this._securityCertification.close(); if (this._worldDevelopment) this._worldDevelopment.close(); if (this._frontierGovernance) this._frontierGovernance.close(); if (this._verifiedMission) this._verifiedMission.close(); if (this._localFrontierCompletion) this._localFrontierCompletion.close(); if (this._superiority) this._superiority.close(); this.closed = true; return this.snapshot(); }
  #assertOpen() { if (this.closed) throw new Error('Decision Plane is closed'); }
}
