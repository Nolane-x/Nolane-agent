import { signed } from '../frontier/frontier-utils.mjs';
import { CrossRepositoryWorkspaceMap } from '../frontier/cross-repository-workspace-map.mjs';
import { TransactionalChangePlanner } from '../frontier/transactional-change-planner.mjs';
import { SynchronizedCommitChain } from '../frontier/synchronized-commit-chain.mjs';
import { PostMergeSentinel } from '../frontier/post-merge-sentinel.mjs';
import { ChangeSurvivalLedger } from '../frontier/change-survival-ledger.mjs';
import { SelfHealingCoordinator } from '../frontier/self-healing-coordinator.mjs';
import { CulturalLineageLedger } from '../frontier/cultural-lineage-ledger.mjs';
import { SelfImprovementConstitution } from '../frontier/self-improvement-constitution.mjs';

export class FrontierGovernancePlane {
  constructor({ workspace = {}, planner = {}, commitChain = {}, sentinel = {}, survival = {}, selfHealing = {}, lineage = {}, constitution = {}, clock = () => Date.now() } = {}) {
    this.options = { workspace, planner, commitChain, sentinel, survival: { ...survival, clock: survival.clock ?? clock }, selfHealing: { ...selfHealing, clock: selfHealing.clock ?? clock }, lineage, constitution };
    this.closed = false;
    this._workspace = null;
    this._planner = null;
    this._commitChain = null;
    this._sentinel = null;
    this._survival = null;
    this._selfHealing = null;
    this._lineage = null;
    this._constitution = null;
  }

  #open() { if (this.closed) throw new Error('Frontier Governance Plane is closed'); }
  get workspace() { this.#open(); return this._workspace ??= new CrossRepositoryWorkspaceMap(this.options.workspace); }
  get planner() { this.#open(); return this._planner ??= new TransactionalChangePlanner(this.options.planner); }
  get commitChain() { this.#open(); return this._commitChain ??= new SynchronizedCommitChain(this.options.commitChain); }
  get sentinel() { this.#open(); return this._sentinel ??= new PostMergeSentinel(this.options.sentinel); }
  get survival() { this.#open(); return this._survival ??= new ChangeSurvivalLedger(this.options.survival); }
  get selfHealing() { this.#open(); return this._selfHealing ??= new SelfHealingCoordinator(this.options.selfHealing); }
  get lineage() { this.#open(); return this._lineage ??= new CulturalLineageLedger(this.options.lineage); }
  get constitution() { this.#open(); return this._constitution ??= new SelfImprovementConstitution(this.options.constitution); }

  registerRepository(input) { return this.workspace.registerRepository(input); }
  registerContract(input) { return this.workspace.registerContract(input); }
  linkDependency(input) { return this.workspace.linkDependency(input); }
  workspaceSnapshot() { return this._workspace ? this._workspace.snapshot() : null; }
  compileTransaction(input) { return this.planner.compile({ ...input, workspace: input.workspace ?? this.workspace.snapshot() }); }
  prepareCommitChain(plan, input) { return this.commitChain.prepare(plan, input); }
  recordPreparedCommit(chainId, input) { return this.commitChain.recordPreparedCommit(chainId, input); }
  recordCommitVerification(chainId, input) { return this.commitChain.recordVerification(chainId, input); }
  recordSynchronizedRollback(chainId, input) { return this.commitChain.recordRollback(chainId, input); }
  authorizeHumanMerge(chainId, input) { return this.commitChain.authorizeHumanMerge(chainId, input); }
  ingestPostMergeSignal(input) { return this.sentinel.ingestSignal(input); }
  tracePostMergeIncident(input) { return this.sentinel.traceIncident(input); }
  registerChangeSurvival(input) { return this.survival.registerChange(input); }
  observeChangeSurvival(changeId, input) { return this.survival.observe(changeId, input); }
  evaluateChangeSurvival(changeId) { return this.survival.evaluate(changeId); }
  changeSurvivalShadowCredit(changeId) { return this.survival.shadowCredit(changeId); }
  proposeSelfHealing(input) { return this.selfHealing.propose(input); }
  recordSelfHealingOutcome(proposalId, input) { return this.selfHealing.recordOutcome(proposalId, input); }
  registerCulturalLineage(input) { return this.lineage.register(input); }
  transitionCulturalLineage(artifactId, input) { return this.lineage.transition(artifactId, input); }
  evaluateSelfImprovementCandidate(input) { return this.constitution.evaluateCandidate(input); }
  recordSelfImprovementStage(candidateId, input) { return this.constitution.recordStage(candidateId, input); }
  authorizeSelfImprovementPromotion(candidateId, input) { return this.constitution.authorizePromotion(candidateId, input); }

  snapshot() {
    return signed({
      schema: 'forge.frontier-governance-plane.v1',
      lifecycle: {
        closed: this.closed,
        workspaceLoaded: this._workspace !== null,
        plannerLoaded: this._planner !== null,
        commitChainLoaded: this._commitChain !== null,
        sentinelLoaded: this._sentinel !== null,
        survivalLoaded: this._survival !== null,
        selfHealingLoaded: this._selfHealing !== null,
        lineageLoaded: this._lineage !== null,
        constitutionLoaded: this._constitution !== null,
      },
      workspace: this._workspace?.snapshot() ?? null,
      sentinel: this._sentinel?.snapshot() ?? null,
      survival: this._survival ? { configured: true, changes: this._survival.changes.size } : null,
      selfHealing: this._selfHealing?.snapshot() ?? null,
      lineage: this._lineage?.snapshot() ?? null,
      constitution: this._constitution?.snapshot() ?? null,
      claims: {
        autonomousMergeAllowed: false,
        autonomousPublishAllowed: false,
        productionPolicyPromotionAllowed: false,
        autonomyExpansionAllowed: false,
        rawCommandStored: false,
        rawOutputStored: false,
        chainOfThoughtStored: false,
        frontierSuperiorityClaimAllowed: false,
      },
    });
  }

  close() { this.closed = true; return this.snapshot(); }
}
