import { randomUUID } from 'node:crypto';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$/;
const SAFE_SECRET_NAME = /^[A-Za-z0-9][A-Za-z0-9._~:/-]{0,511}$/;

function fail(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function required(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required`);
  return text;
}

function safeSegment(value, label) {
  const text = required(value, label);
  if (!SAFE_SEGMENT.test(text)) throw new TypeError(`${label} is invalid`);
  return text;
}

function safePath(value, label) {
  const text = required(value, label).replaceAll('\\', '/');
  if (!SAFE_SECRET_NAME.test(text) || text.startsWith('/') || text.endsWith('/') || text.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new TypeError(`${label} is invalid`);
  }
  return text;
}

function isLoopback(hostname) {
  const host = String(hostname).toLowerCase().replace(/^\[|\]$/g, '');
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function secureEndpoint(value, label) {
  const url = new URL(required(value, label));
  if (url.username || url.password || url.hash) throw new TypeError(`${label} must not contain credentials or a fragment`);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback(url.hostname))) {
    throw new TypeError(`${label} must use HTTPS or loopback HTTP`);
  }
  return url;
}

function positiveInteger(value, label) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new TypeError(`${label} must be a positive integer`);
  return number;
}

async function boundedJson(response, maxResponseBytes) {
  let text;
  if (typeof response.text === 'function') text = await response.text();
  else text = JSON.stringify(await response.json());
  if (Buffer.byteLength(text) > maxResponseBytes) throw fail('SECRET_PROVIDER_RESPONSE_TOO_LARGE', 'Secret provider response exceeded the configured byte limit', 502);
  try { return JSON.parse(text); }
  catch { throw fail('SECRET_PROVIDER_RESPONSE_INVALID', 'Secret provider returned invalid JSON', 502); }
}

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } catch (cause) {
    if (cause?.name === 'AbortError') throw fail('SECRET_PROVIDER_TIMEOUT', 'Secret provider request timed out', 504);
    throw fail('SECRET_PROVIDER_UNAVAILABLE', 'Secret provider request failed before a response was received', 502);
  } finally {
    clearTimeout(timer);
  }
}

export class SecretLease {
  #bytes;
  #consumed = false;

  constructor({ provider, version = null, bytes, metadata = {}, clock = () => Date.now() } = {}) {
    if (!Buffer.isBuffer(bytes) || bytes.length === 0) throw new TypeError('secret bytes are required');
    this.#bytes = Buffer.from(bytes);
    const base = {
      schema: 'forge.secret-lease.v1',
      leaseId: randomUUID(),
      provider: required(provider, 'provider'),
      version: version ?? null,
      issuedAt: new Date(clock()).toISOString(),
      byteLength: bytes.length,
      metadata: Object.freeze({ ...metadata }),
    };
    this.view = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  publicView() { return this.view; }

  async consume(callback) {
    if (typeof callback !== 'function') throw new TypeError('secret lease callback is required');
    if (this.#consumed || !this.#bytes) throw fail('SECRET_LEASE_CONSUMED', 'Secret lease has already been consumed', 409);
    this.#consumed = true;
    const bytes = this.#bytes;
    this.#bytes = null;
    try { return await callback(bytes); }
    finally { bytes.fill(0); }
  }
}

class BaseSecretProvider {
  constructor({ fetchImpl = globalThis.fetch, timeoutMs = 10_000, maxResponseBytes = 64 * 1024, maxSecretBytes = 16 * 1024 } = {}) {
    if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl is required');
    this.fetchImpl = fetchImpl;
    this.timeoutMs = Math.max(1, Number(timeoutMs) || 10_000);
    this.maxResponseBytes = Math.max(256, Number(maxResponseBytes) || 64 * 1024);
    this.maxSecretBytes = Math.max(1, Number(maxSecretBytes) || 16 * 1024);
  }

  lease(input) {
    const bytes = Buffer.isBuffer(input.bytes) ? input.bytes : Buffer.from(input.bytes ?? '');
    if (bytes.length === 0) throw fail('SECRET_PROVIDER_VALUE_MISSING', 'Secret provider response did not contain secret material', 502);
    if (bytes.length > this.maxSecretBytes) throw fail('SECRET_PROVIDER_VALUE_TOO_LARGE', 'Secret material exceeded the configured byte limit', 502);
    return new SecretLease({ ...input, bytes });
  }

  async request(url, options) {
    const response = await fetchWithTimeout(this.fetchImpl, url, options, this.timeoutMs);
    if (!response?.ok) throw fail('SECRET_PROVIDER_REQUEST_FAILED', 'Secret provider rejected the request', response?.status >= 400 && response.status < 600 ? response.status : 502);
    return boundedJson(response, this.maxResponseBytes);
  }
}

export class VaultKvV2Provider extends BaseSecretProvider {
  constructor({ baseUrl, getToken, namespace = null, ...options } = {}) {
    super(options);
    this.baseUrl = secureEndpoint(baseUrl, 'baseUrl');
    if (typeof getToken !== 'function') throw new TypeError('getToken is required');
    this.getToken = getToken;
    this.namespace = namespace == null || namespace === '' ? null : required(namespace, 'namespace');
  }

  async read({ mount, path, field, version = null } = {}) {
    const cleanMount = safeSegment(mount, 'mount');
    const cleanPath = safePath(path, 'path');
    const cleanField = safeSegment(field, 'field');
    const cleanVersion = positiveInteger(version, 'version');
    const token = required(await this.getToken(), 'Vault token');
    const url = new URL(`/v1/${encodeURIComponent(cleanMount)}/data/${cleanPath.split('/').map(encodeURIComponent).join('/')}`, this.baseUrl);
    if (cleanVersion != null) url.searchParams.set('version', String(cleanVersion));
    const headers = { accept: 'application/json', 'x-vault-token': token };
    if (this.namespace) headers['x-vault-namespace'] = this.namespace;
    const body = await this.request(url.toString(), { method: 'GET', headers });
    const value = body?.data?.data?.[cleanField];
    const resolvedVersion = body?.data?.metadata?.version ?? cleanVersion ?? null;
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value));
    return this.lease({ provider: 'vault-kv-v2', version: resolvedVersion, bytes, metadata: { mount: cleanMount } });
  }
}

export class RemoteSecretManagerProvider extends BaseSecretProvider {
  constructor({ endpoint, getAccessToken, ...options } = {}) {
    super(options);
    this.endpoint = secureEndpoint(endpoint, 'endpoint');
    if (typeof getAccessToken !== 'function') throw new TypeError('getAccessToken is required');
    this.getAccessToken = getAccessToken;
  }

  async read({ name } = {}) {
    const cleanName = safePath(name, 'name');
    const token = required(await this.getAccessToken(), 'access token');
    const body = await this.request(this.endpoint.toString(), {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: cleanName }),
    });
    let bytes;
    if (typeof body?.valueBase64 === 'string') {
      if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body.valueBase64)) throw fail('SECRET_PROVIDER_RESPONSE_INVALID', 'Secret provider returned invalid encoded material', 502);
      bytes = Buffer.from(body.valueBase64, 'base64');
    } else if (typeof body?.value === 'string') bytes = Buffer.from(body.value);
    else bytes = Buffer.alloc(0);
    return this.lease({ provider: 'remote-secret-manager', version: body?.version ?? null, bytes, metadata: {} });
  }
}
