import { JsonlRpcProcess } from '../protocol/jsonl-rpc-process.mjs';
import { VERSION } from '../version.mjs';

function childEnvironment(env = {}) {
  const names = process.platform === 'win32'
    ? ['PATH', 'Path', 'SYSTEMROOT', 'SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TEMP', 'TMP']
    : ['PATH', 'TMPDIR', 'TMP', 'TEMP'];
  const base = {};
  for (const name of names) {
    const value = process.env[name];
    if (typeof value !== 'string' || !value) continue;
    if (name === 'Path' && base.PATH) continue;
    base[name === 'Path' ? 'PATH' : name] = value;
  }
  return { ...base, ...env };
}

export class StdioMcpClient {
  constructor({ id, label = id, executable, args = [], cwd = null, env = {}, timeoutMs = 30_000, protocolVersion = '2025-11-25' } = {}) {
    if (!String(id ?? '').trim()) throw new TypeError('MCP id is required');
    this.id = String(id); this.label = String(label ?? id); this.executable = String(executable ?? ''); this.args = [...args]; this.cwd = cwd; this.timeoutMs = timeoutMs; this.protocolVersion = protocolVersion;
    this.rpc = new JsonlRpcProcess({ executable: this.executable, args: this.args, cwd, env: childEnvironment(env), inheritEnvironment: false, timeoutMs });
    this.state = 'idle'; this.serverInfo = null; this.capabilities = {}; this.toolCache = null;
    this.rpc.on('closed', () => { this.state = 'closed'; });
  }

  publicView() { return Object.freeze({ id: this.id, label: this.label, kind: 'mcp-stdio', executable: this.executable, args: Object.freeze([...this.args]), state: this.state, serverInfo: this.serverInfo }); }

  async connect() {
    if (this.state === 'ready') return Object.freeze({ serverInfo: this.serverInfo, capabilities: this.capabilities, protocolVersion: this.protocolVersion });
    this.state = 'connecting';
    await this.rpc.start();
    const result = await this.rpc.request('initialize', { protocolVersion: this.protocolVersion, capabilities: {}, clientInfo: { name: 'forge-studio', version: VERSION } });
    this.protocolVersion = result.protocolVersion ?? this.protocolVersion; this.capabilities = Object.freeze(result.capabilities ?? {}); this.serverInfo = Object.freeze(result.serverInfo ?? { name: this.id });
    this.rpc.notify('notifications/initialized', {}); this.state = 'ready';
    return Object.freeze({ serverInfo: this.serverInfo, capabilities: this.capabilities, protocolVersion: this.protocolVersion });
  }

  request(method, params, options) { return this.rpc.request(method, params, options); }

  async listTools({ refresh = false } = {}) {
    await this.connect();
    if (this.toolCache && !refresh) return this.toolCache;
    const result = await this.rpc.request('tools/list', {});
    const tools = [...(result.tools ?? [])].map((tool) => Object.freeze({ name: String(tool.name), description: String(tool.description ?? ''), inputSchema: Object.freeze(tool.inputSchema ?? { type: 'object' }), outputSchema: tool.outputSchema ? Object.freeze(tool.outputSchema) : null })).sort((a, b) => a.name.localeCompare(b.name));
    this.toolCache = Object.freeze(tools); return this.toolCache;
  }

  async callTool(name, args = {}, options = {}) {
    await this.connect();
    return this.rpc.request('tools/call', { name: String(name), arguments: structuredClone(args) }, options);
  }

  async close() { await this.rpc.close(); this.state = 'closed'; }
}
