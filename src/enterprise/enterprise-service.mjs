import { randomUUID } from 'node:crypto';

function required(value, name) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${name} is required`);
  return text;
}
function list(value) { return Array.isArray(value) ? [...new Set(value.map((item) => String(item).trim()).filter(Boolean))] : []; }
function match(pattern, value) {
  if (pattern === '*') return true;
  if (pattern.endsWith('*')) return value.startsWith(pattern.slice(0, -1));
  return pattern === value;
}
function conditionsMatch(conditions = {}, context = {}) {
  if (conditions.region && !list(conditions.region).includes(String(context.region ?? ''))) return false;
  if (Number.isFinite(conditions.maxRisk) && Number(context.risk ?? Infinity) > Number(conditions.maxRisk)) return false;
  if (conditions.requireMfa === true && context.mfa !== true) return false;
  if (conditions.ipRanges && !list(conditions.ipRanges).includes(String(context.ipRange ?? ''))) return false;
  return true;
}
function freeze(value) { return Object.freeze(value); }

export class PolicyEngine {
  constructor({ policies = [] } = {}) { this.policies = policies.map((policy) => this.#normalize(policy)); }
  #normalize(policy) {
    const effect = String(policy.effect ?? '').toLowerCase();
    if (!['allow', 'deny'].includes(effect)) throw new TypeError('policy effect must be allow or deny');
    return freeze({
      id: String(policy.id ?? randomUUID()), organizationId: required(policy.organizationId, 'organizationId'), effect,
      principals: list(policy.principals), roles: list(policy.roles), actions: list(policy.actions), resources: list(policy.resources),
      conditions: freeze({ ...(policy.conditions ?? {}) }), createdAt: String(policy.createdAt ?? new Date().toISOString()),
    });
  }
  replace(policies) { this.policies = policies.map((policy) => this.#normalize(policy)); }
  authorize(input = {}) {
    const organizationId = required(input.organizationId, 'organizationId');
    const principalId = required(input.principalId, 'principalId');
    const action = required(input.action, 'action');
    const resource = required(input.resource, 'resource');
    const roles = list(input.roles);
    const matching = this.policies.filter((policy) => {
      if (policy.organizationId !== organizationId) return false;
      const principalMatch = policy.principals.length === 0 || policy.principals.includes(principalId);
      const roleMatch = policy.roles.length === 0 || policy.roles.some((role) => roles.includes(role));
      if (!(principalMatch && roleMatch)) return false;
      if (policy.actions.length && !policy.actions.some((pattern) => match(pattern, action))) return false;
      if (policy.resources.length && !policy.resources.some((pattern) => match(pattern, resource))) return false;
      return conditionsMatch(policy.conditions, input.context);
    });
    const denied = matching.find((policy) => policy.effect === 'deny');
    if (denied) return freeze({ decision: 'deny', code: 'explicit-deny', policyId: denied.id, reason: 'A matching deny policy overrides all allows.' });
    const allowed = matching.find((policy) => policy.effect === 'allow');
    if (allowed) return freeze({ decision: 'allow', code: 'explicit-allow', policyId: allowed.id, reason: 'A matching allow policy grants the action.' });
    return freeze({ decision: 'deny', code: 'default-deny', policyId: null, reason: 'No matching allow policy exists.' });
  }
}

export class EnterpriseService {
  constructor({ clock = () => Date.now(), storage = null, eventSink = () => {} } = {}) {
    this.clock = clock; this.storage = storage; this.eventSink = eventSink;
    const restored = storage?.loadState?.() ?? { organizations: [], members: [], policies: [], audit: [] };
    this.organizations = new Map(restored.organizations.map((record) => [record.id, freeze({ ...record, metadata: freeze({ ...(record.metadata ?? {}) }) })]));
    this.members = new Map(restored.members.map((record) => [`${record.organizationId}:${record.principalId}`, freeze({ ...record, roles: freeze(list(record.roles)) })]));
    this.policies = restored.policies.map((record) => freeze({ ...record, principals: freeze(list(record.principals)), roles: freeze(list(record.roles)), actions: freeze(list(record.actions)), resources: freeze(list(record.resources)), conditions: freeze({ ...(record.conditions ?? {}) }) }));
    this.audit = restored.audit.map((record) => freeze({ ...record }));
  }
  getOrganization(id) { const record = this.organizations.get(String(id)); return record ? structuredClone(record) : null; }
  listOrganizations() { return [...this.organizations.values()].map((record) => structuredClone(record)); }
  createOrganization(input = {}) {
    const id = required(input.id ?? randomUUID(), 'organization id');
    if (this.organizations.has(id)) throw Object.assign(new Error('Organization already exists'), { code: 'organization-conflict', statusCode: 409 });
    const record = freeze({ id, name: required(input.name, 'organization name'), createdAt: new Date(this.clock()).toISOString(), metadata: freeze({ ...(input.metadata ?? {}) }) });
    this.organizations.set(id, record); this.storage?.saveOrganization?.(record); this.eventSink({ type: 'enterprise.organization.created', organizationId: id }); return record;
  }
  upsertMember(input = {}) {
    const organizationId = required(input.organizationId, 'organizationId');
    if (!this.organizations.has(organizationId)) throw Object.assign(new Error('Organization not found'), { statusCode: 404, code: 'organization-not-found' });
    const principalId = required(input.principalId, 'principalId');
    const record = freeze({ organizationId, principalId, roles: freeze(list(input.roles)), active: input.active !== false, updatedAt: new Date(this.clock()).toISOString() });
    this.members.set(`${organizationId}:${principalId}`, record); this.storage?.saveMember?.(record); this.eventSink({ type: 'enterprise.member.upserted', organizationId, principalId }); return record;
  }
  bindPolicy(input = {}) {
    const policy = freeze({ id: String(input.id ?? randomUUID()), organizationId: required(input.organizationId, 'organizationId'), effect: String(input.effect ?? '').toLowerCase(), principals: freeze(list(input.principals)), roles: freeze(list(input.roles)), actions: freeze(list(input.actions)), resources: freeze(list(input.resources)), conditions: freeze({ ...(input.conditions ?? {}) }) });
    if (!['allow', 'deny'].includes(policy.effect)) throw new TypeError('policy effect must be allow or deny');
    this.policies.push(policy); this.storage?.savePolicy?.(policy); this.eventSink({ type: 'enterprise.policy.bound', organizationId: policy.organizationId, policyId: policy.id, effect: policy.effect }); return policy;
  }
  authorize(input = {}) {
    const member = this.members.get(`${input.organizationId}:${input.principalId}`);
    const roles = member?.active ? member.roles : [];
    const decision = new PolicyEngine({ policies: this.policies }).authorize({ ...input, roles });
    const auditEvent = freeze({ id: randomUUID(), organizationId: String(input.organizationId ?? ''), principalId: String(input.principalId ?? ''), action: String(input.action ?? ''), resource: String(input.resource ?? ''), decision: decision.decision, code: decision.code, policyId: decision.policyId, at: new Date(this.clock()).toISOString() });
    this.audit.push(auditEvent); this.storage?.appendAudit?.(auditEvent); this.eventSink({ type: 'enterprise.authorization', ...auditEvent });
    return decision;
  }
  listAuditEvents({ organizationId, limit = 100 } = {}) {
    const bounded = Math.max(1, Math.min(1000, Number(limit) || 100));
    return this.audit.filter((event) => !organizationId || event.organizationId === organizationId).slice(-bounded).map((event) => ({ ...event }));
  }
}
