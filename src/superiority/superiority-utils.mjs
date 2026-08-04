import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

export const SHA256_RE = /^[a-f0-9]{64}$/i;

export function nonEmpty(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required`);
  return text;
}

export function boundedNumber(value, fallback, min = 0, max = 1) {
  const number = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(number) ? number : fallback));
}

export function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((item) => String(item ?? '').trim()).filter(Boolean))];
}

export function requireSha256(value, label) {
  const text = nonEmpty(value, label);
  if (!SHA256_RE.test(text)) throw new TypeError(`${label} must be a SHA-256 digest`);
  return text.toLowerCase();
}

export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function signed(base) {
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}
