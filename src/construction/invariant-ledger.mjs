import { pathMatches, signed, strings, text } from './construction-utils.mjs';

const SEVERITIES = new Set(['critical', 'high', 'warning', 'info']);

export class InvariantLedger {
  constructor({ maxInvariants = 5_000 } = {}) {
    this.maxInvariants = Math.max(1, Number(maxInvariants) || 5_000);
    this.invariants = new Map();
  }

  register(input = {}) {
    const invariantId = text(input.invariantId, 'invariantId', 256);
    const current = this.invariants.get(invariantId);
    if (current && !input.supersedesReceiptId) throw new TypeError(`active invariant requires a supersede receipt: ${invariantId}`);
    if (!current && this.invariants.size >= this.maxInvariants) throw new RangeError('invariant limit exceeded');
    const severity = text(input.severity, 'severity', 64);
    if (!SEVERITIES.has(severity)) throw new TypeError(`unsupported invariant severity: ${severity}`);
    const invariant = signed({
      schema: 'forge.construction-invariant.v1', invariantId,
      owner: text(input.owner, 'owner', 256), severity,
      verifierId: text(input.verifierId, 'verifierId', 256),
      protectedScopes: strings(input.protectedScopes ?? ['**'], 'protectedScopes', 256, 1_024),
      sourceHash: text(input.sourceHash, 'sourceHash', 256),
      statement: input.statement ? String(input.statement).slice(0, 4_000) : '',
      revision: current ? current.revision + 1 : 1,
      supersedesReceiptId: current ? text(input.supersedesReceiptId, 'supersedesReceiptId', 512) : null,
      verification: null,
    });
    this.invariants.set(invariantId, invariant);
    return invariant;
  }

  recordVerification(invariantId, receipt = {}) {
    const id = text(invariantId, 'invariantId', 256);
    const current = this.invariants.get(id);
    if (!current) throw new RangeError(`unknown invariant: ${id}`);
    const status = text(receipt.status, 'verification.status', 64);
    if (!new Set(['passed', 'failed']).has(status)) throw new TypeError('verification status must be passed or failed');
    const verification = signed({ schema: 'forge.invariant-verification.v1', invariantId: id, status, sourceHash: text(receipt.sourceHash, 'verification.sourceHash', 256), receiptId: text(receipt.receiptId, 'verification.receiptId', 512) });
    const updated = signed({ ...current, verification, revision: current.revision });
    this.invariants.set(id, updated);
    return verification;
  }

  authorize({ changedPaths = [], currentSourceHashes = {} } = {}) {
    const paths = strings(changedPaths, 'changedPaths', 2_000, 2_048);
    const blockingInvariantIds = [];
    const warningInvariantIds = [];
    const staleInvariantIds = [];
    const evaluatedInvariantIds = [];
    for (const invariant of this.invariants.values()) {
      if (paths.length && !paths.some((candidate) => invariant.protectedScopes.some((pattern) => pathMatches(pattern, candidate)))) continue;
      evaluatedInvariantIds.push(invariant.invariantId);
      const verification = invariant.verification;
      const currentHash = currentSourceHashes[invariant.invariantId];
      const stale = Boolean(currentHash && verification?.sourceHash && currentHash !== verification.sourceHash);
      const failed = verification?.status !== 'passed' || stale;
      if (stale) staleInvariantIds.push(invariant.invariantId);
      if (failed) {
        if (invariant.severity === 'critical' || invariant.severity === 'high') blockingInvariantIds.push(invariant.invariantId);
        else warningInvariantIds.push(invariant.invariantId);
      }
    }
    return signed({ schema: 'forge.invariant-authorization.v1', allowed: blockingInvariantIds.length === 0, evaluatedInvariantIds, blockingInvariantIds, warningInvariantIds, staleInvariantIds });
  }

  snapshot() { return signed({ schema: 'forge.invariant-ledger.v1', invariants: [...this.invariants.values()] }); }
}
