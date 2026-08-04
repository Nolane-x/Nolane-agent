import { boundedArray, sha, signed, text } from './frontier-utils.mjs';

function topologicalOrder(repositoryIds, dependencies) {
  const ids = new Set(repositoryIds);
  const indegree = new Map([...ids].map((id) => [id, 0]));
  const outgoing = new Map([...ids].map((id) => [id, []]));
  for (const edge of dependencies) {
    if (!ids.has(edge.fromRepositoryId) || !ids.has(edge.toRepositoryId)) continue;
    // dependency must be changed before dependent: to -> from
    outgoing.get(edge.toRepositoryId).push(edge.fromRepositoryId);
    indegree.set(edge.fromRepositoryId, (indegree.get(edge.fromRepositoryId) ?? 0) + 1);
  }
  const queue = [...ids].filter((id) => indegree.get(id) === 0).sort();
  const order = [];
  while (queue.length) {
    const current = queue.shift(); order.push(current);
    for (const next of outgoing.get(current).sort()) {
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) { queue.push(next); queue.sort(); }
    }
  }
  return order.length === ids.size ? order : null;
}

export class TransactionalChangePlanner {
  constructor({ maxChanges = 64 } = {}) { this.maxChanges = maxChanges; }

  compile(input = {}) {
    const workspace = input.workspace;
    if (!workspace || workspace.schema !== 'forge.cross-repository-workspace-map.v1') throw new TypeError('workspace snapshot is required');
    const planId = text(input.planId, 'planId', 200);
    const rawChanges = boundedArray(input.changes ?? [], 'changes', this.maxChanges);
    if (rawChanges.length < 1) throw new TypeError('changes are required');
    const byRepository = new Map(workspace.repositories.map((repo) => [repo.repositoryId, repo]));
    const changeMap = new Map();
    for (const item of rawChanges) {
      const repositoryId = text(item.repositoryId, 'changes.repositoryId', 160);
      if (!byRepository.has(repositoryId)) throw new RangeError(`unknown repository in change plan: ${repositoryId}`);
      if (changeMap.has(repositoryId)) throw new TypeError(`duplicate repository change: ${repositoryId}`);
      changeMap.set(repositoryId, {
        repositoryId,
        baselineSha256: sha(item.baselineSha256, 'baselineSha256'),
        rollbackRef: item.rollbackRef ? text(item.rollbackRef, 'rollbackRef', 240) : null,
        verificationCommandId: item.verificationCommandId ? text(item.verificationCommandId, 'verificationCommandId', 160) : null,
        targetVersion: text(item.targetVersion, 'targetVersion', 128),
      });
    }
    const order = topologicalOrder([...changeMap.keys()], workspace.dependencies);
    const blockers = [];
    if (!order) blockers.push('dependency-cycle-unresolved');
    const rollbackComplete = [...changeMap.values()].every((item) => item.rollbackRef && item.baselineSha256);
    const verificationComplete = [...changeMap.values()].every((item) => item.verificationCommandId);
    if (!rollbackComplete) blockers.push('rollback-coverage-incomplete');
    if (!verificationComplete) blockers.push('verification-coverage-incomplete');
    const compatibilityWindows = boundedArray(input.compatibilityWindows ?? [], 'compatibilityWindows', 128).map((item) => ({
      windowId: text(item.windowId, 'windowId', 120), contractId: text(item.contractId, 'contractId', 200),
      intermediateVersion: text(item.intermediateVersion, 'intermediateVersion', 128),
      expiresAfterStep: text(item.expiresAfterStep, 'expiresAfterStep', 160),
    }));
    for (const edge of workspace.dependencies) {
      if (!changeMap.has(edge.fromRepositoryId) || !changeMap.has(edge.toRepositoryId)) continue;
      if (edge.compatibility?.windowId && !compatibilityWindows.some((item) => item.windowId === edge.compatibility.windowId)) blockers.push(`missing-compatibility-window:${edge.compatibility.windowId}`);
    }
    const orderedIds = order ?? [...changeMap.keys()].sort();
    const steps = orderedIds.map((repositoryId, index) => ({ ...changeMap.get(repositoryId), order: index + 1, dependencyRepositoryIds: workspace.dependencies.filter((edge) => edge.fromRepositoryId === repositoryId && changeMap.has(edge.toRepositoryId)).map((edge) => edge.toRepositoryId).sort() }));
    const transactional = blockers.length === 0;
    return signed({
      schema: 'forge.transactional-cross-repository-plan.v1', planId,
      workspaceReceiptSha256: sha(workspace.receiptSha256, 'workspaceReceiptSha256'),
      transactional, allOrRollback: transactional && rollbackComplete,
      blockers: [...new Set(blockers)].sort(), steps,
      intermediateContracts: compatibilityWindows,
      verificationCheckpoints: steps.map((step) => ({ repositoryId: step.repositoryId, verificationCommandId: step.verificationCommandId })),
      rollbackSequence: [...steps].reverse().map((step) => ({ repositoryId: step.repositoryId, rollbackRef: step.rollbackRef })),
      claims: { commitsCreated: false, mergeAllowed: false, publishAllowed: false },
    });
  }
}
