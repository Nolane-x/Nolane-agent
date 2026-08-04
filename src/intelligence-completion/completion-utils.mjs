import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { redactSecrets } from '../security/redaction.mjs';

export function freeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value) || seen.has(value)) return value;
  if (ArrayBuffer.isView(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) freeze(child, seen);
  return Object.freeze(value);
}

export function signed(base) {
  if (!base || typeof base !== 'object' || Array.isArray(base)) throw new TypeError('signed base must be an object');
  const clean = structuredClone(base);
  return freeze({ ...clean, receiptSha256: canonicalSha256(clean) });
}

export function text(value, label, max = 512) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${label} is required`);
  if (result.length > max) throw new TypeError(`${label} must be at most ${max} characters`);
  return result;
}

export function sha(value, label = 'sha256') {
  const result = text(value, label, 64).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(result)) throw new TypeError(`${label} must be a SHA-256 hex digest`);
  return result;
}

export function finite(value, label, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${label} must be finite`);
  if (number < min || number > max) throw new RangeError(`${label} must be between ${min} and ${max}`);
  return number;
}

export function boundedArray(value, label, max = 1000) {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  if (value.length > max) throw new RangeError(`${label} must contain at most ${max} items`);
  return freeze(structuredClone(value));
}

export function redacted(value, max = 32_000) {
  return String(redactSecrets(String(value ?? ''))).replace(/\u0000/g, '').slice(0, max);
}
