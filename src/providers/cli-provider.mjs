import { spawn } from 'node:child_process';
import { buildForgeActionPrompt, parseForgeActionEnvelope } from './forge-action-protocol.mjs';

function text(value, label) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${label} is required`);
  return result;
}

function argv(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) throw new TypeError(`${label} must be an array of strings`);
  return [...value];
}

function parseVersion(output) {
  return String(output ?? '').match(/\b(\d+\.\d+(?:\.\d+)?(?:[-+][\w.-]+)?)\b/)?.[1] ?? null;
}

function estimateTokens(value) {
  const bytes = Buffer.byteLength(String(value ?? ''), 'utf8');
  return Math.max(1, Math.min(10_000_000, Math.ceil(bytes / 4)));
}


export class CliProvider {
  constructor({ id, label, executable, versionArgs = ['--version'], baseArgs = [], promptMode = 'stdin', promptFlag = null, timeoutMs = 10 * 60_000, env = {}, secretEnvKeys = [], cwd = null, credentialOwner = 'official-cli', harnessFamily = 'generic-local', profile = {} } = {}) {
    this.id = text(id, 'provider id');
    this.label = text(label ?? id, 'provider label');
    this.kind = 'cli';
    this.executable = text(executable, 'provider executable');
    this.versionArgs = argv(versionArgs, 'versionArgs');
    this.baseArgs = argv(baseArgs, 'baseArgs');
    if (!['stdin', 'arg', 'none'].includes(promptMode)) throw new TypeError('promptMode must be stdin, arg, or none');
    this.promptMode = promptMode;
    this.promptFlag = promptFlag == null ? null : String(promptFlag);
    this.timeoutMs = Number(timeoutMs);
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 10 || this.timeoutMs > 24 * 60 * 60_000) throw new TypeError('timeoutMs is invalid');
    this.env = Object.fromEntries(Object.entries(env).map(([key, value]) => [String(key), String(value)]));
    this.secretEnvKeys = new Set(secretEnvKeys.map(String));
    this.cwd = cwd;
    this.credentialOwner = credentialOwner;
    this.harnessFamily = text(harnessFamily, 'harness family');
    this.profile = Object.freeze({ capabilities: Object.freeze([...(profile.capabilities ?? ['coding', 'structured-output'])].map(String)), qualityTier: Number(profile.qualityTier ?? 2), costTier: Number(profile.costTier ?? 0), latencyTier: Number(profile.latencyTier ?? 2), local: profile.local === true });
  }

  publicView() {
    return Object.freeze({
      id: this.id,
      label: this.label,
      kind: this.kind,
      executable: this.executable,
      credentialOwner: this.credentialOwner,
      promptMode: this.promptMode,
      harnessFamily: this.harnessFamily,
      ...this.profile,
    });
  }

  async detect() {
    try {
      const result = await this.#spawn(this.versionArgs, { timeoutMs: Math.min(this.timeoutMs, 5_000), input: '' });
      const output = `${result.stdout}\n${result.stderr}`.trim();
      return Object.freeze({ ...this.publicView(), available: result.exitCode === 0, version: parseVersion(output), versionOutput: output.slice(0, 500) });
    } catch (error) {
      return Object.freeze({ ...this.publicView(), available: false, version: null, error: error.code === 'ENOENT' ? 'not-found' : error.message });
    }
  }

  async complete({ messages = [], tools = [], signal = null, timeoutMs = this.timeoutMs, cwd = this.cwd } = {}) {
    const prompt = buildForgeActionPrompt(messages, tools);
    const result = await this.invoke({ prompt, signal, timeoutMs, cwd });
    if (result.timedOut) throw new Error(`${this.label} timed out`);
    if (result.aborted) throw new Error(`${this.label} cancelled`);
    if (result.exitCode !== 0) throw new Error(`${this.label} exited with ${result.exitCode}: ${result.stderr.slice(0, 1000)}`);
    const lines = result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    let outputText = '';
    for (const line of lines) {
      try {
        const item = JSON.parse(line);
        const candidate = item.result ?? item.response ?? item.text ?? item.output ?? item.message?.content ?? item.item?.text ?? item.item?.content;
        if (typeof candidate === 'string') outputText = candidate;
        else if (item.type === 'item.completed' && typeof item.item?.text === 'string') outputText = item.item.text;
        else if (!outputText) outputText = JSON.stringify(item);
      } catch { if (!outputText) outputText = line; else outputText += `\n${line}`; }
    }
    const envelope = parseForgeActionEnvelope(outputText || result.stdout, tools);
    const finalText = envelope ? envelope.text : (outputText || result.stdout);
    const promptTokens = estimateTokens(prompt);
    const completionTokens = estimateTokens(finalText);
    return Object.freeze({ providerId: this.id, model: this.id, text: finalText, toolCalls: envelope?.toolCalls ?? Object.freeze([]), finishReason: 'stop', usage: Object.freeze({ promptTokens, completionTokens, totalTokens: promptTokens + completionTokens, estimated: true }), raw: result });
  }

  async invoke({ prompt = '', args = [], cwd = this.cwd, env = {}, timeoutMs = this.timeoutMs, signal = null } = {}) {
    const extraArgs = argv(args, 'args');
    const finalArgs = [...this.baseArgs];
    let input = '';
    if (this.promptMode === 'stdin') input = String(prompt);
    else if (this.promptMode === 'arg') {
      if (this.promptFlag) finalArgs.push(this.promptFlag);
      finalArgs.push(String(prompt));
    }
    finalArgs.push(...extraArgs);
    return this.#spawn(finalArgs, { cwd, env, timeoutMs, signal, input });
  }

  async #spawn(args, { cwd = this.cwd, env = {}, timeoutMs = this.timeoutMs, signal = null, input = '' } = {}) {
    const safeEnv = { ...process.env, ...this.env, ...Object.fromEntries(Object.entries(env).map(([key, value]) => [String(key), String(value)])) };
    const child = spawn(this.executable, args, { cwd: cwd ?? undefined, env: safeEnv, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    let stdout = ''; let stderr = ''; let timedOut = false; let aborted = false;
    child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
    const kill = () => {
      try { if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); }
      catch { try { child.kill('SIGKILL'); } catch {} }
    };
    const timer = setTimeout(() => { timedOut = true; kill(); }, Number(timeoutMs));
    timer.unref?.();
    const onAbort = () => { aborted = true; kill(); };
    if (signal?.aborted) onAbort(); else signal?.addEventListener?.('abort', onAbort, { once: true });
    if (input) child.stdin.end(input); else child.stdin.end();
    const result = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (exitCode, signalName) => resolve({ exitCode, signalName }));
    }).finally(() => { clearTimeout(timer); signal?.removeEventListener?.('abort', onAbort); });
    return Object.freeze({ providerId: this.id, executable: this.executable, args: [...args], exitCode: result.exitCode, signal: result.signalName ?? null, stdout, stderr, timedOut, aborted });
  }
}
