const freeze = (value) => Object.freeze(structuredClone(value));
const text = (value, max) => String(value ?? '').slice(0, max);
export class UiSummaryService {
  constructor({ getWorkspace = () => null, managedProcesses = null, terminalManager = null, mcpRegistry = null, getArtifacts = () => [], maxItems = 40, maxText = 1000, clock = () => new Date().toISOString() } = {}) { this.getWorkspace = getWorkspace; this.managedProcesses = managedProcesses; this.terminalManager = terminalManager; this.mcpRegistry = mcpRegistry; this.getArtifacts = getArtifacts; this.maxItems = Math.max(1, Math.min(200, Number(maxItems) || 40)); this.maxText = Math.max(64, Math.min(20_000, Number(maxText) || 1000)); this.clock = clock; }
  async snapshot({ projectId = null } = {}) {
    const workspace = this.getWorkspace(projectId); const outputs = [];
    if (workspace?.root || workspace?.workspaceRoot) outputs.push({ id: `workspace:${workspace.id ?? projectId ?? 'current'}`, kind: 'workspace', label: workspace.name ?? 'Workspace', path: workspace.root ?? workspace.workspaceRoot });
    for (const artifact of (await this.getArtifacts(projectId) ?? []).slice(0, this.maxItems - outputs.length)) outputs.push({ id: text(artifact.id ?? artifact.path, 200), kind: text(artifact.kind ?? 'artifact', 40), label: text(artifact.label ?? artifact.name ?? artifact.path, 200), path: text(artifact.path, 1000) });
    const processes = [];
    const managedItems = await (this.managedProcesses?.list?.() ?? []);
    for (const item of managedItems.slice(0, this.maxItems)) processes.push({ id: text(item.id, 120), kind: 'process', label: text([item.command, ...(item.args ?? [])].join(' '), 300), state: text(item.state, 40), pid: item.pid ?? null, cwd: text(item.cwd, 1000), startedAt: item.startedAt ?? null, stdout: text(item.stdout, this.maxText), stderr: text(item.stderr, this.maxText), truncated: Boolean(item.truncated), stoppable: item.state === 'running' || item.state === 'starting' });
    const terminalItems = await (this.terminalManager?.list?.() ?? []);
    for (const item of terminalItems.slice(0, Math.max(0, this.maxItems - processes.length))) processes.push({ id: text(item.id ?? item.sessionId, 120), kind: 'terminal', label: text(item.label ?? item.shell ?? 'Terminal', 300), state: text(item.state ?? 'running', 40), cwd: text(item.cwd, 1000), startedAt: item.startedAt ?? null, stoppable: item.state !== 'exited' });
    const sources = (this.mcpRegistry?.publicView?.() ?? []).slice(0, this.maxItems).map((item) => ({ id: text(item.id, 120), kind: 'mcp', label: text(item.label ?? item.id, 200), state: text(item.state ?? (item.healthy === false ? 'error' : 'ready'), 40), tools: Number(item.tools ?? item.toolCount ?? 0), error: text(item.error, 300) || null }));
    return freeze({ schema: 'nolane.ui.summary.v1', generatedAt: this.clock(), projectId, outputs, processes, sources, availability: { outputs: true, processes: Boolean(this.managedProcesses || this.terminalManager), terminals: Boolean(this.terminalManager), sources: Boolean(this.mcpRegistry) } });
  }
  async stopProcess(id) {
    const clean = String(id ?? '').trim(); if (!clean) throw new TypeError('process id is required');
    if (this.managedProcesses?.stop) {
      try { return await this.managedProcesses.stop(clean); } catch (error) { if (!/not found|unknown/i.test(String(error?.message ?? error))) throw error; }
    }
    if (this.terminalManager?.terminate) return this.terminalManager.terminate(clean);
    throw Object.assign(new Error(`Unknown process: ${clean}`), { statusCode: 404, code: 'process_not_found' });
  }
}
