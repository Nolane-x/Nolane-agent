import path from 'node:path';
import { ExecutionBackendRegistry } from './execution-backend-registry.mjs';
import { ToolExecutionFabric } from './tool-execution-fabric.mjs';
import { LocalProcessBackend } from './execution/local-process-backend.mjs';
import { ContainerBackend } from './execution/container-backend.mjs';
import { SshExecutionBackend } from './execution/ssh-execution-backend.mjs';
import { DaemonPool } from './execution/daemon-pool.mjs';
import { LazyDependencyResolver } from './execution/lazy-dependency-resolver.mjs';
import { ToolDispatchPipeline } from './execution/tool-dispatch-pipeline.mjs';
import { ShellHookPolicy } from './execution/shell-hook-policy.mjs';
import { McpStdioWatchdog } from './execution/mcp-stdio-watchdog.mjs';
import { ExecutionArtifactTransfer } from './execution/execution-artifact-transfer.mjs';

const adapt = (backend) => ({ id: backend.id, kind: backend.kind, capabilities: backend.capabilities, available: () => backend.available(), execute: (input) => backend.execute(input), cleanup: (input) => backend.teardown(input) });

export class ExecutionRuntimeWave7 {
  constructor({ workspaceRoot, dataDir, credentialResolver = () => null, containerAvailable = () => false, sshAvailable = () => false } = {}) {
    if (!workspaceRoot || !dataDir) throw new TypeError('workspaceRoot and dataDir are required');
    this.workspaceRoot = path.resolve(workspaceRoot); this.dataDir = path.resolve(dataDir);
    this.registry = new ExecutionBackendRegistry();
    this.local = new LocalProcessBackend({ workspaceRoot: this.workspaceRoot, credentialResolver });
    this.container = new ContainerBackend({ available: containerAvailable, allowImages: [] });
    this.ssh = new SshExecutionBackend({ available: sshAvailable, credentialResolver });
    this.registry.register(adapt(this.local)).register(adapt(this.container)).register(adapt(this.ssh));
    this.fabric = new ToolExecutionFabric({ registry: this.registry });
    this.dependencies = new LazyDependencyResolver();
    this.dispatch = new ToolDispatchPipeline({ maxRetries: 2 });
    this.hooks = new ShellHookPolicy({ allowedCommands: [process.execPath] });
    this.daemons = new DaemonPool({ maxSize: 4, factory: async (id) => ({ id, close: async () => {} }) });
    this.watchdog = new McpStdioWatchdog({ maxRestarts: 2, restart: async () => {}, stop: async () => {} });
    this.artifacts = new ExecutionArtifactTransfer({ sourceRoot: this.workspaceRoot, targetRoot: path.join(this.dataDir, 'execution-artifacts') });
  }
  execute(input) { return this.fabric.execute(input); }
  snapshot() { return Object.freeze({ schema: 'nolane.execution-runtime-wave7.v1', backends: this.registry.describe(), dependencies: this.dependencies.snapshot(), dispatch: this.dispatch.snapshot(), daemons: this.daemons.snapshot(), watchdog: this.watchdog.snapshot() }); }
  async close() { await Promise.all([this.local.teardown(), this.daemons.close(), this.watchdog.close()]); }
}
