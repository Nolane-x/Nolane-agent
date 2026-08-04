import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

export const SHA256 = /^[a-f0-9]{64}$/i;

export function text(value, label, max = 512) {
  const output = String(value ?? '').trim();
  if (!output) throw new TypeError(`${label} is required`);
  if (output.length > max) throw new RangeError(`${label} exceeds ${max} characters`);
  return output;
}

export function number(value, label, { min = -Infinity, max = Infinity, integer = false } = {}) {
  const output = Number(value);
  if (!Number.isFinite(output) || output < min || output > max) throw new TypeError(`${label} must be between ${min} and ${max}`);
  return integer ? Math.trunc(output) : output;
}

export function receipt(value, label = 'verification receipt') {
  const output = String(value ?? '').trim().toLowerCase();
  if (!SHA256.test(output)) throw new TypeError(`${label} must be SHA-256`);
  return output;
}

export function uniqueStrings(values, label, maxItems = 256) {
  if (!Array.isArray(values)) throw new TypeError(`${label} must be an array`);
  if (values.length > maxItems) throw new RangeError(`${label} exceeds ${maxItems} items`);
  return Object.freeze([...new Set(values.map((value, index) => text(value, `${label}[${index}]`, 256).toLowerCase()))].sort());
}

export function signed(base) {
  return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
}
