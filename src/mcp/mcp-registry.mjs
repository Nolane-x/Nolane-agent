export class McpRegistry {
  #clients = new Map();
  register(client) {
    if (!client?.id) throw new TypeError('MCP client id is required');
    if (this.#clients.has(client.id)) throw new Error(`Duplicate MCP client: ${client.id}`);
    this.#clients.set(client.id, client); return client;
  }
  get(id) { const client = this.#clients.get(String(id)); if (!client) throw new Error(`Unknown MCP client: ${id}`); return client; }
  publicView() { return [...this.#clients.values()].map((client) => client.publicView()); }
  async listTools() {
    const output = [];
    for (const client of [...this.#clients.values()].sort((a, b) => a.id.localeCompare(b.id))) {
      for (const tool of await client.listTools()) output.push(Object.freeze({ ...tool, serverId: client.id, originalName: tool.name, name: `${client.id}__${tool.name}` }));
    }
    return Object.freeze(output);
  }
  async callTool(namespacedName, args = {}, options = {}) {
    const separator = String(namespacedName).indexOf('__');
    if (separator < 1) throw new Error('MCP tool name must be namespaced as server__tool');
    const serverId = namespacedName.slice(0, separator); const tool = namespacedName.slice(separator + 2);
    return this.get(serverId).callTool(tool, args, options);
  }
  async close() { await Promise.allSettled([...this.#clients.values()].map((client) => client.close())); }
}
