import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const FORBIDDEN_KEYS = new Set([
  'chainofthought', 'reasoningtrace', 'transcript', 'rawtranscript', 'rawprompt', 'prompt', 'systemprompt',
  'modeloutput', 'rawoutput', 'environment', 'env', 'password', 'secret', 'apikey', 'authorization',
  'cookie', 'cookies', 'credential', 'credentials', 'accesstoken', 'refreshtoken', 'privatekey',
]);

export function text(value, label, max = 4_000) {
  const output = String(value ?? '').trim();
  if (!output) throw new TypeError(`${label} is required`);
  if (output.length > max) throw new TypeError(`${label} exceeds ${max} characters`);
  return output;
}

export function optionalText(value, max = 4_000) {
  const output = String(value ?? '').trim();
  return output ? output.slice(0, max) : '';
}

export function finite(value, label, { min = 0, max = Number.POSITIVE_INFINITY } = {}) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < min || number > max) throw new TypeError(`${label} must be between ${min} and ${max}`);
  return number;
}

export function stringList(value, label, { min = 0, maxItems = 128, itemMax = 512 } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > maxItems) throw new TypeError(`${label} must contain ${min} to ${maxItems} items`);
  return value.map((item, index) => text(item, `${label}[${index}]`, itemMax));
}

export function assertNoPrivateFields(value, path = '$', seen = new WeakSet()) {
  if (!value || typeof value !== 'object') return;
  if (seen.has(value)) throw new TypeError(`cyclic input at ${path}`);
  seen.add(value);
  try {
    for (const [key, child] of Object.entries(value)) {
      const normalized = key.replaceAll('-', '').replaceAll('_', '').toLowerCase();
      if (FORBIDDEN_KEYS.has(normalized)) throw new TypeError(`forbidden private field at ${path}.${key}`);
      assertNoPrivateFields(child, `${path}.${key}`, seen);
    }
  } finally {
    seen.delete(value);
  }
}

export function boundedClone(value, { maxDepth = 6, maxArray = 64, maxKeys = 128, maxString = 2_000 } = {}, path = '$', depth = 0) {
  if (depth > maxDepth) throw new TypeError(`structured value exceeds depth at ${path}`);
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.slice(0, maxString);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`non-finite number at ${path}`);
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > maxArray) throw new TypeError(`array exceeds ${maxArray} items at ${path}`);
    return value.map((item, index) => boundedClone(item, { maxDepth, maxArray, maxKeys, maxString }, `${path}[${index}]`, depth + 1));
  }
  if (typeof value !== 'object') return String(value).slice(0, maxString);
  assertNoPrivateFields(value, path);
  const entries = Object.entries(value);
  if (entries.length > maxKeys) throw new TypeError(`object exceeds ${maxKeys} keys at ${path}`);
  return Object.fromEntries(entries.map(([key, child]) => [key.slice(0, 256), boundedClone(child, { maxDepth, maxArray, maxKeys, maxString }, `${path}.${key}`, depth + 1)]));
}

export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function signed(base) { return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) }); }
