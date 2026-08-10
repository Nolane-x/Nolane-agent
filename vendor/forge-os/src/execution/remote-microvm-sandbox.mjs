import { createPublicKey, verify } from 'node:crypto';
import path from 'node:path';
import { canonicalSha256, canonicalStringify } from '../core/canonical-json.mjs';

const MAX_ARGUMENTS = 64;
const MAX_ARGUMENT_LENGTH = 4_096;
const MAX_INPUT_BYTES = 128 * 1024;
const STATUS = new Set(['pass', 'fail', 'timeout']);

function configuredEndpoint(value) {
  if (!value) return { value: null, error: null };
  try {
    const endpoint = new URL(String(value));
    if (endpoint.protocol !== 'https:') throw new TypeError('sandbox endpoint must use HTTPS');
    if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new TypeError('sandbox endpoint must not include credentials, query, or fragment');
    return { value: endpoint.toString().replace(/\/$/, ''), error: null };
  } catch (error) {
    return { value: null, error: error.message };
  }
}

function configuredPublicKey(value) {
  if (!value) return { value: null, error: null };
  try {
    const key = createPublicKey(value);
    if (key.asymmetricKeyType !== 'ed25519') throw new TypeError('sandbox public key must be Ed25519');
    return { value: key, error: null };
  } catch {
    return { value: null, error: 'sandbox public key is invalid' };
  }
}

function profileError(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return 'sandbox capability document must be an object';
  if (profile.schemaVersion !== 1) return 'sandbox capability schemaVersion must be 1';
  if (typeof profile.providerId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/.test(profile.providerId)) return 'sandbox providerId is invalid';
  if (profile.executionKind !== 'microvm') return 'sandbox provider must declare executionKind microvm';
  if (profile.network !== 'deny-by-default') return 'sandbox provider must declare deny-by-default network isolation';
  if (profile.secrets !== 'none-by-default') return 'sandbox provider must declare none-by-default secrets';
  if (!Number.isInteger(profile.maxTimeoutMs) || profile.maxTimeoutMs < 1 || profile.maxTimeoutMs > 3_600_000) return 'sandbox provider maxTimeoutMs is invalid';
  return null;
}

function boundedText(value, name, maximum) {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum || value.includes('\0')) throw new TypeError(`${name} is invalid`);
  return value;
}

function safeCwd(value) {
  const cwd = String(value ?? '.');
  const normalized = path.posix.normalize(cwd.replaceAll('\\', '/'));
  if (!normalized || normalized === '..' || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) throw new TypeError('sandbox cwd must stay within the provider workspace');
  return normalized;
}

function normalizeRequest(input, profile) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('sandbox request must be an object');
  const command = boundedText(input.command, 'sandbox command', 512);
  if (!Array.isArray(input.args) || input.args.length > MAX_ARGUMENTS) throw new TypeError('sandbox args are invalid');
  const args = input.args.map((value) => boundedText(value, 'sandbox argument', MAX_ARGUMENT_LENGTH));
  if (!Number.isInteger(input.timeoutMs) || input.timeoutMs < 1 || input.timeoutMs > profile.maxTimeoutMs) throw new TypeError('sandbox timeoutMs exceeds provider capability');
  if (input.env !== undefined && (!input.env || Object.keys(input.env).length > 0)) throw new TypeError('sandbox request cannot include environment secrets');
  const payload = structuredClone(input.input ?? {});
  if (Buffer.byteLength(canonicalStringify(payload), 'utf8') > MAX_INPUT_BYTES) throw new RangeError('sandbox input exceeds the byte limit');
  return Object.freeze({ schemaVersion: 1, command, args: Object.freeze(args), cwd: safeCwd(input.cwd), timeoutMs: input.timeoutMs, input: payload });
}

function responseError(response, operation) {
  if (!response?.ok) throw new Error(`sandbox ${operation} failed: ${response?.status ?? 'unavailable'}`);
  return response;
}

function receiptError(receipt, requestSha256, profile, maxOutputBytes) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return 'sandbox receipt must be an object';
  if (receipt.schemaVersion !== 1 || receipt.type !== 'remote-microvm-execution') return 'sandbox receipt has an invalid schema';
  if (receipt.providerId !== profile.providerId) return 'sandbox receipt provider does not match capability document';
  if (receipt.requestSha256 !== requestSha256) return 'sandbox receipt request digest does not match';
  if (!STATUS.has(receipt.status)) return 'sandbox receipt status is invalid';
  if (!Number.isFinite(Date.parse(receipt.startedAt)) || !Number.isFinite(Date.parse(receipt.completedAt))) return 'sandbox receipt timestamps are invalid';
  if (!receipt.isolation || typeof receipt.isolation !== 'object' || Array.isArray(receipt.isolation)
    || receipt.isolation.executionKind !== 'microvm'
    || receipt.isolation.network !== 'deny-by-default'
    || receipt.isolation.secrets !== 'none-by-default') return 'sandbox receipt isolation profile is invalid';
  if (typeof receipt.stdout !== 'string' || typeof receipt.stderr !== 'string') return 'sandbox receipt output is invalid';
  if (Buffer.byteLength(receipt.stdout, 'utf8') + Buffer.byteLength(receipt.stderr, 'utf8') > maxOutputBytes) return 'sandbox receipt output exceeds the byte limit';
  if (receipt.stdoutSha256 !== canonicalSha256(receipt.stdout) || receipt.stderrSha256 !== canonicalSha256(receipt.stderr)) return 'sandbox receipt output digest does not match';
  return null;
}

export class RemoteMicroVmSandbox {
  #endpoint; #publicKey; #fetch; #maxOutputBytes; #configurationError;

  constructor({ endpoint = null, publicKey = null, fetchImpl = globalThis.fetch, maxOutputBytes = 1_000_000 } = {}) {
    if (typeof fetchImpl !== 'function') throw new TypeError('sandbox fetchImpl is required');
    if (!Number.isInteger(maxOutputBytes) || maxOutputBytes < 1 || maxOutputBytes > 10_000_000) throw new TypeError('sandbox maxOutputBytes is invalid');
    const configured = configuredEndpoint(endpoint);
    const key = configuredPublicKey(publicKey);
    this.#endpoint = configured.value;
    this.#publicKey = key.value;
    this.#fetch = fetchImpl;
    this.#maxOutputBytes = maxOutputBytes;
    this.#configurationError = configured.error ?? key.error;
  }

  async probe() {
    if (this.#configurationError) return Object.freeze({ state: 'misconfigured', reason: this.#configurationError });
    if (!this.#endpoint) return Object.freeze({ state: 'unavailable', reason: 'sandbox endpoint is not configured' });
    if (!this.#publicKey) return Object.freeze({ state: 'unavailable', reason: 'sandbox public key is not configured' });
    try {
      const response = responseError(await this.#fetch(`${this.#endpoint}/.well-known/forgeos-sandbox.json`, { headers: { accept: 'application/json' } }), 'capability probe');
      const profile = await response.json();
      const reason = profileError(profile);
      return reason ? Object.freeze({ state: 'misconfigured', reason }) : Object.freeze({ state: 'ready', profile: Object.freeze(structuredClone(profile)) });
    } catch {
      return Object.freeze({ state: 'unavailable', reason: 'sandbox provider is unreachable' });
    }
  }

  async run(input) {
    const state = await this.probe();
    if (state.state !== 'ready') throw new Error(`remote microVM sandbox is ${state.state}: ${state.reason}`);
    const request = normalizeRequest(input, state.profile);
    const requestSha256 = canonicalSha256(request);
    const response = responseError(await this.#fetch(`${this.#endpoint}/v1/runs`, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: canonicalStringify({ request, requestSha256 }),
    }), 'execution request');
    const payload = await response.json();
    const signature = String(payload?.signature ?? '');
    if (!/^[A-Za-z0-9_-]+$/.test(signature)) throw new Error('sandbox receipt signature is invalid');
    const receipt = payload?.receipt;
    const reason = receiptError(receipt, requestSha256, state.profile, this.#maxOutputBytes);
    if (reason) throw new Error(reason);
    if (!verify(null, Buffer.from(canonicalStringify(receipt)), this.#publicKey, Buffer.from(signature, 'base64url'))) throw new Error('sandbox receipt signature is invalid');
    return Object.freeze(structuredClone(receipt));
  }
}

export function createRemoteMicroVmSandboxFromEnv(env = process.env, options = {}) {
  return new RemoteMicroVmSandbox({
    endpoint: env.FORGEOS_SANDBOX_ENDPOINT,
    publicKey: env.FORGEOS_SANDBOX_PUBLIC_KEY,
    ...options,
  });
}
