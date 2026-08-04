import { execFile } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
function defaultRunner(command, args, options = {}) { return execFileAsync(command, args, { cwd: options.cwd, windowsHide: true, timeout: options.timeoutMs ?? 30_000, maxBuffer: options.maxOutputBytes ?? 2_000_000 }); }
function coded(code, message, statusCode = 400) { return Object.assign(new Error(message), { code, statusCode }); }
function safeId(value) { const text = String(value ?? '').trim(); if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(text)) throw new TypeError('Invalid Podman sandbox id'); return text; }
function imageRef(value) { const text = String(value ?? '').trim(); if (!/^[A-Za-z0-9][A-Za-z0-9._:@/+\-]{0,255}$/.test(text)) throw new TypeError('Invalid Podman image reference'); return text; }
function integer(value, label) { const number = Number(value); if (!Number.isInteger(number) || number <= 0) throw new TypeError(`${label} must be a positive integer`); return number; }
function commandArgv(value) { if (value == null) return []; if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.includes('\0'))) throw new TypeError('command must be a string array'); return value.slice(0, 128); }

export class PodmanSandboxDriver {
  constructor({ runner = defaultRunner, command = 'podman' } = {}) { this.runner = runner; this.command = String(command); }
  async capabilities() {
    try {
      const { stdout = '' } = await this.runner(this.command, ['version', '--format', 'json'], { timeoutMs: 5_000, maxOutputBytes: 256_000 });
      const parsed = JSON.parse(String(stdout)); const version = parsed?.Client?.Version ?? parsed?.client?.version ?? null;
      return Object.freeze({ schema: 'forge.podman-capabilities.v1', available: Boolean(version), version, externalRuntime: true, rootlessRequired: true, networkDefault: 'deny' });
    } catch (error) { return Object.freeze({ schema: 'forge.podman-capabilities.v1', available: false, version: null, externalRuntime: true, rootlessRequired: true, networkDefault: 'deny', reason: error?.code === 'ENOENT' ? 'not-installed' : 'probe-failed' }); }
  }
  async create({ id, image, workspaceRoot, limits = {}, command = [], allowNetwork = false } = {}) {
    const sandboxId = safeId(id); const containerImage = imageRef(image); const workspace = await realpath(path.resolve(String(workspaceRoot ?? '')));
    const capability = await this.capabilities(); if (!capability.available) throw coded('PODMAN_UNAVAILABLE', 'Podman runtime is unavailable', 503);
    const cpuPercent = integer(limits.cpuPercent, 'cpuPercent'); const memoryBytes = integer(limits.memoryBytes, 'memoryBytes'); const processCount = integer(limits.processCount, 'processCount');
    const argv = ['create', '--name', `forge-${sandboxId}`, '--label', 'io.forge-studio.managed=true', '--userns=keep-id', '--security-opt=no-new-privileges', '--cap-drop=all', '--read-only', `--pids-limit=${processCount}`,  `--cpus=${Number((cpuPercent / 100).toFixed(3))}`, `--memory=${memoryBytes}`, allowNetwork ? '--network=slirp4netns' : '--network=none', '--workdir', '/workspace', '--volume', `${workspace}:/workspace:rw,rprivate,nosuid,nodev`, containerImage, ...commandArgv(command)];
    const { stdout = '' } = await this.runner(this.command, argv, { cwd: workspace, timeoutMs: 30_000, maxOutputBytes: 256_000 });
    const containerId = String(stdout).trim(); if (!containerId) throw coded('PODMAN_CREATE_FAILED', 'Podman did not return a container id', 502);
    return Object.freeze({ schema: 'forge.podman-sandbox.v1', id: sandboxId, containerId, workspaceRoot: workspace, image: containerImage, network: allowNetwork ? 'slirp4netns' : 'none', argv: Object.freeze(argv) });
  }
  async start(containerId) { const id = String(containerId ?? '').trim(); if (!/^[A-Za-z0-9_.-]{1,128}$/.test(id)) throw new TypeError('Invalid container id'); await this.runner(this.command, ['start', id], { timeoutMs: 30_000, maxOutputBytes: 256_000 }); return Object.freeze({ containerId: id, state: 'started' }); }
  async remove(containerId) { const id = String(containerId ?? '').trim(); if (!/^[A-Za-z0-9_.-]{1,128}$/.test(id)) throw new TypeError('Invalid container id'); await this.runner(this.command, ['rm', '--force', id], { timeoutMs: 30_000, maxOutputBytes: 256_000 }); return Object.freeze({ containerId: id, state: 'removed' }); }
}
