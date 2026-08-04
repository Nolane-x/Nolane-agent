function requiredDependency(value, method, label) {
  if (!value || typeof value[method] !== 'function') throw new TypeError(`${label} is required`);
  return value;
}

export class TrustAwareInstructionDiscovery {
  constructor({ base, trust, eventSink = () => {} } = {}) {
    this.base = requiredDependency(base, 'discover', 'instruction discovery');
    if (typeof base.select !== 'function') throw new TypeError('instruction discovery select is required');
    this.trust = requiredDependency(trust, 'status', 'workspace trust service');
    this.eventSink = eventSink;
  }

  async discover(workspaceRoot, { projectId = null } = {}) {
    if (!projectId) return this.base.discover(workspaceRoot);
    const status = await this.trust.status(projectId);
    if (status.state !== 'trusted') {
      this.eventSink({ type: 'workspace.trust.feature-blocked', projectId: String(projectId), feature: 'instructions', reason: status.reason });
      return Object.freeze([]);
    }
    return this.base.discover(workspaceRoot);
  }

  select(records, options) { return this.base.select(records, options); }
}

export class TrustAwareInstructionPolicy {
  constructor({ base, trust, eventSink = () => {} } = {}) {
    this.base = requiredDependency(base, 'resolve', 'instruction policy service');
    this.trust = requiredDependency(trust, 'status', 'workspace trust service');
    this.eventSink = eventSink;
  }

  async resolve(input = {}) {
    const projectId = String(input.projectId ?? '');
    const status = await this.trust.status(projectId);
    if (status.state !== 'trusted') {
      this.eventSink({ type: 'workspace.trust.feature-blocked', projectId, feature: 'instruction-policy', reason: status.reason });
      return Object.freeze({
        schema: 'forge.instruction-policy.v1', version: this.base.version ?? '0.0.0', projectId, principalId: String(input.principalId ?? ''),
        query: Object.freeze({ paths: Object.freeze([]), language: null, taskType: null, includeWorkflows: false }),
        selected: Object.freeze([]), effectiveRules: Object.freeze({}), conflicts: Object.freeze([]), invalidRecords: Object.freeze([]),
        precedence: Object.freeze({ nodes: Object.freeze([]), edges: Object.freeze([]) }),
        omissions: Object.freeze([{ reason: 'workspace-untrusted', trustReason: status.reason }]), trust: status, receiptSha256: null,
      });
    }
    return this.base.resolve(input);
  }

  clear(projectId = null) { return this.base.clear?.(projectId); }
}

export class TrustAwareMcpGateway {
  constructor({ base, trust, eventSink = () => {} } = {}) {
    this.base = requiredDependency(base, 'schemasForTask', 'MCP gateway');
    if (typeof base.execute !== 'function') throw new TypeError('MCP gateway execute is required');
    this.trust = requiredDependency(trust, 'status', 'workspace trust service');
    this.eventSink = eventSink;
  }

  async schemasForTask(task) {
    const status = await this.trust.status(task?.projectId);
    if (status.state !== 'trusted') {
      this.eventSink({ type: 'workspace.trust.feature-blocked', projectId: String(task?.projectId ?? ''), taskId: task?.id ?? null, feature: 'mcp', reason: status.reason });
      return Object.freeze([]);
    }
    return this.base.schemasForTask(task);
  }

  async execute(task, name, args, context) {
    await this.trust.requireTrusted(task?.projectId, 'mcp');
    return this.base.execute(task, name, args, context);
  }
}

export class TrustAwarePluginContext {
  constructor({ base, trust, eventSink = () => {} } = {}) {
    this.base = requiredDependency(base, 'contextForProject', 'plugin context service');
    this.trust = requiredDependency(trust, 'status', 'workspace trust service');
    this.eventSink = eventSink;
  }

  async contextForProject(projectId, options = {}) {
    const status = await this.trust.status(projectId);
    if (status.state !== 'trusted') {
      this.eventSink({ type: 'workspace.trust.feature-blocked', projectId: String(projectId), feature: 'plugins', reason: status.reason });
      return Object.freeze({
        projectId: String(projectId),
        items: Object.freeze([]),
        omissions: Object.freeze([{ reason: 'workspace-untrusted', trustReason: status.reason }]),
        usedChars: 0,
        maxChars: Math.max(1_000, Math.min(1_000_000, Number(options.maxChars) || 64_000)),
      });
    }
    return this.base.contextForProject(projectId, options);
  }
}
