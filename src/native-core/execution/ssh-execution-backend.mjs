import { spawn } from 'node:child_process';
import { spawnSync } from 'node:child_process';

const defaultRunner = ({ args, signal }) => new Promise((resolve, reject) => {
  const child = spawn('ssh', args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const stdout = []; const stderr = [];
  const abort = () => child.kill('SIGKILL');
  signal?.addEventListener?.('abort', abort, { once: true });
  child.stdout.on('data', (chunk) => stdout.push(Buffer.from(chunk)));
  child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)));
  child.on('error', reject);
  child.on('close', (code) => { signal?.removeEventListener?.('abort', abort); resolve({ exitCode: code, stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') }); });
});
const safeToken = (value, label) => { const text = String(value ?? ''); if (!/^[a-zA-Z0-9._:@/-]+$/.test(text)) throw Object.assign(new Error(`Unsafe ${label}`), { code: 'INVALID_INPUT' }); return text; };

export class SshExecutionBackend {
  constructor({ id = 'ssh', runner = defaultRunner, available = null, credentialResolver = () => null } = {}) {
    this.id = String(id); this.kind = 'ssh'; this.runner = runner; this.credentialResolver = credentialResolver;
    this.capabilities = Object.freeze(['cancel', 'non-pty', 'remote', 'teardown']);
    this.availability = available ?? (() => spawnSync('ssh', ['-V'], { stdio: 'ignore', timeout: 3000 }).status === 0);
    this.closed = new Set();
  }
  available() { return Boolean(this.availability()); }
  async execute({ host, user, command = [], port = 22, credentialRef, signal = null } = {}) {
    if (!this.available()) throw Object.assign(new Error(`Execution backend unavailable: ${this.id}`), { code: 'BACKEND_UNAVAILABLE', backendId: this.id });
    if (!Array.isArray(command) || command.length === 0) throw Object.assign(new TypeError('SSH command is required'), { code: 'INVALID_INPUT' });
    const identityFile = await this.credentialResolver(String(credentialRef ?? ''));
    if (!identityFile) throw Object.assign(new Error('SSH credential reference unavailable'), { code: 'CREDENTIAL_UNAVAILABLE' });
    const target = `${safeToken(user, 'SSH user')}@${safeToken(host, 'SSH host')}`;
    const args = ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-p', String(Number(port) || 22), '-i', String(identityFile), target, '--', ...command.map((entry) => safeToken(entry, 'SSH command token'))];
    return Object.freeze({ ...(await this.runner({ args, signal })), mode: 'non-pty', target });
  }
  async teardown({ remoteId = null } = {}) { if (!remoteId || this.closed.has(remoteId)) return false; this.closed.add(remoteId); return true; }
}
