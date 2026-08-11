import { spawn } from 'node:child_process';

function required(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required`);
  return text;
}

function safeArgs(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) throw new TypeError(`${label} must be an array of strings`);
  return [...value];
}

async function runProcess({ executable, args, timeoutMs = 15_000 }) {
  return new Promise((resolve) => {
    const child = spawn(executable, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; try { child.kill('SIGKILL'); } catch {} }, timeoutMs);
    timer.unref?.();
    child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
    child.once('error', (error) => { clearTimeout(timer); resolve({ exitCode: null, stdout, stderr, timedOut, error }); });
    child.once('close', (exitCode) => { clearTimeout(timer); resolve({ exitCode, stdout, stderr, timedOut, error: null }); });
  });
}

async function launchProcess({ executable, args, cwd = null }) {
  const child = spawn(executable, args, {
    cwd: cwd ?? undefined,
    shell: false,
    windowsHide: false,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  return Object.freeze({ launched: true, pid: child.pid ?? null });
}

function parseStatus(result, { mode = 'authenticated' } = {}) {
  const combined = `${result?.stdout ?? ''}\n${result?.stderr ?? ''}`.trim();
  const available = result?.error?.code !== 'ENOENT';
  if (mode === 'available-only') return Object.freeze({
    available,
    authenticated: false,
    healthy: false,
    email: null,
    planType: null,
    error: available ? 'connection-test-required' : 'not-installed',
  });
  let payload = null;
  try { payload = result?.stdout?.trim() ? JSON.parse(result.stdout) : null; } catch {}
  const explicit = payload?.authenticated ?? payload?.loggedIn ?? payload?.isAuthenticated ?? payload?.logged_in;
  const negative = /not\s+(?:logged|signed)\s+in|unauthenticated|login required|no active account/i.test(combined);
  const authenticated = explicit === undefined ? (result?.exitCode === 0 && !negative) : Boolean(explicit);
  const email = payload?.email ?? payload?.account?.email ?? null;
  const planType = payload?.subscriptionType ?? payload?.planType ?? payload?.account?.planType ?? null;
  return Object.freeze({
    available,
    authenticated,
    healthy: authenticated && result?.exitCode === 0,
    email: email == null ? null : String(email).slice(0, 200),
    planType: planType == null ? null : String(planType).slice(0, 80),
    error: authenticated ? null : (result?.error?.code === 'ENOENT' ? 'not-installed' : (combined.slice(0, 240) || 'login-required')),
  });
}

export function createAvailabilityOnlyCliAuthAdapter({ id, label, executable, statusArgs = ['--version'], loginArgs = {}, runner = runProcess, launcher = launchProcess, timeoutMs = 15_000, cwd = null } = {}) {
  const cleanId = required(id, 'adapter id');
  const cleanLabel = required(label ?? id, 'adapter label');
  const cleanExecutable = required(executable, 'executable');
  const cleanStatusArgs = safeArgs(statusArgs, 'statusArgs');
  const cleanLoginArgs = Object.freeze(Object.fromEntries(Object.entries(loginArgs).map(([key, args]) => [String(key), safeArgs(args, `loginArgs.${key}`)])));
  const cleanTimeout = Number(timeoutMs);
  if (!Number.isInteger(cleanTimeout) || cleanTimeout < 10) throw new TypeError('timeoutMs is invalid');
  return Object.freeze({
    id: cleanId,
    label: cleanLabel,
    loginArgs: cleanLoginArgs,
    logoutArgs: null,
    async status() {
      const result = await runner({ executable: cleanExecutable, args: cleanStatusArgs, timeoutMs: cleanTimeout, cwd });
      return Object.freeze({ id: cleanId, label: cleanLabel, ...parseStatus(result, { mode: 'available-only' }) });
    },
    async startLogin({ type = Object.keys(cleanLoginArgs)[0] } = {}) {
      const args = cleanLoginArgs[String(type)];
      if (!args) throw new TypeError(`Unsupported ${cleanLabel} login type: ${type}`);
      return Object.freeze({ id: cleanId, type: String(type), ...(await launcher({ executable: cleanExecutable, args, cwd })) });
    },
  });
}

export class CliAuthAdapter {
  constructor({ id, label, executable, statusArgs, statusMode = 'authenticated', loginArgs = {}, logoutArgs = null, runner = runProcess, launcher = launchProcess, timeoutMs = 15_000, cwd = null } = {}) {
    this.id = required(id, 'adapter id');
    this.label = required(label ?? id, 'adapter label');
    this.executable = required(executable, 'executable');
    this.statusArgs = safeArgs(statusArgs, 'statusArgs');
    if (!['authenticated', 'available-only'].includes(statusMode)) throw new TypeError('statusMode is invalid');
    this.statusMode = statusMode;
    this.loginArgs = Object.fromEntries(Object.entries(loginArgs).map(([key, args]) => [String(key), safeArgs(args, `loginArgs.${key}`)]));
    this.logoutArgs = logoutArgs == null ? null : safeArgs(logoutArgs, 'logoutArgs');
    this.runner = runner; this.launcher = launcher; this.timeoutMs = Number(timeoutMs); this.cwd = cwd;
  }

  async status() {
    const result = await this.runner({ executable: this.executable, args: this.statusArgs, timeoutMs: this.timeoutMs, cwd: this.cwd });
    return Object.freeze({ id: this.id, label: this.label, ...parseStatus(result, { mode: this.statusMode }) });
  }

  async startLogin({ type = Object.keys(this.loginArgs)[0] } = {}) {
    const args = this.loginArgs[String(type)];
    if (!args) throw new TypeError(`Unsupported ${this.label} login type: ${type}`);
    return Object.freeze({ id: this.id, type: String(type), ...(await this.launcher({ executable: this.executable, args, cwd: this.cwd })) });
  }

  async logout() {
    if (!this.logoutArgs) throw new Error(`${this.label} logout is not supported`);
    const result = await this.runner({ executable: this.executable, args: this.logoutArgs, timeoutMs: this.timeoutMs, cwd: this.cwd });
    if (result.exitCode !== 0) throw new Error(`${this.label} logout failed: ${String(result.stderr || result.stdout).slice(0, 240)}`);
    return Object.freeze({ id: this.id, loggedOut: true });
  }
}
