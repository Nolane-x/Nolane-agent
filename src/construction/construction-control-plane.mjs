import path from 'node:path';

import { compileSpecification } from './specification-compiler.mjs';
import { RequirementTraceabilityLedger } from './requirement-traceability-ledger.mjs';
import { InvariantLedger } from './invariant-ledger.mjs';
import { ExecutablePlanEngine } from './executable-plan-engine.mjs';
import { StateCapsuleStore } from './state-capsule-store.mjs';
import { ProspectiveObligationLedger } from './prospective-obligation-ledger.mjs';
import { GoalConflictResolver } from './goal-conflict-resolver.mjs';
import { analyzeSemanticPatch } from './semantic-patch-analyzer.mjs';
import { derivePatchBudget } from './dynamic-patch-budget.mjs';
import { selectVerificationStages } from './test-impact-selector.mjs';
import { selectCandidate } from './candidate-patch-selector.mjs';
import { buildCompletionProof } from './completion-proof-builder.mjs';
import { signed, text } from './construction-utils.mjs';
import { ConstructionContractRuntime } from './construction-contract-runtime.mjs';
import { SemanticChangeSafetyRuntime } from './semantic-change-safety-runtime.mjs';

export class ConstructionControlPlane {
  constructor({ workspaceRoot = process.cwd(), capsuleRoot = path.join(process.cwd(), '.forge', 'state-capsules'), safetyStateRoot = path.join(process.cwd(), '.forge', 'construction-safety'), limits = {} } = {}) {
    this.closed = false;
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.safetyStateRoot = path.resolve(safetyStateRoot);
    this._contractRuntime = null;
    this._changeSafety = null;
    this.specifications = new Map();
    this.traceability = new Map();
    this.invariants = new Map();
    this.planEngine = new ExecutablePlanEngine({ maxPlans: limits.maxPlans, maxStepsPerPlan: limits.maxStepsPerPlan });
    this.capsules = new StateCapsuleStore({ root: capsuleRoot, maxBytes: limits.maxCapsuleBytes });
    this.obligations = new ProspectiveObligationLedger({ maxObligations: limits.maxObligations });
    this.goalResolver = new GoalConflictResolver();
  }


  get contractRuntime() { this.#assertOpen(); return this._contractRuntime ??= new ConstructionContractRuntime({ workspaceRoot: this.workspaceRoot, stateRoot: this.safetyStateRoot }); }
  get changeSafety() { this.#assertOpen(); return this._changeSafety ??= new SemanticChangeSafetyRuntime(); }

  compileConstructionContract(input) { return this.contractRuntime.compileContract(input); }
  createVerticalPlan(input) { return this.contractRuntime.createVerticalPlan(input); }
  replanVerticalPlan(input) { return this.contractRuntime.replan(input); }
  bindConstructionOwnership(input) { return this.contractRuntime.bindOwnership(input); }
  launchConstructionCandidates(input) { return this.contractRuntime.launchCandidates(input); }
  cleanupConstructionCandidates(input) { return this.contractRuntime.cleanupCandidates(input); }
  saveExactConstructionState(input) { return this.contractRuntime.saveState(input); }
  restoreExactConstructionState(capsuleId, currentState) { return this.contractRuntime.restoreState(capsuleId, currentState); }
  semanticApiDiff(input) { return this.changeSafety.diffApi(input); }
  semanticBlastRadius(input) { return this.changeSafety.blastRadius(input); }
  findExistingAbstraction(input) { return this.changeSafety.detectExistingAbstraction(input); }
  migrationImpact(input) { return this.changeSafety.migrationImpact(input); }
  comparePatchCandidates(input) { return this.changeSafety.compareCandidates(input); }
  requirePatchReview(input) { return this.changeSafety.reviewGate(input); }

  compileSpecification(input) {
    this.#assertOpen();
    const specification = compileSpecification(input);
    if (this.specifications.has(specification.specificationId)) throw new TypeError(`duplicate construction specification: ${specification.specificationId}`);
    this.specifications.set(specification.specificationId, specification);

    const trace = new RequirementTraceabilityLedger();
    trace.registerSpecification(specification);
    this.traceability.set(specification.specificationId, trace);

    const invariantLedger = new InvariantLedger();
    for (const invariant of specification.invariants) invariantLedger.register({
      invariantId: invariant.invariantId,
      owner: specification.specificationId,
      severity: invariant.severity,
      verifierId: invariant.verifierId,
      protectedScopes: ['**'],
      sourceHash: specification.receiptSha256,
      statement: invariant.statement,
    });
    this.invariants.set(specification.specificationId, invariantLedger);
    return specification;
  }

  createPlan(input = {}) {
    this.#assertOpen();
    const specification = this.#specification(input.specificationId);
    if (specification.status !== 'ready' || specification.editAuthorized !== true) throw new Error(`Cannot create plan for blocked specification: ${specification.specificationId}`);
    return this.planEngine.createPlan(input);
  }
  transitionPlan(planId, stepId, event) { this.#assertOpen(); return this.planEngine.transition(planId, stepId, event); }
  revalidatePlan(planId, evidence) { this.#assertOpen(); return this.planEngine.revalidate(planId, evidence); }
  planSnapshot(planId) { this.#assertOpen(); return this.planEngine.snapshot(planId); }

  registerTraceNode(specificationId, input) { this.#assertOpen(); return this.#trace(specificationId).registerNode(input); }
  linkTrace(specificationId, input) { this.#assertOpen(); return this.#trace(specificationId).link(input); }
  criterionCompletion(specificationId, criterionId, input) { this.#assertOpen(); return this.#trace(specificationId).criterionCompletion(criterionId, input); }
  traceabilitySnapshot(specificationId) { this.#assertOpen(); return this.#trace(specificationId).snapshot(); }

  verifyInvariant(specificationId, invariantId, receipt) { this.#assertOpen(); return this.#invariantLedger(specificationId).recordVerification(invariantId, receipt); }
  authorizeInvariants(specificationId, input) { this.#assertOpen(); return this.#invariantLedger(specificationId).authorize(input); }
  invariantSnapshot(specificationId) { this.#assertOpen(); return this.#invariantLedger(specificationId).snapshot(); }

  saveCapsule(input) { this.#assertOpen(); return this.capsules.save(input); }
  resumeCapsule(capsuleId, currentState) { this.#assertOpen(); return this.capsules.resume(capsuleId, currentState); }
  registerObligation(input) { this.#assertOpen(); return this.obligations.register(input); }
  observeObligation(input) { this.#assertOpen(); return this.obligations.observe(input); }
  completeObligation(obligationId, input) { this.#assertOpen(); return this.obligations.complete(obligationId, input); }
  resolveGoalConflict(input) { this.#assertOpen(); return this.goalResolver.resolve(input); }

  analyzePatch(input = {}) {
    this.#assertOpen();
    const budget = derivePatchBudget(input);
    const report = analyzeSemanticPatch(input);
    const reasons = [];
    if (!report.allowed) reasons.push(...report.blockingFindings);
    if (report.changedFiles > budget.maxFiles) reasons.push('file-budget-exceeded');
    if (report.changedLines > budget.maxChangedLines) reasons.push('changed-line-budget-exceeded');
    if (input.opportunisticRefactor === true && String(input.taskKind ?? 'bugfix') === 'bugfix') reasons.push('opportunistic-refactor-forbidden');
    const authorization = signed({
      schema: 'forge.semantic-patch-authorization.v1',
      allowed: reasons.length === 0,
      reasons: [...new Set(reasons)],
      semanticPatchReceiptSha256: report.receiptSha256,
      patchBudgetReceiptSha256: budget.receiptSha256,
      claims: { directFileMutation: false, textualDiffIsSoleRiskMetric: false },
    });
    return signed({ schema: 'forge.construction-patch-assessment.v1', report, budget, authorization });
  }

  selectVerification(input) { this.#assertOpen(); return selectVerificationStages(input); }
  selectCandidate(input) { this.#assertOpen(); return selectCandidate(input); }
  buildCompletionProof(input) { this.#assertOpen(); return buildCompletionProof(input); }

  snapshot() {
    const base = {
      schema: 'forge.construction-control-plane.v1',
      lifecycle: {
        closed: this.closed,
        specifications: this.specifications.size,
        traceabilityLedgers: this.traceability.size,
        invariantLedgers: this.invariants.size,
        plans: this.planEngine.plans.size,
        contractRuntimeLoaded: this._contractRuntime !== null,
        changeSafetyLoaded: this._changeSafety !== null,
      },
      specifications: [...this.specifications.values()].map((item) => ({ specificationId: item.specificationId, status: item.status, receiptSha256: item.receiptSha256 })),
      obligations: this.obligations.snapshot(),
      claims: {
        directFileMutation: false,
        privateReasoningStored: false,
        worktreesCreatedDirectly: false,
        criteriaWeakened: false,
        candidateWorktreesCreatedByLegacyPlane: false,
      },
    };
    return signed(base);
  }

  close() { this.closed = true; return this.snapshot(); }

  #specification(specificationId) {
    const id = text(specificationId, 'specificationId', 256);
    const value = this.specifications.get(id);
    if (!value) throw new RangeError(`unknown construction specification: ${id}`);
    return value;
  }
  #trace(specificationId) { this.#specification(specificationId); return this.traceability.get(String(specificationId)); }
  #invariantLedger(specificationId) { this.#specification(specificationId); return this.invariants.get(String(specificationId)); }
  #assertOpen() { if (this.closed) throw new Error('Construction Control Plane is closed'); }
}
