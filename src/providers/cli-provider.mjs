import { execFile, spawn } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
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

const ANSI_ESCAPE = /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;
const MODEL_NOISE = new Set(['model', 'models', 'available', 'available-models', 'name', 'id', 'provider', 'providers', 'list']);

function normalizeModelId(value) {
  const candidate = String(value ?? '')
    .replace(ANSI_ESCAPE, '')
    .trim()
    .replace(/^[`"'|•*+\-\s]+|[`"',;:|\s]+$/g, '');
  if (!candidate || candidate.length > 256 || MODEL_NOISE.has(candidate.toLowerCase())) return null;
  if (/\s/.test(candidate) || /[\u0000-\u001f\u007f]/.test(candidate)) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/@+~-]*$/.test(candidate)) return null;
  return candidate;
}

function normalizeEffort(value) {
  const candidate = String(value ?? '').trim().toLowerCase();
  if (!candidate) return null;
  if (candidate.length > 64 || !/^[a-z0-9][a-z0-9._-]*$/.test(candidate)) throw new TypeError('effort must be a bounded provider variant');
  return candidate;
}

function effortList(value, label) {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array of strings`);
  return Object.freeze([...new Set(value.map(normalizeEffort).filter(Boolean))]);
}

function effortByModel(value) {
  if (value == null) return Object.freeze({});
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('effortByModel must be an object');
  const entries = Object.entries(value).map(([modelId, levels]) => {
    const normalizedModel = normalizeModelId(modelId);
    if (!normalizedModel) throw new TypeError('effortByModel has an invalid model id');
    return [normalizedModel, effortList(levels, `effortByModel.${modelId}`)];
  });
  return Object.freeze(Object.fromEntries(entries));
}

function modelCandidates(output) {
  const values = [];
  for (const line of String(output ?? '').split(/\r?\n/)) {
    const clean = line.replace(ANSI_ESCAPE, '').trim();
    if (!clean) continue;
    const whole = normalizeModelId(clean);
    if (whole) values.push(whole);
    // Some CLIs render a table. Only accept slash-qualified or recognisable
    // model-shaped tokens from those rows so headers and account metadata do
    // not become fake models.
    for (const token of clean.match(/[A-Za-z0-9][A-Za-z0-9._:/@+~-]{1,255}/g) ?? []) {
      const normalized = normalizeModelId(token);
      if (normalized && (normalized.includes('/') || /^(?:gpt|o[1-9]|claude|gemini|codex|deepseek|qwen|llama|mistral|sonnet|opus|haiku)[-_.:/@+~]/i.test(normalized))) values.push(normalized);
    }
  }
  return [...new Set(values)];
}

function discoveryModel(providerId, modelId, source, observedAt, reasoningEfforts = []) {
  const metadata = reasoningEfforts.length ? Object.freeze({ supportedReasoningEfforts: reasoningEfforts }) : Object.freeze({});
  return Object.freeze({ id: modelId, modelId, displayName: modelId, providerId, discoveredAt: observedAt, source: Object.freeze({ ...source, observedAt }), metadata });
}

function diagnostic(output) {
  return String(output ?? '').replace(ANSI_ESCAPE, '').replace(/(?:sk|key|token)-[A-Za-z0-9._-]+/gi, '[REDACTED]').replace(/\b(api[_-]?key|authorization|password|secret|(?:refresh[_-]?)?token|rt_prefix)\b\s*[:=]\s*\S+/gi, '$1=[REDACTED]').trim().slice(0, 500);
}

function childEnvironment(env = {}, secretEnvKeys = []) {
  const names = process.platform === 'win32'
    ? ['PATH', 'Path', 'SYSTEMROOT', 'SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA']
    : ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME'];
  const base = {};
  for (const name of [...names, ...secretEnvKeys]) {
    const value = process.env[name];
    if (typeof value !== 'string' || !value) continue;
    if (name === 'Path' && base.PATH) continue;
    base[name === 'Path' ? 'PATH' : name] = value;
  }
  return { ...base, ...env };
}

function detectError(result) {
  const output = `${result.stderr}\n${result.stdout}`.toLowerCase();
  if (/config|configuration|settings|invalid|schema|expected/.test(output)) return 'configuration-error';
  return result.exitCode === 0 ? null : `exit-${result.exitCode ?? 'unknown'}`;
}

function estimateTokens(value) {
  const bytes = Buffer.byteLength(String(value ?? ''), 'utf8');
  return Math.max(1, Math.min(10_000_000, Math.ceil(bytes / 4)));
}

function cliExecutionError(error) {
  if (error?.code === 'PROVIDER_EXECUTION_FAILED' || error?.code === 'PROVIDER_SETUP_REQUIRED' || error?.code === 'PROVIDER_WORKSPACE_TRUST_REQUIRED') return error;
  const wrapped = Object.assign(new Error('CLI provider execution failed'), { code: 'PROVIDER_EXECUTION_FAILED' });
  wrapped.cause = error;
  return wrapped;
}

function isNonAssistantCompletedEvent(item) {
  if (item?.type !== 'item.completed') return false;
  const type = String(item?.item?.type ?? '').toLowerCase();
  return !['agent_message', 'assistant', 'assistant_message', 'message'].includes(type);
}

const WINDOWS_EXECUTABLE_EXTENSIONS = new Set(['.exe', '.com']);

function execFileText(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { ...options, shell: false, windowsHide: true, encoding: 'utf8' }, (error, stdout = '', stderr = '') => {
      if (error) { error.stdout = stdout; error.stderr = stderr; reject(error); return; }
      resolve({ stdout, stderr });
    });
  });
}

async function existingFile(candidate) {
  try { await access(candidate); return candidate; } catch { return null; }
}

async function resolveNpmWindowsWrapper(candidate) {
  if (!/\.cmd$/i.test(candidate)) return null;
  const source = await readFile(candidate, 'utf8').catch(() => null);
  if (!source) return null;
  const root = path.dirname(candidate);
  const directTarget = source.match(/%dp0%[\\/]([^"\r\n]+\.exe)/i)?.[1];
  if (directTarget) {
    const executable = await existingFile(path.resolve(root, directTarget));
    if (executable) return Object.freeze({ executable, prefix: Object.freeze([]) });
  }
  const scriptTarget = source.match(/%dp0%[\\/]([^"\r\n]+\.js)/i)?.[1];
  if (scriptTarget) {
    const script = await existingFile(path.resolve(root, scriptTarget));
    if (script) {
      const bundledNode = await existingFile(path.join(root, 'node.exe'));
      return Object.freeze({ executable: bundledNode ?? process.execPath, prefix: Object.freeze([script]) });
    }
  }
  return null;
}


export class CliProvider {
  #resolvedExecutable = null;

  constructor({ id, label, executable, versionArgs = ['--version'], baseArgs = [], promptMode = 'stdin', promptFlag = null, modelFlag = '--model', modelSelection = null, effortFlag = null, effortLevels = [], effortByModel: configuredEffortByModel = null, executionSafety = 'verified', modelDiscoveryArgs = null, modelCatalog = [], timeoutMs = 10 * 60_000, env = {}, secretEnvKeys = [], cwd = null, credentialOwner = 'official-cli', harnessFamily = 'generic-local', profile = {} } = {}) {
    this.id = text(id, 'provider id');
    this.label = text(label ?? id, 'provider label');
    this.kind = 'cli';
    this.executable = text(executable, 'provider executable');
    this.versionArgs = argv(versionArgs, 'versionArgs');
    this.baseArgs = argv(baseArgs, 'baseArgs');
    if (!['stdin', 'arg', 'none'].includes(promptMode)) throw new TypeError('promptMode must be stdin, arg, or none');
    this.promptMode = promptMode;
    this.promptFlag = promptFlag == null ? null : String(promptFlag);
    this.modelFlag = modelFlag == null ? null : String(modelFlag).trim() || null;
    this.modelSelection = modelSelection ?? (this.modelFlag ? 'forwarded' : 'cli-config');
    if (!['forwarded', 'cli-config'].includes(this.modelSelection)) throw new TypeError('modelSelection is invalid');
    this.effortFlag = effortFlag == null ? null : String(effortFlag).trim() || null;
    this.effortLevels = effortList(effortLevels, 'effortLevels');
    this.effortByModel = effortByModel(configuredEffortByModel);
    if (!this.effortFlag && (this.effortLevels.length || Object.keys(this.effortByModel).length)) throw new TypeError('effortFlag is required when a CLI advertises reasoning effort');
    if (!['verified', 'external-plan-config-required'].includes(executionSafety)) throw new TypeError('executionSafety is invalid');
    this.executionSafety = executionSafety;
    this.modelDiscoveryArgs = modelDiscoveryArgs == null ? null : argv(modelDiscoveryArgs, 'modelDiscoveryArgs');
    if (!Array.isArray(modelCatalog) || modelCatalog.some((item) => typeof item !== 'string')) throw new TypeError('modelCatalog must be an array of strings');
    this.modelCatalog = Object.freeze([...new Set(modelCatalog.map(normalizeModelId).filter(Boolean))]);
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
      executionSafety: this.executionSafety,
      modelDiscovery: Object.freeze({
        supported: Boolean(this.modelDiscoveryArgs?.length || this.modelCatalog.length),
        mode: this.modelDiscoveryArgs?.length ? 'command' : (this.modelCatalog.length ? 'compatibility-catalog' : 'unsupported'),
        live: Boolean(this.modelDiscoveryArgs?.length),
      }),
      modelSelection: Object.freeze({ mode: this.modelSelection, forwarded: this.modelSelection === 'forwarded' }),
      effort: Object.freeze({ supported: Boolean(this.effortFlag), mode: this.effortFlag ? 'forwarded' : 'unsupported', levels: this.effortLevels }),
      ...this.profile,
    });
  }

  #effortLevelsForModel(modelId) {
    return this.effortByModel[normalizeModelId(modelId) ?? ''] ?? this.effortLevels;
  }

  async discoverModels({ timeoutMs = Math.min(this.timeoutMs, 15_000) } = {}) {
    const observedAt = new Date().toISOString();
    if (this.modelCatalog.length) {
      const source = Object.freeze({ type: 'cli-compatibility-catalog', live: false });
      const models = this.modelCatalog.map((modelId) => discoveryModel(this.id, modelId, source, observedAt, this.#effortLevelsForModel(modelId)));
      return Object.freeze({ schema: 'nolane.cli-model-discovery.v1', providerId: this.id, status: 'compatibility', source, models: Object.freeze(models), errors: Object.freeze([]), observedAt });
    }
    if (!this.modelDiscoveryArgs?.length) {
      const reason = this.modelSelection === 'cli-config' ? 'CLI selects its model from its own configuration and does not expose a model listing command.' : 'CLI does not expose a model listing command; add a model manually.';
      return Object.freeze({ schema: 'nolane.cli-model-discovery.v1', providerId: this.id, status: 'unsupported', source: Object.freeze({ type: 'cli-capability', live: false }), models: Object.freeze([]), errors: Object.freeze([]), reason, observedAt });
    }
    try {
      const result = await this.#spawn(this.modelDiscoveryArgs, { timeoutMs, input: '' });
      if (result.timedOut) throw new Error('model discovery timed out');
      if (result.aborted) throw new Error('model discovery cancelled');
      if (result.exitCode !== 0) throw new Error(`model discovery exited with ${result.exitCode}`);
      const source = Object.freeze({ type: 'cli-command', live: true });
      const models = modelCandidates(`${result.stdout}\n${result.stderr}`).map((modelId) => discoveryModel(this.id, modelId, source, observedAt, this.#effortLevelsForModel(modelId)));
      return Object.freeze({ schema: 'nolane.cli-model-discovery.v1', providerId: this.id, status: 'discovered', source, models: Object.freeze(models), errors: Object.freeze([]), observedAt });
    } catch (error) {
      return Object.freeze({ schema: 'nolane.cli-model-discovery.v1', providerId: this.id, status: 'error', source: Object.freeze({ type: 'cli-command', live: true }), models: Object.freeze([]), errors: Object.freeze([String(error?.message ?? error).slice(0, 300)]), observedAt });
    }
  }

  async detect() {
    try {
      // Version probes must tolerate the cold-start/configuration path of
      // heavyweight CLIs (notably Gemini on Windows) without extending the
      // much longer execution timeout used for actual agent work.
      const result = await this.#spawn(this.versionArgs, { timeoutMs: Math.min(this.timeoutMs, 15_000), input: '' });
      const output = `${result.stdout}\n${result.stderr}`.trim();
      const error = detectError(result);
      if (error) return Object.freeze({ ...this.publicView(), available: false, authenticated: false, healthy: false, version: parseVersion(output), error });
      return Object.freeze({ ...this.publicView(), available: true, version: parseVersion(output), versionOutput: diagnostic(output), error: null });
    } catch (error) {
      return Object.freeze({ ...this.publicView(), available: false, version: null, error: error.code === 'ENOENT' ? 'not-found' : diagnostic(error.message) || 'spawn-error' });
    }
  }

  async complete({ messages = [], tools = [], model = null, effort = null, signal = null, timeoutMs = this.timeoutMs, cwd = this.cwd } = {}) {
    try {
      const prompt = buildForgeActionPrompt(messages, tools);
      const result = await this.invoke({ prompt, model, effort, signal, timeoutMs, cwd });
      if (result.timedOut) throw new Error(`${this.label} timed out`);
      if (result.aborted) throw new Error(`${this.label} cancelled`);
      if (result.exitCode !== 0) throw new Error(`${this.label} exited with ${result.exitCode}: ${result.stderr.slice(0, 1000)}`);
      const lines = result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      let outputText = '';
      for (const line of lines) {
        try {
          const item = JSON.parse(line);
          if (isNonAssistantCompletedEvent(item)) continue;
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
      return Object.freeze({ providerId: this.id, model: model && !['auto', 'cli-selected'].includes(String(model)) ? String(model) : this.id, text: finalText, toolCalls: envelope?.toolCalls ?? Object.freeze([]), finishReason: 'stop', usage: Object.freeze({ promptTokens, completionTokens, totalTokens: promptTokens + completionTokens, estimated: true }), raw: result });
    } catch (error) {
      throw cliExecutionError(error);
    }
  }

  async invoke({ prompt = '', model = null, effort = null, args = [], cwd = this.cwd, env = {}, timeoutMs = this.timeoutMs, signal = null } = {}) {
    const extraArgs = argv(args, 'args');
    const finalArgs = [...this.baseArgs];
    const selectedModel = String(model ?? '').trim();
    if (this.modelFlag && selectedModel && !['auto', 'cli-selected'].includes(selectedModel)) {
      const sentinel = finalArgs.indexOf('-');
      const insertion = sentinel >= 0 ? sentinel : finalArgs.length;
      finalArgs.splice(insertion, 0, this.modelFlag, selectedModel);
    }
    const selectedEffort = normalizeEffort(effort);
    if (this.effortFlag && selectedEffort) {
      const sentinel = finalArgs.indexOf('-');
      const insertion = sentinel >= 0 ? sentinel : finalArgs.length;
      finalArgs.splice(insertion, 0, this.effortFlag, selectedEffort);
    }
    let input = '';
    if (this.promptMode === 'stdin') input = String(prompt);
    else if (this.promptMode === 'arg') {
      if (this.promptFlag) finalArgs.push(this.promptFlag);
      finalArgs.push(String(prompt));
    }
    finalArgs.push(...extraArgs);
    return this.#spawn(finalArgs, { cwd, env, timeoutMs, signal, input });
  }

  async #resolveExecutable() {
    if (this.#resolvedExecutable) return this.#resolvedExecutable;
    if (process.platform !== 'win32') {
      this.#resolvedExecutable = Object.freeze({ executable: this.executable, prefix: Object.freeze([]) });
      return this.#resolvedExecutable;
    }
    const explicit = path.isAbsolute(this.executable) || this.executable.includes(path.sep) || this.executable.includes('/') ? this.executable : null;
    const candidates = explicit ? [explicit] : [];
    if (!explicit) {
      try {
        const located = await execFileText('where.exe', [this.executable], { timeout: 2_000, maxBuffer: 32 * 1024 });
        candidates.push(...String(located.stdout).split(/\r?\n/).map((item) => item.trim()).filter(Boolean));
      } catch { /* the normal spawn below returns the bounded not-found error */ }
    }
    const direct = candidates.find((candidate) => WINDOWS_EXECUTABLE_EXTENSIONS.has(path.extname(candidate).toLowerCase()));
    if (direct && await existingFile(direct)) {
      this.#resolvedExecutable = Object.freeze({ executable: direct, prefix: Object.freeze([]) });
      return this.#resolvedExecutable;
    }
    for (const candidate of candidates) {
      const wrapper = await resolveNpmWindowsWrapper(candidate);
      if (wrapper) { this.#resolvedExecutable = wrapper; return wrapper; }
    }
    this.#resolvedExecutable = Object.freeze({ executable: this.executable, prefix: Object.freeze([]) });
    return this.#resolvedExecutable;
  }

  async #spawn(args, { cwd = this.cwd, env = {}, timeoutMs = this.timeoutMs, signal = null, input = '' } = {}) {
    const safeEnv = childEnvironment({ ...this.env, ...Object.fromEntries(Object.entries(env).map(([key, value]) => [String(key), String(value)])) }, this.secretEnvKeys);
    const resolved = await this.#resolveExecutable();
    const child = spawn(resolved.executable, [...resolved.prefix, ...args], { cwd: cwd ?? undefined, env: safeEnv, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
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
    return Object.freeze({ providerId: this.id, executable: resolved.executable, args: [...resolved.prefix, ...args], exitCode: result.exitCode, signal: result.signalName ?? null, stdout, stderr, timedOut, aborted });
  }
}
