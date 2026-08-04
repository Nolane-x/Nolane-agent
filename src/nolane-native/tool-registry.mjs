import { createHash } from 'node:crypto';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const VALID_RISK = new Set(['low', 'medium', 'high', 'critical']);

export class ToolRegistry {
  #tools = new Map(); #calls = 0; #maxCalls;
  constructor({ maxCalls = 50, executionFabric = null } = {}) {
    this.#maxCalls = Math.max(1, Number(maxCalls) || 50);
    this.executionFabric = executionFabric;
  }
  register(definition) {
    if (!definition?.name || !definition.capability || (typeof definition.execute !== 'function' && !definition.backendId)) throw new Error('Tool requires name, capability and execute or backendId');
    if (definition.backendId && !this.executionFabric?.execute) throw new Error('Backend tools require an execution fabric');
    const name = String(definition.name); if (this.#tools.has(name)) throw new Error(`Duplicate tool: ${name}`);
    const risk = definition.risk ?? 'medium'; if (!VALID_RISK.has(risk)) throw new Error(`Unknown tool risk: ${risk}`);
    this.#tools.set(name, Object.freeze({
      name,
      capability: String(definition.capability),
      risk,
      reversible: definition.reversible !== false,
      description: String(definition.description ?? ''),
      parameters: definition.parameters && typeof definition.parameters === 'object' ? structuredClone(definition.parameters) : Object.freeze({ type: 'object', properties: {} }),
      execute: typeof definition.execute === 'function' ? definition.execute : null,
      backendId: definition.backendId ? String(definition.backendId) : null,
      toAction: typeof definition.toAction === 'function' ? definition.toAction : (input) => ({ input }),
      validate: typeof definition.validate === 'function' ? definition.validate : null,
    })); return this;
  }
  describe() { return Object.freeze([...this.#tools.values()].map(({ execute, validate, toAction, ...tool }) => Object.freeze(tool))); }
  async execute(name, input, context = {}) {
    const tool = this.#tools.get(String(name)); if (!tool) throw new Error(`Unknown tool: ${name}`);
    if (!(context.grantedCapabilities ?? []).includes(tool.capability)) throw new Error(`Capability denied: ${tool.capability}`);
    const approved = (context.approvals ?? []).includes(tool.name);
    if ((!tool.reversible || ['high', 'critical'].includes(tool.risk)) && !approved) throw new Error(`Approval required for tool: ${tool.name}`);
    if (this.#calls >= this.#maxCalls) throw new Error(`Tool call budget exhausted (${this.#maxCalls})`);
    if (tool.validate) tool.validate(input);
    const startedAt = Date.now();
    const output = tool.backendId
      ? await this.executionFabric.execute({ backendId: tool.backendId, action: tool.toAction(input, context), signal: context.signal, timeoutMs: context.timeoutMs, policy: { risk: tool.risk, reversible: tool.reversible, approved } })
      : await tool.execute(input, Object.freeze({ ...context, tool: tool.name }));
    this.#calls += 1;
    const base = { tool: tool.name, capability: tool.capability, risk: tool.risk, reversible: tool.reversible, backendId: tool.backendId, call: this.#calls, durationMs: Math.max(0, Date.now() - startedAt), output };
    return Object.freeze({ ...base, receiptSha256: sha256(JSON.stringify(base)) });
  }
  snapshot() { return Object.freeze({ calls: this.#calls, maxCalls: this.#maxCalls, remaining: Math.max(0, this.#maxCalls - this.#calls), tools: this.describe(), backends: this.executionFabric?.registry?.describe?.() ?? [] }); }
}
