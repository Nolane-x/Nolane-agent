import { spawn } from 'node:child_process';

function bounded(value, max = 2_000_000) {
  const text = String(value ?? '');
  if (Buffer.byteLength(text, 'utf8') <= max) return text;
  return Buffer.from(text, 'utf8').subarray(0, max).toString('utf8') + '\n[TRUNCATED]';
}

async function defaultRunProcess({ executable, args, cwd = null, env = {}, timeoutMs = 60_000, maxOutputBytes = 2_000_000, signal = null }) {
  const started = Date.now();
  const child = spawn(executable, args, { cwd: cwd ?? undefined, env: { ...process.env, ...env }, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
  let stdout = ''; let stderr = ''; let timedOut = false; let aborted = false;
  const append = (kind, chunk) => {
    const current = kind === 'stdout' ? stdout : stderr;
    if (Buffer.byteLength(current, 'utf8') >= maxOutputBytes) return;
    const next = bounded(current + chunk.toString('utf8'), maxOutputBytes);
    if (kind === 'stdout') stdout = next; else stderr = next;
  };
  child.stdout.on('data', (chunk) => append('stdout', chunk));
  child.stderr.on('data', (chunk) => append('stderr', chunk));
  const kill = () => { try { if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch {} } };
  const timer = setTimeout(() => { timedOut = true; kill(); }, Math.max(100, Number(timeoutMs) || 60_000)); timer.unref?.();
  const onAbort = () => { aborted = true; kill(); };
  if (signal?.aborted) onAbort(); else signal?.addEventListener?.('abort', onAbort, { once: true });
  try {
    const result = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (exitCode, signalName) => resolve({ exitCode, signalName })); });
    return Object.freeze({ executable, args: Object.freeze([...args]), exitCode: result.exitCode ?? 1, signal: result.signalName ?? null, stdout: bounded(stdout, maxOutputBytes), stderr: bounded(stderr, maxOutputBytes), timedOut, aborted, durationMs: Date.now() - started });
  } finally { clearTimeout(timer); signal?.removeEventListener?.('abort', onAbort); }
}

function versionOf(output) { return String(output ?? '').match(/\b(\d+\.\d+(?:\.\d+)?(?:[-+][\w.-]+)?)\b/)?.[1] ?? null; }

export class PlaywrightCliDriver {
  constructor({ runProcess = defaultRunProcess, runtimeInstaller = null, timeoutMs = 60_000, maxOutputBytes = 2_000_000 } = {}) {
    if (typeof runProcess !== 'function') throw new TypeError('runProcess is required');
    this.runProcess = runProcess;
    this.runtimeInstaller = runtimeInstaller;
    this.timeoutMs = Math.max(1_000, Number(timeoutMs) || 60_000);
    this.maxOutputBytes = Math.max(4_096, Number(maxOutputBytes) || 2_000_000);
    this.detected = null;
  }

  async detect({ force = false } = {}) {
    if (this.detected && !force) return this.detected;
    if (this.runtimeInstaller?.status) {
      const managed = await this.runtimeInstaller.status();
      if (managed?.ready && managed.command?.executable) {
        this.detected = Object.freeze({
          available: true,
          source: 'managed',
          command: managed.command.executable,
          prefixArgs: Object.freeze([...(managed.command.prefixArgs ?? [])]),
          version: managed.version ?? null,
          browsersPath: managed.browsersPath ?? null,
          attempts: Object.freeze([]),
        });
        return this.detected;
      }
    }
    const candidates = [
      { command: 'playwright-cli', prefixArgs: [] },
      { command: 'npx', prefixArgs: ['--no-install', 'playwright-cli'] },
    ];
    const attempts = [];
    for (const candidate of candidates) {
      try {
        const result = await this.runProcess({ executable: candidate.command, args: [...candidate.prefixArgs, '--version'], timeoutMs: 5_000, maxOutputBytes: 32_000 });
        attempts.push({ ...candidate, exitCode: result.exitCode });
        if (result.exitCode === 0) {
          this.detected = Object.freeze({ available: true, ...candidate, version: versionOf(`${result.stdout}\n${result.stderr}`), attempts: Object.freeze(attempts) });
          return this.detected;
        }
      } catch (error) { attempts.push({ ...candidate, error: error.code === 'ENOENT' ? 'not-found' : String(error.message ?? error) }); }
    }
    this.detected = Object.freeze({ available: false, reason: 'not installed', installCommand: 'npm install -g @playwright/cli@latest', attempts: Object.freeze(attempts) });
    return this.detected;
  }

  async installRuntime({ force = false } = {}) {
    if (!this.runtimeInstaller?.install) throw new Error('Managed Playwright runtime installer is not configured');
    const result = await this.runtimeInstaller.install({ force });
    this.detected = null;
    return result;
  }

  async run({ sessionName, args, cwd = null, env = {}, timeoutMs = this.timeoutMs, signal = null, maxOutputBytes = this.maxOutputBytes } = {}) {
    const detected = await this.detect();
    if (!detected.available) throw new Error(`Playwright CLI is not installed. Run: ${detected.installCommand}`);
    if (!Array.isArray(args) || args.some((item) => typeof item !== 'string')) throw new TypeError('browser args must be strings');
    const sessionArgs = sessionName ? [`-s=${String(sessionName)}`] : [];
    return this.runProcess({ executable: detected.command, args: [...detected.prefixArgs, ...sessionArgs, ...args], cwd, env: { ...(detected.browsersPath ? { PLAYWRIGHT_BROWSERS_PATH: detected.browsersPath } : {}), ...env }, timeoutMs, signal, maxOutputBytes });
  }

  async captureJourney({ sessionName, cwd = null, screenshotPath = null, videoPath = null, depth = 4, signal = null } = {}) {
    const safeDepth = Math.max(1, Math.min(12, Math.floor(Number(depth) || 4)));
    const snapshot = await this.run({ sessionName, args: ['snapshot', `--depth=${safeDepth}`], cwd, signal, maxOutputBytes: Math.min(this.maxOutputBytes, 1_000_000) });
    if (snapshot.exitCode !== 0) throw new Error(`Playwright journey snapshot failed (${snapshot.exitCode})`);
    if (screenshotPath) {
      const screenshot = await this.run({ sessionName, args: ['screenshot', `--filename=${String(screenshotPath)}`], cwd, signal, maxOutputBytes: 100_000 });
      if (screenshot.exitCode !== 0) throw new Error(`Playwright journey screenshot failed (${screenshot.exitCode})`);
    }
    return Object.freeze({
      schema: 'forge.playwright-journey-capture.v1',
      domSnapshot: bounded(snapshot.stdout || snapshot.stderr, 1_000_000),
      accessibility: Object.freeze({ status: 'snapshot-derived', nodes: Object.freeze([]), violations: Object.freeze([]) }),
      console: Object.freeze({ status: 'unavailable', reason: 'playwright-cli-console-capture-not-operated' }),
      network: Object.freeze({ status: 'unavailable', reason: 'playwright-cli-network-capture-not-operated' }),
      artifacts: Object.freeze([{ kind: 'screenshot', path: screenshotPath ? String(screenshotPath) : null }, { kind: 'video', path: videoPath ? String(videoPath) : null }]),
    });
  }

}
