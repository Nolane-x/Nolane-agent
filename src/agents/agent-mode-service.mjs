import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { AgentModeRegistry } from './agent-mode-registry.mjs';

function fail(message) {
  throw Object.assign(new Error(message), { code: 'AGENT_MODE_OVERRIDE_BROADENS_POLICY' });
}
function freeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value); for (const child of Object.values(value)) freeze(child, seen); return Object.freeze(value);
}
function subset(requested, allowed, label) {
  if (requested === undefined) return [...allowed];
  if (!Array.isArray(requested)) throw new TypeError(`${label} must be an array`);
  const unique = [...new Set(requested.map(String).map((x) => x.trim()).filter(Boolean))];
  if (unique.some((item) => !allowed.includes(item))) fail(`${label} may only remove entries`);
  return unique;
}
function boundedInt(value, base, label) {
  if (value === undefined) return base;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > base) fail(`${label} may only lower the built-in limit`);
  return number;
}
const COMMIT_RANK = { deny: 0, ask: 1, allow: 2 };
const APPROVAL_RANK = { always: 0, 'state-change': 1, 'risk-based': 2 };

export class AgentModeService {
  constructor({ registry = new AgentModeRegistry() } = {}) { this.registry = registry; }
  list() { return this.registry.list(); }
  get(modeId) { return this.registry.require(modeId); }

  resolve({ modeId, overrides = {}, providers = undefined } = {}) {
    const base = this.registry.require(modeId);
    if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) throw new TypeError('mode overrides must be an object');
    const readOnly = overrides.readOnly === undefined ? base.readOnly : overrides.readOnly === true;
    if (base.readOnly && !readOnly) fail('readOnly cannot be disabled');
    const localOnly = overrides.localOnly === undefined ? base.localOnly : overrides.localOnly === true;
    if (base.localOnly && !localOnly) fail('localOnly cannot be disabled');
    const allowChildAgents = overrides.allowChildAgents === undefined ? base.allowChildAgents : overrides.allowChildAgents === true;
    if (!base.allowChildAgents && allowChildAgents) fail('allowChildAgents cannot be enabled');
    const backgroundAllowed = overrides.backgroundAllowed === undefined ? base.backgroundAllowed : overrides.backgroundAllowed === true;
    if (!base.backgroundAllowed && backgroundAllowed) fail('backgroundAllowed cannot be enabled');
    const commitPolicy = overrides.commitPolicy === undefined ? base.commitPolicy : String(overrides.commitPolicy);
    if (!(commitPolicy in COMMIT_RANK) || COMMIT_RANK[commitPolicy] > COMMIT_RANK[base.commitPolicy]) fail('commitPolicy may only become stricter');
    const approvalPolicy = overrides.approvalPolicy === undefined ? base.approvalPolicy : String(overrides.approvalPolicy);
    if (!(approvalPolicy in APPROVAL_RANK) || APPROVAL_RANK[approvalPolicy] > APPROVAL_RANK[base.approvalPolicy]) fail('approvalPolicy may only become stricter');
    const network = overrides.networkPolicy ?? base.networkPolicy;
    if (!network || !['deny','allowlist'].includes(String(network.mode))) throw new TypeError('networkPolicy.mode is invalid');
    if (base.networkPolicy.mode === 'deny' && network.mode !== 'deny') fail('networkPolicy cannot be broadened');
    const policy = freeze({
      ...base,
      readOnly,
      writesAllowed: !readOnly && base.writesAllowed,
      localOnly,
      allowChildAgents,
      backgroundAllowed,
      commitPolicy,
      approvalPolicy,
      networkPolicy: freeze({ mode: String(network.mode), domains: subset(network.domains ?? [], base.networkPolicy.domains ?? [], 'networkPolicy.domains'), ports: subset((network.ports ?? []).map(String), (base.networkPolicy.ports ?? []).map(String), 'networkPolicy.ports').map(Number) }),
      requiredCapabilities: freeze(subset(overrides.requiredCapabilities, base.requiredCapabilities, 'requiredCapabilities')),
      toolGroups: freeze(subset(overrides.toolGroups, base.toolGroups, 'toolGroups')),
      deniedToolGroups: freeze([...new Set([...(base.deniedToolGroups ?? []), ...(Array.isArray(overrides.deniedToolGroups) ? overrides.deniedToolGroups.map(String) : [])])]),
      maxTurns: boundedInt(overrides.maxTurns, base.maxTurns, 'maxTurns'),
      maxTasks: boundedInt(overrides.maxTasks, base.maxTasks, 'maxTasks'),
      budgetTokens: boundedInt(overrides.budgetTokens, base.budgetTokens, 'budgetTokens'),
      contextBudget: boundedInt(overrides.contextBudget, base.contextBudget, 'contextBudget'),
    });
    if (providers !== undefined && policy.localOnly) {
      const available = Array.isArray(providers) && providers.some((provider) => provider?.local === true && provider?.available !== false && provider?.healthy !== false);
      if (!available) throw Object.assign(new Error('Offline mode requires an available local provider'), { code: 'AGENT_MODE_LOCAL_PROVIDER_REQUIRED' });
    }
    const baseResult = {
      schema: 'forge.agent-mode-resolution.v1',
      modeId: base.id,
      policy,
      providerConstraint: freeze({ localOnly: policy.localOnly, routingMode: policy.routingMode }),
    };
    return freeze({ ...baseResult, receiptSha256: canonicalSha256(baseResult) });
  }
}
