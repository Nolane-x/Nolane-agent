import { finite, sha, signed, text } from './frontier-utils.mjs';

export class SelfHealingCoordinator {
  constructor({ adapter, clock = () => Date.now(), maxProposals = 500 } = {}) {
    if (!adapter || typeof adapter.resetToBaseline !== 'function' || typeof adapter.createWorktree !== 'function') throw new TypeError('self-healing adapter with resetToBaseline and createWorktree is required');
    this.adapter = adapter; this.clock = typeof clock === 'function' ? clock : () => Date.now(); this.maxProposals = maxProposals; this.proposals = new Map();
  }

  async propose(input = {}) {
    if (this.proposals.size >= this.maxProposals) throw new RangeError('self-healing proposal limit exceeded');
    const proposalId = text(input.proposalId, 'proposalId', 200);
    if (this.proposals.has(proposalId)) throw new TypeError(`duplicate proposal: ${proposalId}`);
    const incident = input.incidentTrace;
    if (!incident || incident.status !== 'attributed' || incident.selfHealingEligible !== true) throw new Error('incident must be directly attributed and self-healing eligible');
    const relationConfidence = finite(input.relationConfidence, 'relationConfidence', 0, 1);
    if (relationConfidence < 0.8) throw new Error('direct relation confidence is insufficient');
    const baselineSha256 = sha(input.baselineSha256, 'baselineSha256');
    const regressionTestId = text(input.regressionTestId, 'regressionTestId', 240);
    const rollbackRef = text(input.rollbackRef, 'rollbackRef', 300);
    const leaseMs = finite(input.leaseMs, 'leaseMs', 1_000, 86_400_000);
    const reset = await this.adapter.resetToBaseline({ proposalId, baselineSha256, incidentReceiptSha256: sha(incident.receiptSha256, 'incidentReceiptSha256') });
    if (reset?.status !== 'clean') throw new Error('baseline reset did not produce a clean workspace');
    const resetReceiptSha256 = sha(reset.receiptSha256, 'resetReceiptSha256');
    const worktree = await this.adapter.createWorktree({ proposalId, baselineSha256, regressionTestId, rollbackRef, leaseMs, incidentId: incident.incidentId });
    if (worktree?.status !== 'created') throw new Error('self-healing worktree was not created');
    const worktreeReceiptSha256 = sha(worktree.receiptSha256, 'worktreeReceiptSha256');
    const state = signed({
      schema: 'forge.self-healing-proposal.v1', proposalId, status: 'proposed', incidentId: incident.incidentId,
      incidentReceiptSha256: incident.receiptSha256, relationConfidence, baselineSha256,
      regressionTestId, rollbackRef, lease: { startsAtMs: finite(this.clock(), 'clock', 0), leaseMs },
      worktreeId: text(worktree.worktreeId, 'worktreeId', 200), resetReceiptSha256, worktreeReceiptSha256,
      claims: { mergeAllowed: false, publishAllowed: false, autonomousRepairApplied: false, rawCommandStored: false, rawOutputStored: false },
    });
    this.proposals.set(proposalId, state);
    return state;
  }

  recordOutcome(proposalId, input = {}) {
    const id = text(proposalId, 'proposalId', 200); const proposal = this.proposals.get(id); if (!proposal) throw new RangeError(`unknown proposal: ${id}`);
    const status = text(input.status, 'status', 40); if (!['verified', 'failed', 'rolled-back'].includes(status)) throw new TypeError('unsupported self-healing outcome');
    const outcome = signed({ schema: 'forge.self-healing-outcome.v1', proposalId: id, status, verificationReceiptSha256: sha(input.verificationReceiptSha256, 'verificationReceiptSha256'), rollbackReceiptSha256: input.rollbackReceiptSha256 ? sha(input.rollbackReceiptSha256, 'rollbackReceiptSha256') : null, claims: { mergeExecuted: false, publishExecuted: false } });
    this.proposals.set(id, signed({ ...proposal, status, outcome }));
    return outcome;
  }

  snapshot() { return signed({ schema: 'forge.self-healing-coordinator.v1', proposals: [...this.proposals.values()].slice(-100), claims: { mergeAllowed: false, publishAllowed: false, rawOutputStored: false } }); }
}
