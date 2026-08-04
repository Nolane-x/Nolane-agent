import path from 'node:path';
import { McpOAuthRuntime } from './mcp-oauth-runtime.mjs';
import { BrowserSupervisorRuntime } from './browser-supervisor-runtime.mjs';
import { AsyncDelegationRuntime } from './async-delegation-runtime.mjs';
import { PtySessionRuntime } from './pty-session-runtime.mjs';
import { GatewayRecoveryRuntime } from './gateway-recovery-runtime.mjs';
import { LocalMediaPipelineRuntime } from './local-media-pipeline-runtime.mjs';
import { freeze } from './native-runtime-utils.mjs';

const unavailablePty = {
  async start() { throw Object.assign(new Error('native PTY backend is unavailable'), { code: 'BACKEND_UNAVAILABLE' }); },
  async write() { throw Object.assign(new Error('native PTY backend is unavailable'), { code: 'BACKEND_UNAVAILABLE' }); },
  async resize() { throw Object.assign(new Error('native PTY backend is unavailable'), { code: 'BACKEND_UNAVAILABLE' }); },
  async stop() { throw Object.assign(new Error('native PTY backend is unavailable'), { code: 'BACKEND_UNAVAILABLE' }); },
};

export class RuntimeWave6Fabric {
  constructor({ dataDir, clock = () => Date.now(), ptyBackend = unavailablePty } = {}) {
    if (!dataDir) throw new TypeError('dataDir is required');
    this.mcpOAuth = new McpOAuthRuntime({ file: path.join(dataDir, 'native-mcp-oauth.json'), clock });
    this.browserSupervisor = new BrowserSupervisorRuntime({ clock });
    this.delegation = new AsyncDelegationRuntime({ file: path.join(dataDir, 'native-async-delegation.json'), clock });
    this.pty = new PtySessionRuntime({ backend: ptyBackend, clock });
    this.gatewayRecovery = new GatewayRecoveryRuntime({ clock });
    this.media = new LocalMediaPipelineRuntime({ directory: path.join(dataDir, 'native-local-media'), clock });
  }
  async open() { await Promise.all([this.mcpOAuth.open(), this.delegation.open(), this.media.open()]); return this.snapshot(); }
  snapshot() { return freeze({ schema: 'nolane.agent.runtime-wave6.v1', mcpOAuth: this.mcpOAuth.snapshot(), browserSupervisor: this.browserSupervisor.snapshot(), delegation: this.delegation.snapshot(), pty: this.pty.snapshot(), gatewayRecovery: this.gatewayRecovery.snapshot(), media: this.media.snapshot() }); }
}
