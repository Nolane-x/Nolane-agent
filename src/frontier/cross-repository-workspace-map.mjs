import { boundedArray, optionalText, sha, signed, text } from './frontier-utils.mjs';

function keyEdge(from, to) { return `${from}->${to}`; }

export class CrossRepositoryWorkspaceMap {
  constructor({ maxRepositories = 64, maxContracts = 512, maxEdges = 2048 } = {}) {
    this.maxRepositories = maxRepositories;
    this.maxContracts = maxContracts;
    this.maxEdges = maxEdges;
    this.repositories = new Map();
    this.contracts = new Map();
    this.dependencies = new Map();
  }

  registerRepository(input = {}) {
    const repositoryId = text(input.repositoryId, 'repositoryId', 160);
    if (this.repositories.has(repositoryId)) throw new TypeError(`duplicate repository: ${repositoryId}`);
    if (this.repositories.size >= this.maxRepositories) throw new RangeError('repository limit exceeded');
    const repository = signed({
      schema: 'forge.cross-repository-node.v1', repositoryId,
      version: text(input.version, 'version', 128),
      fingerprintSha256: sha(input.fingerprintSha256, 'fingerprintSha256'),
      owner: text(input.owner, 'owner', 160), role: text(input.role, 'role', 80),
      workspaceRootHash: input.workspaceRootHash ? sha(input.workspaceRootHash, 'workspaceRootHash') : null,
      metadata: input.metadata && typeof input.metadata === 'object' ? structuredClone(input.metadata) : {},
    });
    this.repositories.set(repositoryId, repository);
    return repository;
  }

  registerContract(input = {}) {
    const contractId = text(input.contractId, 'contractId', 200);
    if (this.contracts.has(contractId)) throw new TypeError(`duplicate contract: ${contractId}`);
    if (this.contracts.size >= this.maxContracts) throw new RangeError('contract limit exceeded');
    const repositoryId = text(input.repositoryId, 'repositoryId', 160);
    if (!this.repositories.has(repositoryId)) throw new RangeError(`unknown repository: ${repositoryId}`);
    const contract = signed({
      schema: 'forge.cross-repository-contract.v1', contractId, repositoryId,
      version: text(input.version, 'version', 128), kind: text(input.kind, 'kind', 80),
      fingerprintSha256: sha(input.fingerprintSha256, 'fingerprintSha256'),
      compatibilityPolicy: optionalText(input.compatibilityPolicy, 'compatibilityPolicy', 500),
    });
    this.contracts.set(contractId, contract);
    return contract;
  }

  linkDependency(input = {}) {
    if (this.dependencies.size >= this.maxEdges) throw new RangeError('dependency edge limit exceeded');
    const fromRepositoryId = text(input.fromRepositoryId, 'fromRepositoryId', 160);
    const toRepositoryId = text(input.toRepositoryId, 'toRepositoryId', 160);
    if (fromRepositoryId === toRepositoryId) throw new TypeError('self dependency is forbidden');
    if (!this.repositories.has(fromRepositoryId) || !this.repositories.has(toRepositoryId)) throw new RangeError('dependency repository is unknown');
    const contractId = input.contractId == null ? null : text(input.contractId, 'contractId', 200);
    if (contractId && !this.contracts.has(contractId)) throw new RangeError(`unknown contract: ${contractId}`);
    const compatibility = input.compatibility && typeof input.compatibility === 'object'
      ? { mode: optionalText(input.compatibility.mode, 'compatibility.mode', 40), windowId: optionalText(input.compatibility.windowId, 'compatibility.windowId', 120) }
      : { mode: null, windowId: null };
    const cycleAllowed = compatibility.mode === 'dual' && compatibility.windowId != null;
    if (this.#hasPath(toRepositoryId, fromRepositoryId) && !cycleAllowed) throw new Error('dependency cycle requires an explicit dual compatibility window');
    const key = keyEdge(fromRepositoryId, toRepositoryId);
    if (this.dependencies.has(key)) throw new TypeError(`duplicate dependency: ${key}`);
    const edge = signed({
      schema: 'forge.cross-repository-dependency.v1', fromRepositoryId, toRepositoryId, contractId,
      requiredVersion: text(input.requiredVersion, 'requiredVersion', 128), compatibility,
      provenanceReceiptSha256: input.provenanceReceiptSha256 ? sha(input.provenanceReceiptSha256, 'provenanceReceiptSha256') : null,
    });
    this.dependencies.set(key, edge);
    return edge;
  }

  snapshot() {
    return signed({
      schema: 'forge.cross-repository-workspace-map.v1',
      repositories: [...this.repositories.values()].sort((a, b) => a.repositoryId.localeCompare(b.repositoryId)),
      contracts: [...this.contracts.values()].sort((a, b) => a.contractId.localeCompare(b.contractId)),
      dependencies: [...this.dependencies.values()].sort((a, b) => keyEdge(a.fromRepositoryId, a.toRepositoryId).localeCompare(keyEdge(b.fromRepositoryId, b.toRepositoryId))),
      claims: { crossRepositoryTransactionExecuted: false, repositoryContentsStored: false, rawGitOutputStored: false },
    });
  }

  #hasPath(start, target) {
    const stack = [start]; const seen = new Set();
    while (stack.length) {
      const current = stack.pop();
      if (current === target) return true;
      if (seen.has(current)) continue;
      seen.add(current);
      for (const edge of this.dependencies.values()) if (edge.fromRepositoryId === current) stack.push(edge.toRepositoryId);
    }
    return false;
  }
}
