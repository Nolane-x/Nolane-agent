import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { redactSecrets } from '../security/redaction.mjs';
import { validateHookDefinition, validateHookOutput } from './hook-schema.mjs';

function fail(code, message, details = {}) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  error.details = Object.freeze({ ...details });
  throw error;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

function serialize(value) {
  return JSON.stringify(stable(value));
}

function sha256(value) {
  return createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : serialize(value)).digest('hex');
}

function deepMerge(base, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch;
  const output = base && typeof base === 'object' && !Array.isArray(base) ? { ...base } : {};
  for (const [key, value] of Object.entries(patch)) output[key] = value && typeof value === 'object' && !Array.isArray(value) ? deepMerge(output[key], value) : value;
  return output;
}

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function matches(hook, eventName, payload, context) {
  if (!hook.events.includes(eventName)) return false;
  if (hook.matcher.toolNames.length && !hook.matcher.toolNames.includes(String(payload?.toolName ?? ''))) return false;
  if (hook.matcher.profileIds.length && !hook.matcher.profileIds.includes(String(context?.profileId ?? ''))) return false;
  return true;
}

async function executeHook(hook, input, { projectRoot, maxOutputBytes, maxErrorBytes, allowedExecutables }) {
  if (!allowedExecutables.has(path.resolve(hook.command))) fail('HOOK_EXECUTABLE_DENIED', `Executable is not allowlisted for hook ${hook.id}`);
  const serialized = serialize(input);
  if (Buffer.byteLength(serialized) > 256 * 1024) fail('HOOK_INPUT_LIMIT', `Input for hook ${hook.id} exceeds limit`);
  return await new Promise((resolve, reject) => {
    const child = spawn(hook.command, hook.args, {
      cwd: projectRoot,
      env: { PATH: process.env.PATH ?? '', FORGE_HOOK_ID: hook.id, FORGE_HOOK_EVENT: input.eventName },
      shell: false,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    const finishError = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill('SIGKILL');
      reject(error);
    };
    const timer = setTimeout(() => finishError(Object.assign(new Error(`HOOK_TIMEOUT: Hook ${hook.id} exceeded ${hook.timeoutMs}ms`), { code: 'HOOK_TIMEOUT' })), hook.timeoutMs);
    child.on('error', (error) => finishError(Object.assign(new Error(`HOOK_EXEC_FAILED: ${error.message}`), { code: 'HOOK_EXEC_FAILED' })));
    child.stdout.on('data', (chunk) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > maxOutputBytes) return finishError(Object.assign(new Error(`HOOK_OUTPUT_LIMIT: Hook ${hook.id} exceeded ${maxOutputBytes} bytes`), { code: 'HOOK_OUTPUT_LIMIT' }));
      stdout.push(chunk);
    });
    child.stderr.on('data', (chunk) => {
      if (stderrBytes >= maxErrorBytes) return;
      const remaining = maxErrorBytes - stderrBytes;
      stderr.push(chunk.subarray(0, remaining));
      stderrBytes += Math.min(chunk.length, remaining);
    });
    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const out = Buffer.concat(stdout).toString('utf8');
      const err = Buffer.concat(stderr).toString('utf8');
      if (code !== 0) return reject(Object.assign(new Error(`HOOK_EXIT_NONZERO: Hook ${hook.id} exited ${code ?? signal}: ${err.slice(0, 1000)}`), { code: 'HOOK_EXIT_NONZERO' }));
      let parsed;
      try { parsed = JSON.parse(out || '{}'); } catch (error) { return reject(Object.assign(new Error(`HOOK_OUTPUT_JSON: Hook ${hook.id}: ${error.message}`), { code: 'HOOK_OUTPUT_JSON' })); }
      resolve({ raw: out, stderr: err, output: validateHookOutput(parsed) });
    });
    child.stdin.end(serialized);
  });
}

export class HookEngine {
  constructor({ projectRoot, hooks = [], allowedExecutables = [], maxOutputBytes = 64 * 1024, maxErrorBytes = 16 * 1024 } = {}) {
    this.projectRoot = path.resolve(projectRoot ?? process.cwd());
    this.hooks = Object.freeze(hooks.map((hook) => validateHookDefinition(hook, { projectRoot: this.projectRoot })));
    this.allowedExecutables = new Set(allowedExecutables.map((value) => path.resolve(value)));
    this.maxOutputBytes = Math.max(256, Math.min(1024 * 1024, Number(maxOutputBytes) || 64 * 1024));
    this.maxErrorBytes = Math.max(256, Math.min(256 * 1024, Number(maxErrorBytes) || 16 * 1024));
  }

  async run(eventName, payload = {}, context = {}) {
    let currentPayload = JSON.parse(JSON.stringify(payload));
    let allowedTools = Array.isArray(context.availableTools) ? [...new Set(context.availableTools.map(String))] : null;
    const additionalContext = [];
    const audit = [];
    let deniedReason = '';
    let retry = false;
    for (const hook of this.hooks) {
      if (!matches(hook, eventName, currentPayload, context)) continue;
      const input = redactSecrets({ schema: 'forge.hook.input.v1', eventName, payload: currentPayload, context: { profileId: context.profileId ?? '', availableTools: allowedTools ?? [], taskId: context.taskId ?? '', projectId: context.projectId ?? '' } });
      const started = Date.now();
      try {
        const executed = await executeHook(hook, input, {
          projectRoot: this.projectRoot,
          maxOutputBytes: this.maxOutputBytes,
          maxErrorBytes: this.maxErrorBytes,
          allowedExecutables: this.allowedExecutables,
        });
        const output = executed.output;
        if (output.rewrite) currentPayload = deepMerge(currentPayload, output.rewrite);
        additionalContext.push(...output.additionalContext);
        if (output.allowedTools) {
          const proposed = new Set(output.allowedTools);
          allowedTools = (allowedTools ?? []).filter((tool) => proposed.has(tool));
        }
        retry ||= output.retry;
        if (output.decision === 'deny' && !deniedReason) deniedReason = output.reason;
        audit.push(Object.freeze({
          hookId: hook.id,
          status: output.decision,
          durationMs: Date.now() - started,
          inputSha256: sha256(input),
          outputSha256: sha256(executed.raw),
          stderrSha256: sha256(executed.stderr),
          metadata: output.audit,
        }));
      } catch (error) {
        audit.push(Object.freeze({ hookId: hook.id, status: 'error', durationMs: Date.now() - started, inputSha256: sha256(input), errorCode: error.code ?? 'HOOK_ERROR' }));
        if (hook.failureMode === 'closed') throw error;
      }
    }
    return deepFreeze({
      schema: 'forge.hooks.result.v1',
      eventName,
      decision: deniedReason ? 'deny' : 'allow',
      reason: deniedReason,
      payload: currentPayload,
      additionalContext,
      allowedTools,
      retry,
      audit,
    });
  }
}
