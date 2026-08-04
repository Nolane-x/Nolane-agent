import { randomUUID } from 'node:crypto';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const definitions = [
  ['file.read', 'low', 'policy'],
  ['file.write', 'medium', 'policy'],
  ['file.create', 'medium', 'policy'],
  ['file.delete', 'high', 'explicit'],
  ['shell.run', 'high', 'explicit'],
  ['network.use', 'high', 'explicit'],
  ['browser.use', 'medium', 'policy'],
  ['mcp.use', 'medium', 'policy'],
  ['secret.read', 'critical', 'always'],
  ['git.use', 'medium', 'policy'],
  ['git.commit', 'high', 'explicit'],
  ['git.push', 'critical', 'always'],
  ['pull_request.create', 'high', 'explicit'],
  ['deploy.execute', 'critical', 'always'],
  ['database.mutate', 'critical', 'always'],
  ['api.paid', 'high', 'explicit'],
  ['agent.spawn', 'medium', 'policy'],
  ['task.background', 'medium', 'policy'],
  ['filesystem.external', 'critical', 'always'],
  ['clipboard.read', 'high', 'explicit'],
  ['computer.control', 'critical', 'always'],
  ['file.download', 'high', 'explicit'],
  ['file.upload', 'critical', 'always'],
  ['port.open', 'critical', 'always'],
  ['software.install', 'critical', 'always'],
  ['system.admin', 'critical', 'always'],
];

export const CAPABILITY_IDS = Object.freeze(definitions.map(([id]) => id));
const CAPABILITY_MAP = new Map(definitions.map(([id, risk, approval]) => [id, Object.freeze({ id, risk, approval })]));
const GRANT_MODES = new Set(['once', 'session', 'timed', 'persistent']);
const EFFECTS = new Set(['allow', 'deny']);

function required(value, label, max = 4_000) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${label} is required`);
  if (result.length > max) throw new TypeError(`${label} exceeds ${max} characters`);
  return result;
}

function uniqueStrings(value, label, { max = 512 } = {}) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > max) throw new TypeError(`${label} must be an array with at most ${max} entries`);
  return Object.freeze([...new Set(value.map((item, index) => required(item, `${label}[${index}]`, 1_000)))].sort());
}

function normalizeScope(scope = {}) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) throw new TypeError('scope must be an object');
  return Object.freeze({
    paths: uniqueStrings(scope.paths, 'scope.paths'),
    domains: uniqueStrings(scope.domains, 'scope.domains').map((value) => value.toLowerCase()),
    commands: uniqueStrings(scope.commands, 'scope.commands'),
    arguments: uniqueStrings(scope.arguments, 'scope.arguments'),
    repositories: uniqueStrings(scope.repositories, 'scope.repositories'),
    tools: uniqueStrings(scope.tools, 'scope.tools'),
  });
}

function glob(pattern, candidate) {
  const escaped = String(pattern).replace(/[.+^${}()|[\]\\]/g, '\\$&').replaceAll('**', '\u0000').replaceAll('*', '[^/]*').replaceAll('\u0000', '.*').replaceAll('?', '[^/]');
  return new RegExp(`^${escaped}$`).test(String(candidate));
}

function anyMatch(patterns, candidate, matcher = (pattern, value) => pattern === value) {
  if (!patterns.length) return true;
  if (candidate == null || candidate === '') return false;
  return patterns.some((pattern) => matcher(pattern, String(candidate)));
}

function domainMatch(pattern, domain) {
  const expected = String(pattern).toLowerCase();
  const actual = String(domain).toLowerCase();
  return actual === expected || actual.endsWith(`.${expected}`);
}

function scopeMatches(scope, resource = {}, capability = '') {
  const id = String(capability);
  const pathScoped = id.startsWith('file.') || id === 'filesystem.external';
  const domainScoped = ['network.use', 'browser.use', 'mcp.use', 'api.paid', 'file.download', 'file.upload', 'deploy.execute'].includes(id);
  const commandScoped = ['shell.run', 'software.install', 'system.admin'].includes(id);
  const repositoryScoped = id.startsWith('git.') || id === 'git.use' || id === 'pull_request.create';
  if (pathScoped && !anyMatch(scope.paths, resource.path, glob)) return false;
  if (domainScoped && !anyMatch(scope.domains, resource.domain, domainMatch)) return false;
  if (commandScoped && !anyMatch(scope.commands, resource.command)) return false;
  if (commandScoped && scope.arguments.length) {
    if (!Array.isArray(resource.arguments) || !resource.arguments.every((argument) => scope.arguments.some((pattern) => glob(pattern, String(argument))))) return false;
  }
  if (repositoryScoped && !anyMatch(scope.repositories, resource.repository)) return false;
  if (scope.tools.length && !anyMatch(scope.tools, resource.tool, glob)) return false;
  return true;
}

function clone(value) { return structuredClone(value); }
function freeze(value) { return Object.freeze(value); }

export class CapabilityRegistry {
  list() { return CAPABILITY_IDS.map((id) => CAPABILITY_MAP.get(id)); }

  describe(id) {
    const record = CAPABILITY_MAP.get(String(id));
    if (!record) throw new TypeError(`Unknown capability: ${id}`);
    return record;
  }

  normalize(values = []) {
    if (!Array.isArray(values)) throw new TypeError('capabilities must be an array');
    const result = [];
    const seen = new Set();
    for (const value of values) {
      const id = required(value, 'capability', 120);
      this.describe(id);
      if (!seen.has(id)) { seen.add(id); result.push(id); }
    }
    return Object.freeze(result);
  }

  intersect(parent, requested) {
    const parentSet = new Set(this.normalize(parent));
    return Object.freeze(this.normalize(requested).filter((id) => parentSet.has(id)));
  }

  assertDelegationAllowed({ parent = [], requested = [] } = {}) {
    const normalized = this.normalize(requested);
    const parentSet = new Set(this.normalize(parent));
    const escalated = normalized.filter((id) => !parentSet.has(id));
    if (escalated.length) {
      const error = new Error(`Capability delegation exceeds parent authority: ${escalated.join(', ')}`);
      error.code = 'CAPABILITY_ESCALATION';
      error.capabilities = Object.freeze(escalated);
      throw error;
    }
    return normalized;
  }
}

export class CapabilityGrantLedger {
  constructor({ clock = () => Date.now(), registry = new CapabilityRegistry(), eventSink = () => {}, storage = null } = {}) {
    this.clock = clock;
    this.registry = registry;
    this.eventSink = eventSink;
    this.storage = storage;
    this.grants = new Map();
    this.audit = [];
    const restored = storage?.loadState?.() ?? { grants: [], audit: [] };
    for (const record of restored.grants ?? []) this.grants.set(String(record.id), clone(record));
    this.audit = (restored.audit ?? []).map(clone);
  }

  #event(type, payload) {
    const base = { schema: 'forge.capability-audit.v1', id: randomUUID(), type, at: new Date(this.clock()).toISOString(), ...clone(payload) };
    const event = freeze({ ...base, eventSha256: canonicalSha256(base) });
    this.audit.push(event);
    this.storage?.appendAudit?.(event);
    this.eventSink(event);
    return event;
  }

  grant(input = {}) {
    const effect = String(input.effect ?? 'allow').toLowerCase();
    if (!EFFECTS.has(effect)) throw new TypeError('effect must be allow or deny');
    const mode = String(input.mode ?? 'session').toLowerCase();
    if (!GRANT_MODES.has(mode)) throw new TypeError('mode must be once, session, timed, or persistent');
    const capabilities = this.registry.normalize(input.capabilities);
    if (!capabilities.length) throw new TypeError('at least one capability is required');
    const sessionId = mode === 'session' ? required(input.sessionId, 'sessionId', 240) : null;
    const expiresAt = mode === 'timed' ? new Date(required(input.expiresAt, 'expiresAt', 80)).toISOString() : null;
    if (mode === 'timed' && (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= this.clock())) throw new TypeError('expiresAt must be a future ISO-8601 timestamp');
    const base = {
      schema: 'forge.capability-grant.v1',
      id: String(input.id ?? `grant_${randomUUID().replaceAll('-', '')}`),
      principalId: required(input.principalId, 'principalId', 240),
      capabilities,
      effect,
      mode,
      sessionId,
      expiresAt,
      scope: normalizeScope(input.scope),
      reason: required(input.reason, 'reason'),
      expectedImpact: required(input.expectedImpact, 'expectedImpact'),
      approvedBy: required(input.approvedBy, 'approvedBy', 240),
      createdAt: new Date(this.clock()).toISOString(),
      usesRemaining: mode === 'once' ? 1 : null,
      revokedAt: null,
      revokedBy: null,
      revocationReason: null,
    };
    const record = { ...base, receiptSha256: canonicalSha256(base) };
    this.grants.set(record.id, record);
    this.storage?.saveGrant?.(record);
    this.#event('capability.granted', { grantId: record.id, principalId: record.principalId, capabilities, effect, mode, reason: record.reason, expectedImpact: record.expectedImpact, approvedBy: record.approvedBy, receiptSha256: record.receiptSha256 });
    return freeze(clone(record));
  }

  #active(record, { sessionId } = {}) {
    if (record.revokedAt) return false;
    if (record.mode === 'once' && record.usesRemaining < 1) return false;
    if (record.mode === 'session' && record.sessionId !== String(sessionId ?? '')) return false;
    if (record.mode === 'timed' && Date.parse(record.expiresAt) <= this.clock()) return false;
    return true;
  }

  authorize(input = {}) {
    const principalId = required(input.principalId, 'principalId', 240);
    const capability = this.registry.describe(input.capability).id;
    const matching = [...this.grants.values()].filter((record) => record.principalId === principalId
      && record.capabilities.includes(capability)
      && this.#active(record, input)
      && scopeMatches(record.scope, input.resource, capability));
    const denied = matching.find((record) => record.effect === 'deny');
    const allowed = matching.find((record) => record.effect === 'allow');
    let decision;
    if (denied) decision = { decision: 'deny', code: 'explicit-deny', grantId: denied.id, reason: 'A matching deny grant overrides all allows.' };
    else if (allowed) {
      if (input.consume === true && allowed.mode === 'once') { allowed.usesRemaining -= 1; this.storage?.saveGrant?.(allowed); }
      decision = { decision: 'allow', code: 'explicit-allow', grantId: allowed.id, reason: 'A matching capability grant authorizes the action.', receiptSha256: allowed.receiptSha256 };
    } else decision = { decision: 'deny', code: 'default-deny', grantId: null, reason: 'No active scoped allow grant exists.' };
    this.#event('capability.authorization', { principalId, capability, decision: decision.decision, code: decision.code, grantId: decision.grantId, resource: input.resource ?? {}, sessionId: input.sessionId ?? null, consumed: input.consume === true && decision.decision === 'allow' });
    return freeze(decision);
  }

  amend(grantId, { scope, reason, expectedImpact, approvedBy } = {}) {
    const record = this.grants.get(String(grantId));
    if (!record) throw Object.assign(new Error('Capability grant not found'), { code: 'CAPABILITY_GRANT_NOT_FOUND' });
    if (record.revokedAt) throw Object.assign(new Error('Revoked capability grant cannot be amended'), { code: 'CAPABILITY_GRANT_REVOKED' });
    const previousReceiptSha256 = record.receiptSha256;
    const base = {
      ...record,
      scope: scope === undefined ? record.scope : normalizeScope(scope),
      reason: reason === undefined ? record.reason : required(reason, 'reason'),
      expectedImpact: expectedImpact === undefined ? record.expectedImpact : required(expectedImpact, 'expectedImpact'),
      approvedBy: approvedBy === undefined ? record.approvedBy : required(approvedBy, 'approvedBy', 240),
      amendedAt: new Date(this.clock()).toISOString(),
      previousReceiptSha256,
    };
    delete base.receiptSha256;
    const amended = { ...base, receiptSha256: canonicalSha256(base) };
    this.grants.set(amended.id, amended);
    this.storage?.saveGrant?.(amended);
    this.#event('capability.amended', { grantId: amended.id, principalId: amended.principalId, approvedBy: amended.approvedBy, reason: amended.reason, expectedImpact: amended.expectedImpact, previousReceiptSha256, receiptSha256: amended.receiptSha256 });
    return freeze(clone(amended));
  }

  revoke(grantId, { revokedBy, reason } = {}) {
    const record = this.grants.get(String(grantId));
    if (!record) throw Object.assign(new Error('Capability grant not found'), { code: 'CAPABILITY_GRANT_NOT_FOUND' });
    if (record.revokedAt) return freeze(clone(record));
    record.revokedAt = new Date(this.clock()).toISOString();
    record.revokedBy = required(revokedBy, 'revokedBy', 240);
    record.revocationReason = required(reason, 'reason');
    this.storage?.saveGrant?.(record);
    this.#event('capability.revoked', { grantId: record.id, principalId: record.principalId, revokedBy: record.revokedBy, reason: record.revocationReason });
    return freeze(clone(record));
  }

  getGrant(grantId) {
    const record = this.grants.get(String(grantId));
    return record ? freeze(clone(record)) : null;
  }

  listGrants({ principalId = null, effect = null, activeOnly = false, sessionId = null } = {}) {
    const now = this.clock();
    return [...this.grants.values()]
      .filter((record) => !principalId || record.principalId === String(principalId))
      .filter((record) => !effect || record.effect === String(effect))
      .filter((record) => !activeOnly || (!record.revokedAt && (record.mode !== 'once' || record.usesRemaining > 0) && (record.mode !== 'timed' || Date.parse(record.expiresAt) > now) && (record.mode !== 'session' || record.sessionId === String(sessionId ?? ''))))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))
      .map((record) => freeze(clone(record)));
  }

  auditEvents() { return this.audit.map((event) => freeze(clone(event))); }
}
