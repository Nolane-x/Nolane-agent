export class McpStdioWatchdog {
  constructor({ maxRestarts = 3, restart, stop } = {}) { if (typeof restart !== 'function' || typeof stop !== 'function') throw new TypeError('restart and stop handlers are required'); this.maxRestarts = Math.max(0, Number(maxRestarts) || 0); this.restartHandler = restart; this.stopHandler = stop; this.restarts = 0; this.state = 'idle'; this.closed = false; }
  async start() { if (this.closed) throw Object.assign(new Error('Watchdog closed'), { code: 'WATCHDOG_CLOSED' }); this.state = 'running'; return this.snapshot(); }
  async markFailure(error = {}) { if (this.restarts >= this.maxRestarts) throw Object.assign(new Error('MCP restart budget exhausted'), { code: 'RESTART_BUDGET_EXHAUSTED' }); this.restarts += 1; this.state = 'restarting'; await this.restartHandler({ attempt: this.restarts, errorCode: String(error.code ?? 'UNKNOWN') }); this.state = 'running'; return this.snapshot(); }
  async close() { if (this.closed) return false; this.closed = true; this.state = 'closed'; await this.stopHandler(); return true; }
  snapshot() { return Object.freeze({ schema: 'nolane.mcp-stdio-watchdog.v1', state: this.state, restarts: this.restarts, maxRestarts: this.maxRestarts }); }
}
