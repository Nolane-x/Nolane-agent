import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { assertTaskActionAllowed } from '../orchestration/task-contract.mjs';

const ACTIONS = Object.freeze({
  'network.request': Object.freeze({ capability: 'network.use', recovery: 'request-capability' }),
  deploy: Object.freeze({ capability: 'deploy.execute', recovery: 'request-explicit-deploy-approval' }),
  'database.mutate': Object.freeze({ capability: 'database.mutate', recovery: 'request-database-approval' }),
  'secret.read': Object.freeze({ capability: 'secret.read', recovery: 'request-secret-access' }),
  'shell.run': Object.freeze({ capability: 'shell.run', recovery: 'request-shell-approval' }),
  'system.admin': Object.freeze({ capability: 'system.admin', recovery: 'request-administrator-approval' }),
  'file.upload': Object.freeze({ capability: 'file.upload', recovery: 'request-upload-approval' }),
});

function required(value, label) { const text = String(value ?? '').trim(); if (!text) throw new TypeError(`${label} is required`); return text; }
function freeze(value, seen = new WeakSet()) { if (!value || typeof value !== 'object' || seen.has(value)) return value; seen.add(value); for (const child of Object.values(value)) freeze(child, seen); return Object.freeze(value); }
function resourceFor(action) {
  if (action.kind === 'network.request') { const url = new URL(required(action.url, 'action.url')); return { domain: url.hostname, port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)), tool: action.tool ? String(action.tool) : undefined }; }
  if (action.kind === 'deploy') return { domain: action.domain ? String(action.domain).toLowerCase() : undefined, tool: action.tool ? String(action.tool) : undefined };
  if (action.kind === 'secret.read') return { tool: required(action.provider ?? action.tool, 'action.provider'), path: action.name ? String(action.name) : undefined };
  if (action.kind === 'shell.run' || action.kind === 'system.admin') return { command: required(action.command, 'action.command'), arguments: Array.isArray(action.arguments) ? action.arguments.map(String) : [], tool: action.tool ? String(action.tool) : undefined };
  if (action.kind === 'file.upload') { const url = new URL(required(action.url, 'action.url')); return { domain: url.hostname, path: action.path ? String(action.path) : undefined, tool: action.tool ? String(action.tool) : undefined }; }
  return { tool: action.tool ? String(action.tool) : undefined };
}

export class ActionGuardrailPipeline {
  constructor({ capabilityLedger, clock = () => Date.now(), eventSink = () => {} } = {}) {
    if (!capabilityLedger?.authorize) throw new TypeError('capabilityLedger is required');
    this.capabilityLedger = capabilityLedger;
    this.clock = clock;
    this.eventSink = eventSink;
  }

  #receipt(input, decision) {
    const base = {
      schema: 'forge.action-guardrail.v1',
      at: new Date(this.clock()).toISOString(),
      principalId: input.principalId,
      sessionId: input.sessionId ?? null,
      actionKind: input.action.kind,
      actionSha256: canonicalSha256(input.action),
      capability: input.capability,
      decision: decision.decision,
      code: decision.code,
      grantId: decision.grantId ?? null,
      reason: decision.reason,
      recovery: input.recovery,
    };
    return freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  authorize(input = {}) {
    const principalId = required(input.principalId, 'principalId');
    const action = input.action;
    if (!action || typeof action !== 'object' || Array.isArray(action)) throw new TypeError('action is required');
    const kind = required(action.kind, 'action.kind');
    const definition = ACTIONS[kind];
    if (!definition) throw Object.assign(new Error(`Unsupported guarded action: ${kind}`), { code: 'ACTION_GUARDRAIL_KIND_INVALID' });
    try { assertTaskActionAllowed(input.taskContract, action); }
    catch (cause) {
      const decision = { decision: 'deny', code: cause.code ?? 'task-contract-deny', grantId: null, reason: cause.message };
      const receipt = this.#receipt({ principalId, sessionId: input.sessionId, action, capability: definition.capability, recovery: { kind: 'revise-task-contract', requiredCapability: definition.capability } }, decision);
      this.eventSink(receipt);
      const error = new Error(cause.message); error.code = 'ACTION_CONTRACT_DENIED'; error.cause = cause; error.guardrail = receipt; throw error;
    }
    const decision = this.capabilityLedger.authorize({ principalId, sessionId: input.sessionId, capability: definition.capability, resource: resourceFor(action), consume: input.consume !== false });
    const recovery = Object.freeze({ kind: definition.recovery, requiredCapability: definition.capability, resource: resourceFor(action) });
    const receipt = this.#receipt({ principalId, sessionId: input.sessionId, action, capability: definition.capability, recovery }, decision);
    this.eventSink(receipt);
    if (decision.decision !== 'allow') {
      const error = new Error(`Action denied by capability guardrail: ${decision.reason}`);
      error.code = 'ACTION_GUARDRAIL_DENIED';
      error.guardrail = receipt;
      throw error;
    }
    return freeze({ decision: 'allow', capability: definition.capability, grantId: decision.grantId, reason: decision.reason, receiptSha256: receipt.receiptSha256, guardrail: receipt });
  }
}
