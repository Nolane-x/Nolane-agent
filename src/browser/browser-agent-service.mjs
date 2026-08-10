import { createHash } from 'node:crypto';
import { mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { redactSecrets } from '../security/redaction.mjs';

function required(value, label, max = 100_000) { const text = String(value ?? '').trim(); if (!text) throw new TypeError(`${label} is required`); if (text.length > max) throw new TypeError(`${label} is too long`); return text; }
function sessionName(projectId) { const slug = String(projectId).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'project'; const hash = createHash('sha256').update(String(projectId)).digest('hex').slice(0, 8); return `forge-${slug}-${hash}`; }
function safeUrl(value) {
  const raw = required(value ?? 'about:blank', 'browser URL', 16_384);
  if (raw === 'about:blank') return raw;
  let url; try { url = new URL(raw); } catch { throw new TypeError('browser URL is invalid'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new TypeError(`browser URL protocol is not allowed: ${url.protocol}`);
  url.username = ''; url.password = '';
  return url.toString();
}
function safeTarget(value) { return required(value, 'browser target', 2_000); }
function safeFilename(value, fallback) {
  const name = String(value ?? fallback).trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,180}\.(?:png|jpe?g|pdf)$/i.test(name) || name.includes('..')) throw new TypeError('browser artifact filename is invalid');
  return name;
}
function artifactMime(filename) { const extension = path.extname(filename).toLowerCase(); return extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg' : extension === '.pdf' ? 'application/pdf' : 'image/png'; }
function outputView(result, maxOutputBytes) {
  const text = String(result.stdout ?? result.stderr ?? '');
  const bytes = Buffer.from(text, 'utf8');
  const output = bytes.length <= maxOutputBytes ? text : `${bytes.subarray(0, maxOutputBytes).toString('utf8')}\n[TRUNCATED]`;
  return { exitCode: result.exitCode, durationMs: result.durationMs ?? null, output: redactSecrets(output), stderr: result.exitCode === 0 ? '' : redactSecrets(String(result.stderr ?? '').slice(0, 4_000)), untrusted: true };
}

export class BrowserAgentService {
  constructor({ driver, leasePool = null, journeyRecorder = null, browserRoot, getProject, maxOutputBytes = 500_000, timeoutMs = 60_000 } = {}) {
    if (!driver?.detect || !driver?.run) throw new TypeError('browser driver is required');
    if (leasePool !== null && typeof leasePool?.run !== 'function') throw new TypeError('leasePool must expose run()');
    if (typeof getProject !== 'function') throw new TypeError('getProject is required');
    if (journeyRecorder !== null && typeof journeyRecorder?.record !== 'function') throw new TypeError('journeyRecorder must expose record()');
    this.driver = driver;
    this.leasePool = leasePool;
    this.journeyRecorder = journeyRecorder;
    this.browserRoot = path.resolve(required(browserRoot, 'browserRoot'));
    this.getProject = getProject;
    this.maxOutputBytes = Math.max(4_096, Number(maxOutputBytes) || 500_000);
    this.timeoutMs = Math.max(1_000, Number(timeoutMs) || 60_000);
  }

  async #context(projectId) {
    const project = this.getProject(required(projectId, 'projectId', 256));
    if (!project) throw new Error(`Unknown project: ${projectId}`);
    const detection = await this.driver.detect();
    if (!detection.available) throw new Error(`Playwright CLI is ${detection.reason ?? 'not installed'}. ${detection.installCommand ? `Run: ${detection.installCommand}` : ''}`.trim());
    const root = path.join(this.browserRoot, sessionName(project.id));
    const profile = path.join(root, 'profile'); const artifacts = path.join(root, 'artifacts');
    await mkdir(profile, { recursive: true }); await mkdir(artifacts, { recursive: true });
    return { project, detection, sessionName: sessionName(project.id), root, profile, artifacts };
  }

  async #withLease(projectId, { leaseContext = null, signal = null, action = 'action' } = {}, fn) {
    if (!this.leasePool) return fn();
    const context = leaseContext && typeof leaseContext === 'object' ? leaseContext : {};
    const { missionId = null, taskId = null, action: requestedAction = null, ...metadata } = context;
    return this.leasePool.run({ key: String(projectId), missionId, taskId, signal: signal ?? null, metadata: { ...metadata, action: String(requestedAction ?? action) } }, fn);
  }

  async #run(projectId, args, options = {}) {
    return this.#withLease(projectId, { leaseContext: options.leaseContext, signal: options.signal, action: options.action ?? args[0] }, async () => {
      const context = await this.#context(projectId);
      const result = await this.driver.run({ sessionName: context.sessionName, args, cwd: context.project.workspaceRoot, timeoutMs: options.timeoutMs ?? this.timeoutMs, signal: options.signal ?? null, maxOutputBytes: this.maxOutputBytes });
      if (result.exitCode !== 0 && options.allowFailure !== true) throw new Error(`Browser action failed (${result.exitCode}): ${redactSecrets(String(result.stderr ?? result.stdout ?? '')).slice(0, 2_000)}`);
      return Object.freeze({ available: true, sessionName: context.sessionName, ...outputView(result, this.maxOutputBytes), artifactPath: options.artifactPath ?? null });
    });
  }

  async detect() { return this.driver.detect(); }
  async open({ projectId, url = 'about:blank', headed = true, persistent = true, mobile = false, leaseContext = null, signal = null } = {}) {
    const normalizedUrl = safeUrl(url);
    return this.#withLease(projectId, { leaseContext, signal, action: 'open' }, async () => {
      const ctx = await this.#context(projectId); const args = ['open', normalizedUrl];
      if (persistent) args.push('--persistent', `--profile=${ctx.profile}`); if (headed) args.push('--headed'); if (mobile) args.push('--mobile');
      const result = await this.driver.run({ sessionName: ctx.sessionName, args, cwd: ctx.project.workspaceRoot, timeoutMs: this.timeoutMs, signal, maxOutputBytes: this.maxOutputBytes });
      if (result.exitCode !== 0) throw new Error(`Browser open failed (${result.exitCode}): ${String(result.stderr ?? '').slice(0, 2_000)}`);
      return Object.freeze({ available: true, sessionName: ctx.sessionName, url: normalizedUrl, headed: Boolean(headed), persistent: Boolean(persistent), ...outputView(result, this.maxOutputBytes) });
    });
  }
  async goto({ projectId, url, leaseContext = null, signal = null } = {}) { return this.#run(projectId, ['goto', safeUrl(url)], { leaseContext, signal, action: 'goto' }); }
  async snapshot({ projectId, depth = 4, target = null, leaseContext = null, signal = null } = {}) { const safeDepth = Math.max(1, Math.min(12, Number(depth) || 4)); return this.#run(projectId, ['snapshot', ...(target ? [safeTarget(target)] : []), `--depth=${safeDepth}`], { leaseContext, signal, action: 'snapshot' }); }
  async find({ projectId, query, regex = false, leaseContext = null, signal = null } = {}) { return this.#run(projectId, ['find', ...(regex ? ['--regex'] : []), required(query, 'browser find query', 5_000)], { leaseContext, signal, action: 'find' }); }
  async click({ projectId, target, button = null, leaseContext = null, signal = null } = {}) { return this.#run(projectId, ['click', safeTarget(target), ...(button ? [required(button, 'mouse button', 32)] : [])], { leaseContext, signal, action: 'click' }); }
  async fill({ projectId, target, text, submit = false, leaseContext = null, signal = null } = {}) { return this.#run(projectId, ['fill', safeTarget(target), required(text, 'browser fill text'), ...(submit ? ['--submit'] : [])], { leaseContext, signal, action: 'fill' }); }
  async type({ projectId, text, leaseContext = null, signal = null } = {}) { return this.#run(projectId, ['type', required(text, 'browser text')], { leaseContext, signal, action: 'type' }); }
  async press({ projectId, key, leaseContext = null, signal = null } = {}) { return this.#run(projectId, ['press', required(key, 'browser key', 128)], { leaseContext, signal, action: 'press' }); }
  async tabs({ projectId, leaseContext = null, signal = null } = {}) { return this.#run(projectId, ['tab-list'], { leaseContext, signal, action: 'tabs' }); }
  async screenshot({ projectId, target = null, filename = 'page.png', leaseContext = null, signal = null } = {}) {
    return this.#withLease(projectId, { leaseContext, signal, action: 'screenshot' }, async () => {
      const context = await this.#context(projectId); const name = safeFilename(filename, 'page.png'); const artifactPath = path.join(context.artifacts, name);
      const result = await this.driver.run({ sessionName: context.sessionName, args: ['screenshot', ...(target ? [safeTarget(target)] : []), `--filename=${artifactPath}`], cwd: context.project.workspaceRoot, timeoutMs: this.timeoutMs, signal, maxOutputBytes: this.maxOutputBytes });
      if (result.exitCode !== 0) throw new Error(`Browser screenshot failed (${result.exitCode})`);
      return Object.freeze({ available: true, sessionName: context.sessionName, ...outputView(result, this.maxOutputBytes), artifactPath });
    });
  }
  async artifact({ projectId, filename = 'page.png', leaseContext = null, signal = null } = {}) {
    return this.#withLease(projectId, { leaseContext, signal, action: 'artifact' }, async () => {
      const context = await this.#context(projectId); const name = safeFilename(filename, 'page.png'); const artifactPath = path.join(context.artifacts, name); const info = await stat(artifactPath);
      if (!info.isFile()) throw new Error('Browser artifact is not a file');
      if (info.size > 8 * 1024 * 1024) throw new Error('Browser artifact exceeds the 8 MB UI bound');
      const bytes = await readFile(artifactPath); const digest = createHash('sha256').update(bytes).digest('hex');
      return Object.freeze({ available: true, sessionName: context.sessionName, filename: name, mimeType: artifactMime(name), bytes: bytes.length, contentBase64: bytes.toString('base64'), sha256: digest, untrusted: true });
    });
  }

  async journey({ projectId, missionId = null, taskId = null, url = 'about:blank', depth = 4, screenshotFilename = 'journey.png', videoPath = null, assertions = [], leaseContext = null, signal = null } = {}) {
    if (!this.journeyRecorder || typeof this.driver.captureJourney !== 'function') throw Object.assign(new Error('Browser journey evidence is not configured'), { code: 'BROWSER_JOURNEY_UNAVAILABLE' });
    return this.#withLease(projectId, { leaseContext, signal, action: 'journey' }, async () => {
      const context = await this.#context(projectId);
      const journeyRoot = path.join(context.project.workspaceRoot, '.forge', 'journeys');
      await mkdir(journeyRoot, { recursive: true });
      const name = safeFilename(screenshotFilename, 'journey.png');
      const screenshotPath = path.join(journeyRoot, name);
      const captured = await this.driver.captureJourney({ sessionName: context.sessionName, cwd: context.project.workspaceRoot, screenshotPath, videoPath, depth, signal });
      return this.journeyRecorder.record({
        projectId: context.project.id, missionId, taskId, sessionId: context.sessionName, url,
        domSnapshot: captured.domSnapshot, accessibility: captured.accessibility,
        consoleEntries: Array.isArray(captured.console) ? captured.console : [],
        networkEntries: Array.isArray(captured.network) ? captured.network : [],
        assertions, artifacts: captured.artifacts,
      });
    });
  }

  async close({ projectId, leaseContext = null, signal = null } = {}) { return this.#run(projectId, ['close'], { allowFailure: true, leaseContext, signal, action: 'close' }); }
  async status({ projectId, leaseContext = null, signal = null } = {}) {
    return this.#withLease(projectId, { leaseContext, signal, action: 'status' }, async () => {
      const context = await this.#context(projectId);
      const result = await this.driver.run({ sessionName: context.sessionName, args: ['list', '--json'], cwd: context.project.workspaceRoot, timeoutMs: 10_000, signal, maxOutputBytes: 200_000 });
      let sessions = []; try { sessions = JSON.parse(result.stdout || '[]'); } catch {}
      return Object.freeze({ available: true, sessionName: context.sessionName, version: context.detection.version ?? null, sessions: Object.freeze(Array.isArray(sessions) ? sessions.map((item) => ({ name: String(item.name ?? ''), url: String(item.url ?? ''), title: String(item.title ?? '') })) : []), untrusted: true });
    });
  }
}
