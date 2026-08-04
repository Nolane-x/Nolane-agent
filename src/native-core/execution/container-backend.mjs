import { spawn } from 'node:child_process';
import { spawnSync } from 'node:child_process';

const runProcess = ({ runtime, args, signal }) => new Promise((resolve, reject) => {
  const child = spawn(runtime, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const stdout = []; const stderr = [];
  const abort = () => child.kill('SIGKILL');
  signal?.addEventListener?.('abort', abort, { once: true });
  child.stdout.on('data', (chunk) => stdout.push(Buffer.from(chunk)));
  child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)));
  child.on('error', reject);
  child.on('close', (code) => { signal?.removeEventListener?.('abort', abort); resolve({ exitCode: code, stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') }); });
});

export class ContainerBackend {
  constructor({ id = 'container', runtime = 'docker', runner = runProcess, available = null, allowImages = [] } = {}) {
    if (!['docker', 'podman'].includes(runtime)) throw new TypeError('runtime must be docker or podman');
    this.id = String(id); this.kind = 'container'; this.runtime = runtime; this.runner = runner;
    this.capabilities = Object.freeze(['cancel', 'container', 'non-pty', 'teardown']);
    this.allowImages = new Set(allowImages.map(String));
    this.availability = available ?? (() => spawnSync(this.runtime, ['version'], { stdio: 'ignore', timeout: 3000 }).status === 0);
    this.closed = new Set();
  }
  available() { return Boolean(this.availability()); }
  async execute({ image, command = [], signal = null, cpuLimit = 1, memoryMb = 512, network = false } = {}) {
    if (!this.available()) throw Object.assign(new Error(`Execution backend unavailable: ${this.id}`), { code: 'BACKEND_UNAVAILABLE', backendId: this.id });
    if (!this.allowImages.has(String(image))) throw Object.assign(new Error(`Container image not allowlisted: ${image}`), { code: 'IMAGE_NOT_ALLOWED' });
    if (!Array.isArray(command) || command.length === 0) throw Object.assign(new TypeError('container command is required'), { code: 'INVALID_INPUT' });
    const args = ['run', '--rm', '--cpus', String(cpuLimit), '--memory', `${Math.max(16, Number(memoryMb) || 512)}m`, '--network', network ? 'bridge' : 'none', String(image), ...command.map(String)];
    return Object.freeze({ ...(await this.runner({ runtime: this.runtime, args, signal })), mode: 'non-pty' });
  }
  async teardown({ containerId = null } = {}) {
    if (!containerId || this.closed.has(containerId)) return false;
    this.closed.add(containerId); return true;
  }
}
