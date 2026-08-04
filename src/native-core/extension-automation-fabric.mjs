const freeze = (value) => {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, freeze(entry)])));
  return value;
};

export class ExtensionAutomationFabric {
  constructor({ plugins = null, mcp = null, scheduler = null, subagents = null } = {}) { this.plugins = plugins; this.mcp = mcp; this.scheduler = scheduler; this.subagents = subagents; }
  async listMcpTools({ allowedTools = [] } = {}) {
    if (!this.mcp?.listTools) throw new Error('MCP registry is unavailable');
    const allowed = new Set(allowedTools.map(String)); const tools = await this.mcp.listTools();
    return freeze(tools.filter((tool) => allowed.has(tool.name)));
  }
  async callMcpTool(name, args = {}, { allowedTools = [] } = {}) {
    if (!allowedTools.map(String).includes(String(name))) throw new Error(`MCP tool is not allowed: ${name}`);
    try { return await this.mcp.callTool(name, args); }
    catch (error) {
      if (error?.retryable !== true) throw error;
      const serverId = String(name).split('__')[0]; const client = this.mcp.get(serverId);
      if (typeof client.reconnect !== 'function') throw error;
      await client.reconnect(); return this.mcp.callTool(name, args);
    }
  }
  status() {
    return freeze({ schema: 'nolane.native-core.extension-automation.v1', ready: true, plugins: this.plugins?.snapshot?.().plugins ?? 0, mcpServers: this.mcp?.publicView?.().length ?? 0, schedulerJobs: this.scheduler?.snapshot?.().jobs ?? 0, workers: this.subagents?.snapshot?.().agents ?? 0 });
  }
}
