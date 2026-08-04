import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

function required(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required`);
  return text;
}

function freeze(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) { value.forEach(freeze); return Object.freeze(value); }
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function principalId(principal) {
  const subject = String(principal?.subject ?? principal ?? '').trim();
  if (!subject) throw Object.assign(new Error('An authenticated principal is required'), { statusCode: 401, code: 'ENVIRONMENT_PRINCIPAL_REQUIRED' });
  return subject;
}

function healthPort(health) {
  if (!health?.url) return null;
  const url = new URL(health.url);
  return { domain: url.hostname, port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)) };
}

export class EnvironmentControlService {
  constructor({ supervisor, capabilityLedger, projectResolver, eventSink = () => {}, clock = () => new Date().toISOString() } = {}) {
    if (!supervisor || typeof supervisor.state !== 'function') throw new TypeError('EnvironmentControlService supervisor is required');
    if (!capabilityLedger || typeof capabilityLedger.authorize !== 'function') throw new TypeError('EnvironmentControlService capabilityLedger is required');
    if (typeof projectResolver !== 'function') throw new TypeError('EnvironmentControlService projectResolver is required');
    this.supervisor = supervisor;
    this.capabilityLedger = capabilityLedger;
    this.projectResolver = projectResolver;
    this.eventSink = eventSink;
    this.clock = clock;
  }

  #project(projectId) {
    const id = required(projectId, 'projectId');
    const project = this.projectResolver(id);
    if (!project) throw Object.assign(new Error(`Unknown project: ${id}`), { statusCode: 404, code: 'PROJECT_NOT_FOUND' });
    return project;
  }

  #assertProject(state, projectId) {
    if (projectId == null || projectId === '') return state;
    this.#project(projectId);
    if (String(state.projectId) !== String(projectId)) throw Object.assign(new Error('Environment is not owned by the requested project'), { statusCode: 403, code: 'ENVIRONMENT_PROJECT_SCOPE_DENIED' });
    return state;
  }

  #authorize({ action, principal, sessionId = null, command, args = [], health = null, consume = true }) {
    const subject = principalId(principal);
    const tool = `environment.${action}`;
    const checks = [
      { capability: 'shell.run', resource: { command: required(command, 'environment command'), arguments: [...args], tool } },
    ];
    const port = healthPort(health);
    if (port && ['register', 'start', 'heal', 'recover'].includes(action)) checks.push({ capability: 'port.open', resource: { ...port, tool } });
    const decisions = [];
    for (const check of checks) {
      const decision = this.capabilityLedger.authorize({ principalId: subject, sessionId, capability: check.capability, resource: check.resource, consume });
      decisions.push({ ...decision, capability: check.capability, resource: check.resource });
      if (decision.decision !== 'allow') {
        const error = new Error(`Environment action denied: ${decision.reason}`);
        error.statusCode = 403;
        error.code = 'ENVIRONMENT_CAPABILITY_DENIED';
        error.capability = check.capability;
        error.decision = freeze(structuredClone(decision));
        throw error;
      }
    }
    return { subject, tool, decisions };
  }

  #receipt(action, principal, state, authorization, extra = {}) {
    const base = {
      schema: 'forge.environment-operation.v1',
      type: 'environment.operation',
      action,
      at: this.clock(),
      principalId: principal,
      environmentId: state.id,
      projectId: state.projectId,
      state: state.state,
      stateReceiptSha256: state.receiptSha256 ?? null,
      authorization: authorization?.decisions?.map((item) => ({ capability: item.capability, grantId: item.grantId ?? null, code: item.code })) ?? [],
      ...extra,
    };
    const event = freeze({ ...base, operationReceiptSha256: canonicalSha256(base) });
    this.eventSink(event);
    return event;
  }

  #result(action, state, authorization, extra = {}) {
    const receipt = this.#receipt(action, authorization?.subject ?? 'system', state, authorization, extra);
    return freeze({ ...structuredClone(state), operationReceiptSha256: receipt.operationReceiptSha256 });
  }

  list({ projectId = null } = {}) {
    if (projectId) this.#project(projectId);
    return this.supervisor.list({ projectId: projectId || null });
  }

  status(environmentId, { projectId = null } = {}) {
    return this.#assertProject(this.supervisor.state(environmentId), projectId);
  }

  async snapshot(environmentId, { projectId = null } = {}) {
    this.status(environmentId, { projectId });
    return this.supervisor.environmentSnapshot(environmentId);
  }

  async register(input = {}, { principal, sessionId = null } = {}) {
    this.#project(input.projectId);
    const authorization = this.#authorize({ action: 'register', principal, sessionId, command: input.command, args: input.args ?? [], health: input.health, consume: false });
    const state = this.supervisor.register(input);
    return this.#result('register', state, authorization, { requestSha256: canonicalSha256({ id: input.id, projectId: input.projectId, cwd: input.cwd, command: input.command, args: input.args ?? [], envNames: Object.keys(input.env ?? {}).sort(), health: input.health ?? null, bootstrap: input.bootstrap ?? null, restart: input.restart ?? null }) });
  }

  async #mutate(action, environmentId, context = {}) {
    const state = this.status(environmentId, { projectId: context.projectId ?? null });
    const authorization = this.#authorize({ action, principal: context.principal, sessionId: context.sessionId ?? null, command: state.environment.command, args: state.environment.args ?? [], health: state.environment.health, consume: true });
    const output = await this.supervisor[action](environmentId);
    return this.#result(action, output, authorization);
  }

  start(environmentId, context = {}) { return this.#mutate('start', environmentId, context); }
  heal(environmentId, context = {}) { return this.#mutate('heal', environmentId, context); }
  recover(environmentId, context = {}) { return this.#mutate('recover', environmentId, context); }
  stop(environmentId, context = {}) { return this.#mutate('stop', environmentId, context); }
  close() { this.supervisor.close(); }
}
