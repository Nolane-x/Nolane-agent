import { boundedArray, sha, signed, text } from './completion-utils.mjs';

const KINDS = new Set(['rename', 'move', 'type', 'nullability', 'scope', 'serialization', 'database-mapping']);

function normalizePath(value, label = 'path') { return text(value, label, 4_096).replaceAll('\\', '/').replace(/^\.\//, ''); }
function citation(value, label = 'citation') {
  if (!value || typeof value !== 'object') throw new TypeError(`${label} is required`);
  const path = normalizePath(value.path, `${label}.path`);
  const startLine = Math.max(1, Math.floor(Number(value.startLine) || 1));
  const endLine = Math.max(startLine, Math.floor(Number(value.endLine) || startLine));
  return { path, startLine, endLine, sourceHash: sha(value.sourceHash, `${label}.sourceHash`) };
}
function optional(value, label, max = 512) { return value == null || String(value).trim() === '' ? null : text(value, label, max); }
function stateSignature(state) {
  return JSON.stringify({ symbol: state.symbol, path: state.path, type: state.type, nullable: state.nullable, scope: state.scope, serializationName: state.serializationName, databaseMapping: state.databaseMapping });
}
function publicRecord(record) {
  return signed({
    schema: 'forge.variable-lineage.v1',
    repositoryId: record.repositoryId,
    branch: record.branch,
    bindingId: record.bindingId,
    current: structuredClone(record.current),
    origins: structuredClone(record.origins),
    transitions: structuredClone(record.transitions),
    claims: { identityInferredWithoutEvidence: false, branchCrossingAllowed: false, ambiguousResolutionHidden: false },
  });
}

export class VariableLineageService {
  constructor({ maximumBindings = 100_000, maximumTransitionsPerBinding = 10_000 } = {}) {
    this.maximumBindings = Math.max(1, Math.min(1_000_000, Math.floor(Number(maximumBindings) || 100_000)));
    this.maximumTransitionsPerBinding = Math.max(1, Math.min(100_000, Math.floor(Number(maximumTransitionsPerBinding) || 10_000)));
    this.bindings = new Map();
  }

  registerBinding(input = {}) {
    if (this.bindings.size >= this.maximumBindings) throw new RangeError('variable lineage binding budget exceeded');
    const bindingId = text(input.bindingId, 'bindingId', 512);
    if (this.bindings.has(bindingId)) throw new Error(`duplicate binding: ${bindingId}`);
    const initialCitation = citation(input.citation);
    const current = {
      symbol: text(input.symbol, 'symbol', 512),
      path: normalizePath(input.path),
      type: text(input.type, 'type', 1_000),
      nullable: input.nullable === true,
      scope: text(input.scope, 'scope', 512),
      serializationName: optional(input.serializationName, 'serializationName', 1_000),
      databaseMapping: optional(input.databaseMapping, 'databaseMapping', 1_000),
      sourceHash: initialCitation.sourceHash,
      citation: initialCitation,
    };
    const record = {
      repositoryId: text(input.repositoryId, 'repositoryId', 512),
      branch: text(input.branch, 'branch', 512),
      bindingId,
      current,
      origins: [structuredClone(current)],
      transitions: [],
      transitionIds: new Set(),
      signatures: new Set([stateSignature(current)]),
    };
    this.bindings.set(bindingId, record);
    return publicRecord(record);
  }

  transitionBinding(bindingIdValue, input = {}) {
    const bindingId = text(bindingIdValue, 'bindingId', 512);
    const record = this.bindings.get(bindingId); if (!record) throw new RangeError(`binding not found: ${bindingId}`);
    if (record.transitions.length >= this.maximumTransitionsPerBinding) throw new RangeError('variable lineage transition budget exceeded');
    const transitionId = text(input.transitionId, 'transitionId', 512);
    if (record.transitionIds.has(transitionId)) throw new Error(`duplicate transition: ${transitionId}`);
    const branch = text(input.branch, 'branch', 512); if (branch !== record.branch) throw new Error(`branch mismatch: expected ${record.branch}, received ${branch}`);
    const kind = text(input.kind, 'kind', 64); if (!KINDS.has(kind)) throw new TypeError(`unsupported transition kind: ${kind}`);
    const beforeSourceHash = sha(input.beforeSourceHash, 'beforeSourceHash'); const afterSourceHash = sha(input.afterSourceHash, 'afterSourceHash');
    if (beforeSourceHash !== record.current.sourceHash) throw new Error(`stale source hash: expected ${record.current.sourceHash}, received ${beforeSourceHash}`);
    const transitionCitation = citation(input.citation);
    if (transitionCitation.sourceHash !== afterSourceHash) throw new Error('citation source hash must equal afterSourceHash');

    const next = structuredClone(record.current);
    if (kind === 'rename') next.symbol = text(input.symbol, 'symbol', 512);
    if (kind === 'move') next.path = normalizePath(input.path);
    if (kind === 'type') {
      const nextType = text(input.type, 'type', 1_000);
      if (nextType !== next.type) {
        const evidence = boundedArray(input.compatibilityEvidence ?? [], 'compatibilityEvidence', 128).map((item, index) => citation(item, `compatibilityEvidence[${index}]`));
        if (input.compatible !== true || evidence.length === 0) throw new Error('type transition requires explicit compatibility evidence');
      }
      next.type = nextType;
    }
    if (kind === 'nullability') {
      if (typeof input.nullable !== 'boolean') throw new TypeError('nullable must be boolean');
      next.nullable = input.nullable;
    }
    if (kind === 'scope') next.scope = text(input.scope, 'scope', 512);
    if (kind === 'serialization') next.serializationName = optional(input.serializationName, 'serializationName', 1_000);
    if (kind === 'database-mapping') next.databaseMapping = optional(input.databaseMapping, 'databaseMapping', 1_000);
    next.sourceHash = afterSourceHash; next.citation = transitionCitation;

    const signature = stateSignature(next);
    if (record.signatures.has(signature)) throw new Error('variable lineage cycle detected');
    const compatibilityEvidence = kind === 'type' ? boundedArray(input.compatibilityEvidence ?? [], 'compatibilityEvidence', 128).map((item, index) => citation(item, `compatibilityEvidence[${index}]`)) : [];
    const event = {
      transitionId, kind, branch, beforeSourceHash, afterSourceHash,
      before: structuredClone(record.current), after: structuredClone(next), citation: transitionCitation,
      compatible: kind === 'type' ? input.compatible === true : null,
      compatibilityEvidence,
    };
    record.transitionIds.add(transitionId); record.signatures.add(signature); record.transitions.push(event); record.origins.push(structuredClone(next)); record.current = next;
    return publicRecord(record);
  }

  resolve(input = {}) {
    const repositoryId = text(input.repositoryId, 'repositoryId', 512); const branch = text(input.branch, 'branch', 512);
    const query = {
      symbol: optional(input.symbol, 'symbol', 512),
      path: input.path == null ? null : normalizePath(input.path),
      serializationName: optional(input.serializationName, 'serializationName', 1_000),
      databaseMapping: optional(input.databaseMapping, 'databaseMapping', 1_000),
    };
    if (!Object.values(query).some((value) => value != null)) throw new TypeError('at least one binding selector is required');
    const matches = [];
    for (const record of this.bindings.values()) {
      if (record.repositoryId !== repositoryId || record.branch !== branch) continue;
      const matchedStates = record.origins.filter((state) => (query.symbol == null || state.symbol === query.symbol) && (query.path == null || state.path === query.path) && (query.serializationName == null || state.serializationName === query.serializationName) && (query.databaseMapping == null || state.databaseMapping === query.databaseMapping));
      if (matchedStates.length) matches.push({ bindingId: record.bindingId, current: structuredClone(record.current), matchedHistoricalStates: matchedStates.map((state) => ({ symbol: state.symbol, path: state.path, sourceHash: state.sourceHash })) });
    }
    const status = matches.length === 0 ? 'not-found' : matches.length === 1 ? 'resolved' : 'ambiguous';
    return signed({ schema: 'forge.variable-lineage-resolution.v1', repositoryId, branch, query, status, matches, claims: { firstMatchChosenSilently: false, branchCrossingAllowed: false } });
  }

  snapshot() {
    return signed({ schema: 'forge.variable-lineage-service-snapshot.v1', bindings: [...this.bindings.values()].map((record) => ({ bindingId: record.bindingId, repositoryId: record.repositoryId, branch: record.branch, current: structuredClone(record.current), transitionCount: record.transitions.length })), claims: { rawSourceStored: false } });
  }
}
