import { randomUUID } from 'node:crypto';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

export const SHA256 = /^[a-f0-9]{64}$/i;

export function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

export function signed(base) {
  const unsigned = { ...(base ?? {}) };
  delete unsigned.receiptSha256;
  return deepFreeze({ ...unsigned, receiptSha256: canonicalSha256(unsigned) });
}

export function required(value, label, max = 20_000) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new TypeError(`${label} is required`);
  if (normalized.length > max) throw new RangeError(`${label} exceeds ${max} characters`);
  return normalized;
}

export function optional(value, max = 20_000) {
  if (value == null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  if (normalized.length > max) throw new RangeError(`value exceeds ${max} characters`);
  return normalized;
}

export function boundedInteger(value, fallback, minimum, maximum, label = 'value') {
  const number = value == null ? fallback : Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) throw new RangeError(`${label} must be an integer between ${minimum} and ${maximum}`);
  return number;
}

export function boundedNumber(value, fallback, minimum, maximum, label = 'value') {
  const number = value == null ? fallback : Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) throw new RangeError(`${label} must be between ${minimum} and ${maximum}`);
  return number;
}

export function uniqueStrings(values, { maxItems = 256, maxLength = 2_000 } = {}) {
  if (!Array.isArray(values)) return Object.freeze([]);
  const output = [];
  const seen = new Set();
  for (const value of values) {
    const normalized = String(value ?? '').trim().slice(0, maxLength);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
    if (output.length >= maxItems) break;
  }
  return Object.freeze(output);
}

export function safeRelativePath(value) {
  const normalized = required(value, 'path', 2_000).replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+/g, '/');
  if (normalized.startsWith('/') || normalized === '..' || normalized.startsWith('../') || normalized.includes('/../') || /^[A-Za-z]:\//.test(normalized)) throw new TypeError(`unsafe relative path: ${value}`);
  return normalized;
}

export function createId(prefix) {
  return `${prefix}_${randomUUID().replaceAll('-', '')}`;
}

export function nowIso(clock = Date.now) {
  return new Date(Number(clock())).toISOString();
}

export function parseJson(value, fallback = null) {
  try { return value == null ? fallback : JSON.parse(value); } catch { return fallback; }
}

export function estimateTokens(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? null);
  return Math.max(1, Math.ceil(Buffer.byteLength(text, 'utf8') / 4));
}

export function hashWithoutReceipt(value) {
  const clone = { ...(value ?? {}) };
  delete clone.receiptSha256;
  return canonicalSha256(clone);
}

export function verifySigned(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const receipt = String(value.receiptSha256 ?? '');
  if (!SHA256.test(receipt)) return false;
  return hashWithoutReceipt(value) === receipt;
}
