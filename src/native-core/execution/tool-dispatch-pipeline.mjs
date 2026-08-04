const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export class ToolDispatchPipeline {
  constructor({ maxRetries = 0, backoffMs = 0 } = {}) { this.maxRetries = Math.max(0, Number(maxRetries) || 0); this.backoffMs = Math.max(0, Number(backoffMs) || 0); this.tools = new Map(); }
  register(definition) { if (!definition?.id || typeof definition.execute !== 'function') throw new TypeError('Tool definition requires id and execute'); const id = String(definition.id); if (this.tools.has(id)) throw new Error(`Duplicate tool: ${id}`); this.tools.set(id, Object.freeze({ id, risk: String(definition.risk ?? 'medium'), execute: definition.execute })); return this; }
  async dispatch(id, input, context = {}) {
    const tool = this.tools.get(String(id)); if (!tool) throw Object.assign(new Error(`Tool not found: ${id}`), { code: 'TOOL_NOT_FOUND' });
    if (['high', 'critical'].includes(tool.risk) && context.approved !== true) throw Object.assign(new Error(`Approval required for ${id}`), { code: 'APPROVAL_REQUIRED' });
    let attempts = 0;
    while (true) {
      attempts += 1;
      try { const output = await tool.execute(input, context); return Object.freeze({ schema: 'nolane.tool-dispatch-result.v1', toolId: tool.id, attempts, output }); }
      catch (error) { if (error?.retryable !== true || attempts > this.maxRetries) throw error; if (this.backoffMs) await sleep(this.backoffMs * attempts); }
    }
  }
  snapshot() { return Object.freeze({ schema: 'nolane.tool-dispatch-pipeline.v1', tools: [...this.tools.keys()].sort(), maxRetries: this.maxRetries }); }
}
