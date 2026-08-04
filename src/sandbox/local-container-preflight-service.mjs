import { spawn } from 'node:child_process';
import path from 'node:path';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const SOCKET_PATTERNS = [
  /(^|\/)var\/run\/docker\.sock$/i,
  /(^|\/)run\/podman\/podman\.sock$/i,
  /docker_engine/i,
  /ssh[-_]?agent[^/]*\.sock$/i,
];
const CREDENTIAL_PATTERNS = [/(^|\/)\.ssh(?:\/|$)/i, /(^|\/)\.aws(?:\/|$)/i, /(^|\/)\.docker(?:\/|$)/i, /(^|\/)\.config\/gcloud(?:\/|$)/i];
const SENSITIVE_TARGETS = [/^\/etc(?:\/|$)/, /^\/root(?:\/|$)/, /^\/var\/run(?:\/|$)/, /^\/run(?:\/|$)/, /^C:\\Windows(?:\\|$)/i];

function defaultSpawn(command, args, options) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { ...options, shell: false, windowsHide: true });
    const stdout = []; const stderr = [];
    child.stdout?.on('data', (chunk) => stdout.push(chunk));
    child.stderr?.on('data', (chunk) => stderr.push(chunk));
    const timer = setTimeout(() => child.kill('SIGKILL'), options.timeoutMs ?? 5_000);
    child.once('error', (error) => { clearTimeout(timer); resolve({ exitCode: -1, stdout: '', stderr: error.message }); });
    child.once('close', (code) => { clearTimeout(timer); resolve({ exitCode: Number(code ?? -1), stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') }); });
  });
}

function within(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function validateMount(projectRoot, mount) {
  const source = path.resolve(String(mount?.source ?? ''));
  const target = String(mount?.target ?? '').trim();
  const readOnly = mount?.readOnly !== false;
  if (!target || (!path.posix.isAbsolute(target) && !path.win32.isAbsolute(target))) throw new TypeError('Mount target must be absolute');
  if (SOCKET_PATTERNS.some((pattern) => pattern.test(source))) throw Object.assign(new Error(`Socket escape mount is forbidden: ${source}`), { code: 'CONTAINER_SOCKET_ESCAPE' });
  if (CREDENTIAL_PATTERNS.some((pattern) => pattern.test(source))) throw Object.assign(new Error(`Credential directory mount is forbidden: ${source}`), { code: 'CONTAINER_CREDENTIAL_MOUNT' });
  if (!within(projectRoot, source)) throw Object.assign(new Error(`Mount source is outside project: ${source}`), { code: 'CONTAINER_MOUNT_OUTSIDE_PROJECT' });
  if (!readOnly && SENSITIVE_TARGETS.some((pattern) => pattern.test(target))) throw Object.assign(new Error(`Writable sensitive destination is forbidden: ${target}`), { code: 'CONTAINER_SENSITIVE_DESTINATION' });
  return Object.freeze({ source, target, readOnly });
}

export class LocalContainerPreflightService {
  constructor({ spawnProcess = defaultSpawn } = {}) { this.spawnProcess = spawnProcess; }

  async check({ projectRoot, mounts = [] } = {}) {
    const root = path.resolve(String(projectRoot ?? ''));
    if (!path.isAbsolute(root)) throw new TypeError('projectRoot must be absolute');
    if (!Array.isArray(mounts) || mounts.length > 32) throw new TypeError('mounts must contain at most 32 entries');
    const validatedMounts = Object.freeze(mounts.map((mount) => validateMount(root, mount)));
    const probe = await this.spawnProcess('docker', ['info', '--format', '{{json .ServerVersion}}'], { shell: false, timeoutMs: 5_000, cwd: root });
    const available = probe.exitCode === 0;
    let version = null;
    if (available) {
      try { const parsed = JSON.parse(String(probe.stdout ?? '').trim()); version = typeof parsed === 'string' ? parsed : parsed?.ServerVersion ?? parsed; }
      catch { version = String(probe.stdout ?? '').trim() || null; }
    }
    const base = Object.freeze({
      schema: 'forge.local-container-preflight.v1',
      status: available ? 'pass' : 'unavailable',
      projectRoot: root,
      daemon: Object.freeze({ available, version, reason: available ? null : String(probe.stderr || probe.stdout || 'Docker daemon unavailable').slice(0, 2_000) }),
      mounts: validatedMounts,
      socketEscapeChecked: true,
      containerCreated: false,
    });
    return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
}
