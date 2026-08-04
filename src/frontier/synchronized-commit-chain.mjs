import { boundedArray, sha, signed, text } from './frontier-utils.mjs';

export class SynchronizedCommitChain {
  constructor({ maxChains = 256 } = {}) { this.maxChains = maxChains; this.chains = new Map(); }

  prepare(plan, input = {}) {
    if (!plan || plan.transactional !== true || !Array.isArray(plan.steps) || plan.steps.length === 0) throw new TypeError('transactional plan is required');
    if (this.chains.size >= this.maxChains) throw new RangeError('commit chain limit exceeded');
    const chainId = text(input.chainId, 'chainId', 200);
    if (this.chains.has(chainId)) throw new TypeError(`duplicate chain: ${chainId}`);
    const state = { chainId, planId: text(plan.planId, 'planId', 200), planReceiptSha256: sha(plan.receiptSha256, 'planReceiptSha256'), actor: text(input.actor, 'actor', 160), status: 'prepared', repositories: new Map(plan.steps.map((step) => [step.repositoryId, { repositoryId: step.repositoryId, baselineSha256: step.baselineSha256, rollbackRef: step.rollbackRef, verificationCommandId: step.verificationCommandId, commit: null, verification: null }])), rollbacks: [], mergeApproval: null };
    this.chains.set(chainId, state);
    return this.#snapshot(state);
  }

  recordPreparedCommit(chainId, input = {}) {
    const state = this.#chain(chainId); const repositoryId = text(input.repositoryId, 'repositoryId', 160);
    const repo = state.repositories.get(repositoryId); if (!repo) throw new RangeError(`unknown repository: ${repositoryId}`);
    const baselineSha256 = sha(input.baselineSha256, 'baselineSha256');
    if (baselineSha256 !== repo.baselineSha256) throw new Error(`baseline mismatch for ${repositoryId}`);
    repo.commit = signed({ schema: 'forge.prepared-cross-repository-commit.v1', repositoryId, baselineSha256, commitSha256: sha(input.commitSha256, 'commitSha256'), provenanceReceiptSha256: sha(input.provenanceReceiptSha256, 'provenanceReceiptSha256'), rollbackCommitSha256: sha(input.rollbackCommitSha256, 'rollbackCommitSha256') });
    state.status = 'commits-prepared';
    return this.#snapshot(state);
  }

  recordVerification(chainId, input = {}) {
    const state = this.#chain(chainId); const repositoryId = text(input.repositoryId, 'repositoryId', 160);
    const repo = state.repositories.get(repositoryId); if (!repo?.commit) throw new Error(`prepared commit required for ${repositoryId}`);
    const status = text(input.status, 'status', 20); if (!['pass','fail'].includes(status)) throw new TypeError('verification status must be pass or fail');
    repo.verification = signed({ schema: 'forge.cross-repository-verification.v1', repositoryId, status, receiptSha256Source: sha(input.receiptSha256, 'receiptSha256') });
    state.status = status === 'fail' ? 'verification-failed' : 'verification-running';
    return this.#snapshot(state);
  }

  recordRollback(chainId, input = {}) {
    const state = this.#chain(chainId);
    const repositoryIds = boundedArray(input.repositoryIds ?? [], 'repositoryIds', state.repositories.size).map((id) => text(id, 'repositoryId', 160));
    if (repositoryIds.length !== state.repositories.size || repositoryIds.some((id) => !state.repositories.has(id))) throw new Error('rollback must cover every repository in the chain');
    const rollback = signed({ schema: 'forge.synchronized-rollback.v1', repositoryIds: [...repositoryIds].sort(), reason: text(input.reason, 'reason', 300), sourceReceiptSha256: sha(input.receiptSha256, 'receiptSha256'), status: 'rolled-back' });
    state.rollbacks.push(rollback); state.status = 'rolled-back';
    return rollback;
  }

  authorizeHumanMerge(chainId, input = {}) {
    const state = this.#chain(chainId);
    if (input.approved !== true) throw new Error('human approval is required');
    for (const repo of state.repositories.values()) {
      if (!repo.commit) throw new Error(`prepared commit missing for ${repo.repositoryId}`);
      if (repo.verification?.status !== 'pass') throw new Error(`passing verification missing for ${repo.repositoryId}`);
    }
    state.mergeApproval = signed({ schema: 'forge.human-merge-approval.v1', approved: true, actor: text(input.actor, 'actor', 160), sourceReceiptSha256: sha(input.receiptSha256, 'receiptSha256') });
    state.status = 'ready-for-human-merge';
    return this.#snapshot(state);
  }

  snapshot(chainId) { return this.#snapshot(this.#chain(chainId)); }

  #chain(chainId) { const id = text(chainId, 'chainId', 200); const state = this.chains.get(id); if (!state) throw new RangeError(`unknown chain: ${id}`); return state; }
  #snapshot(state) {
    return signed({
      schema: 'forge.synchronized-commit-chain.v1', chainId: state.chainId, planId: state.planId, planReceiptSha256: state.planReceiptSha256,
      actor: state.actor, status: state.status,
      repositories: [...state.repositories.values()].map((repo) => ({ repositoryId: repo.repositoryId, baselineSha256: repo.baselineSha256, rollbackRef: repo.rollbackRef, verificationCommandId: repo.verificationCommandId, commit: repo.commit, verification: repo.verification })).sort((a,b)=>a.repositoryId.localeCompare(b.repositoryId)),
      rollbacks: state.rollbacks, mergeApproval: state.mergeApproval,
      claims: { autonomousMergeAllowed: false, publishAllowed: false, gitExecutedDirectly: false },
    });
  }
}
