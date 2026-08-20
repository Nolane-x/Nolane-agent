import { repairToolArguments, sanitizeMessages } from '../agent/message-sanitization.mjs';
import { redactSecrets } from '../security/redaction.mjs';

export function required(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required`);
  return text;
}

export function secureBaseUrl(value, fallback) {
  const url = new URL(String(value ?? fallback));
  const loopback = new Set(['localhost', '127.0.0.1', '::1']);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback.has(url.hostname))) {
    throw new TypeError('provider base URL must use HTTPS or loopback HTTP');
  }
  return url.toString().replace(/\/+$/, '');
}

export function functionTool(tool) {
  const source = tool?.function ?? tool;
  return {
    name: required(source?.name, 'tool name'),
    description: String(source?.description ?? ''),
    parameters: source?.parameters && typeof source.parameters === 'object' ? structuredClone(source.parameters) : { type: 'object', properties: {} },
  };
}

export function normalizeMessages(messages) { return sanitizeMessages(messages ?? []); }
export function parseArguments(value) { return repairToolArguments(typeof value === 'string' ? value : JSON.stringify(value ?? {})); }

export function providerFailure(message, { code = 'PROVIDER_EXECUTION_FAILED', cause = undefined } = {}) {
  const error = Object.assign(new Error(message), { code });
  if (cause !== undefined) error.cause = cause;
  return error;
}

export async function resolveCredential({ apiKey, credentialRef, credentialResolver }) {
  let key;
  try { key = credentialRef ? await credentialResolver?.(credentialRef) : apiKey; }
  catch (error) { throw providerFailure('Provider credential is unavailable', { code: 'PROVIDER_SETUP_REQUIRED', cause: error }); }
  if (!key) throw providerFailure('Provider credential is unavailable', { code: 'PROVIDER_SETUP_REQUIRED' });
  return String(key);
}

export async function postJson({ url, headers, body, timeoutMs, signal, fetchImpl, secretValues = [] }) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  timer.unref?.();
  const abort = () => controller.abort();
  if (signal?.aborted) abort(); else signal?.addEventListener?.('abort', abort, { once: true });
  let response;
  try {
    response = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', ...headers }, body: JSON.stringify(body), signal: controller.signal });
  } catch (error) {
    if (timedOut) throw providerFailure('Provider request timed out', { cause: error });
    if (signal?.aborted) throw providerFailure('Provider request cancelled', { cause: error });
    throw providerFailure('Provider request failed', { cause: new Error(redactSecrets(String(error?.message ?? error), { secretValues })) });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.('abort', abort);
  }
  const raw = await response.text();
  let payload;
  try { payload = raw ? JSON.parse(raw) : {}; }
  catch { throw providerFailure('Provider returned an invalid response'); }
  if (!response.ok) {
    const message = payload?.error?.message ?? payload?.message ?? raw.slice(0, 500);
    throw providerFailure('Provider request was rejected', { cause: new Error(redactSecrets(`Model HTTP ${response.status}: ${message}`, { secretValues })) });
  }
  return payload;
}
