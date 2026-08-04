import { canonicalSha256, canonicalStringify } from '../../vendor/forge-os/src/core/canonical-json.mjs';
export { canonicalSha256, canonicalStringify };
export function clone(value) { return structuredClone(value); }
export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
export function boundedNumber(value, name, { min = 0, max = 1 } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new TypeError(`${name} must be between ${min} and ${max}`);
  return number;
}
