import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const SHA256 = /^[a-f0-9]{64}$/;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) deepFreeze(item);
    return Object.freeze(value);
  }
  for (const item of Object.values(value)) deepFreeze(item);
  return Object.freeze(value);
}

function boundedInteger(value, fallback, min, max) {
  const number = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(number) ? Math.floor(number) : fallback));
}

function normalizeBranchContext(context = {}) {
  return deepFreeze({
    branch: context.branch == null ? null : String(context.branch),
    worktree: context.worktree == null ? null : String(context.worktree),
    headSha: context.headSha == null ? null : String(context.headSha),
    dirtyHash: context.dirtyHash == null ? null : String(context.dirtyHash),
    editorOverlayHash: context.editorOverlayHash == null ? null : String(context.editorOverlayHash),
  });
}

function normalizeCitation(input) {
  if (!input || typeof input !== 'object') throw new TypeError('repository fact citation is required');
  const sourceHash = String(input.sourceHash ?? '').toLowerCase();
  if (!SHA256.test(sourceHash)) throw new TypeError('repository fact citation sourceHash must be a SHA-256');
  const path = String(input.path ?? '').replaceAll('\\', '/').replace(/^\.\//, '');
  if (!path) throw new TypeError('repository fact citation path is required');
  const line = Math.max(1, Number(input.line) || 1);
  const start = Math.max(0, Number(input.start) || 0);
  const end = Math.max(start, Number(input.end) || start);
  return deepFreeze({
    path,
    line,
    start,
    end,
    sourceHash,
    overlayId: input.overlayId == null ? null : String(input.overlayId),
  });
}

export function createBranchFingerprint(branchContext = {}) {
  return canonicalSha256(normalizeBranchContext(branchContext));
}

export function createFactInvalidationKey(fact) {
  return canonicalSha256({
    projectId: String(fact.projectId),
    branchFingerprint: String(fact.branchFingerprint ?? createBranchFingerprint(fact.branchContext)),
    citation: normalizeCitation(fact.citation),
    provider: String(fact.provider ?? 'unknown'),
    kind: String(fact.kind),
    subject: String(fact.subject),
    predicate: String(fact.predicate),
    object: fact.object == null ? null : String(fact.object),
  });
}

function sameBranchContext(left, right) {
  return createBranchFingerprint(left) === createBranchFingerprint(right);
}

export class RepositoryFactLedger {
  constructor({ maxFacts = 10_000 } = {}) {
    this.maxFacts = boundedInteger(maxFacts, 10_000, 1, 100_000);
    this.facts = new Map();
    this.order = [];
    this.evicted = 0;
  }

  get size() { return this.facts.size; }

  record(input) {
    if (!input || typeof input !== 'object') throw new TypeError('repository fact must be an object');
    for (const field of ['projectId', 'kind', 'subject', 'predicate']) {
      if (input[field] == null || String(input[field]).length === 0) throw new TypeError(`repository fact ${field} is required`);
    }
    const branchContext = normalizeBranchContext(input.branchContext);
    const citation = normalizeCitation(input.citation);
    if (citation.overlayId && !branchContext.editorOverlayHash) throw new TypeError('editor overlay facts require editorOverlayHash');
    if (!citation.overlayId && branchContext.editorOverlayHash) throw new TypeError('disk facts cannot use an editor overlay branch context');
    const base = {
      projectId: String(input.projectId),
      kind: String(input.kind),
      subject: String(input.subject),
      predicate: String(input.predicate),
      object: input.object == null ? null : String(input.object),
      confidence: String(input.confidence ?? 'unknown'),
      provider: String(input.provider ?? 'unknown'),
      branchContext,
      branchFingerprint: createBranchFingerprint(branchContext),
      citation,
      metadata: input.metadata && typeof input.metadata === 'object' ? structuredClone(input.metadata) : {},
    };
    const invalidationKey = createFactInvalidationKey(base);
    const id = `fact_${canonicalSha256({ ...base, invalidationKey }).slice(0, 24)}`;
    const fact = deepFreeze({ id, ...base, invalidationKey });
    if (this.facts.has(id)) return this.facts.get(id);
    this.facts.set(id, fact);
    this.order.push(id);
    while (this.order.length > this.maxFacts) {
      const removed = this.order.shift();
      this.facts.delete(removed);
      this.evicted += 1;
    }
    return fact;
  }

  query({ projectId, branchContext, predicate = null, kind = null, subject = null, limit = this.maxFacts } = {}) {
    const requestedProject = String(projectId ?? '');
    const requestedContext = normalizeBranchContext(branchContext);
    const accepted = [];
    const rejected = [];
    const maximum = boundedInteger(limit, this.maxFacts, 1, this.maxFacts);
    for (const id of this.order) {
      const fact = this.facts.get(id);
      if (!fact || fact.projectId !== requestedProject) continue;
      if (!sameBranchContext(fact.branchContext, requestedContext)) {
        rejected.push(deepFreeze({ id: fact.id, reason: 'branch-context-mismatch' }));
        continue;
      }
      if (predicate != null && fact.predicate !== String(predicate)) continue;
      if (kind != null && fact.kind !== String(kind)) continue;
      if (subject != null && fact.subject !== String(subject)) continue;
      if (accepted.length < maximum) accepted.push(fact);
    }
    return deepFreeze({
      facts: accepted,
      rejected,
      totalMatching: accepted.length,
      truncated: accepted.length >= maximum && this.facts.size > accepted.length,
      truncatedByLedgerLimit: this.evicted > 0,
      branchFingerprint: createBranchFingerprint(requestedContext),
    });
  }

  validate({ projectId, branchContext, resolveSourceHash } = {}) {
    if (typeof resolveSourceHash !== 'function') throw new TypeError('resolveSourceHash must be a function');
    const result = this.query({ projectId, branchContext });
    const valid = [];
    const invalid = [...result.rejected];
    for (const fact of result.facts) {
      const actual = resolveSourceHash(fact.citation.path, fact.citation.overlayId);
      const actualSourceHash = actual == null ? null : String(actual).toLowerCase();
      if (actualSourceHash !== fact.citation.sourceHash) {
        invalid.push(deepFreeze({
          id: fact.id,
          reason: 'source-hash-mismatch',
          expectedSourceHash: fact.citation.sourceHash,
          actualSourceHash,
        }));
      } else valid.push(fact);
    }
    return deepFreeze({ valid, invalid, branchFingerprint: result.branchFingerprint });
  }

  clearOverlay(overlayId) {
    const target = String(overlayId);
    let removed = 0;
    this.order = this.order.filter((id) => {
      const fact = this.facts.get(id);
      if (fact?.citation.overlayId !== target) return true;
      this.facts.delete(id);
      removed += 1;
      return false;
    });
    return removed;
  }
}
