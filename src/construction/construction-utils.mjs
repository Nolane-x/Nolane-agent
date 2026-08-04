import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const PRIVATE_KEY = /(?:chain[-_ ]?of[-_ ]?thought|raw[-_ ]?prompt|model[-_ ]?output|password|secret|authorization|cookie|environment|envDump|rawCommand|apiKey|accessToken|refreshToken|bearerToken)/i;

export function text(value, label, max = 2048) {
  const out = String(value ?? '').trim();
  if (!out) throw new TypeError(`${label} is required`);
  if (out.length > max) throw new RangeError(`${label} exceeds ${max} characters`);
  return out;
}

export function optionalText(value, max = 2048) {
  const out = String(value ?? '').trim();
  if (out.length > max) throw new RangeError(`value exceeds ${max} characters`);
  return out;
}

export function boundedNumber(value, fallback, min, max, label) {
  const out = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(out) || out < min || out > max) throw new TypeError(`${label} must be between ${min} and ${max}`);
  return out;
}

export function strings(value, label, maxItems = 256, maxLength = 2048) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maxItems) throw new TypeError(`${label} must be an array with at most ${maxItems} items`);
  const out = value.map((item, index) => text(item, `${label}[${index}]`, maxLength));
  if (new Set(out).size !== out.length) throw new TypeError(`${label} contains duplicates`);
  return out;
}

export function rejectPrivate(value, path = 'value', seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    const hasValue = child !== false && child !== null && child !== '' && child !== 0;
    const safeAuthorizationDecision = /^authorization$/i.test(key)
      && child && typeof child === 'object' && !Array.isArray(child)
      && Object.keys(child).every((name) => /^(?:schema|allowed|reasons|semanticPatchReceiptSha256|patchBudgetReceiptSha256|claims|receiptSha256)$/i.test(name));
    if (PRIVATE_KEY.test(key) && hasValue && !safeAuthorizationDecision) throw new TypeError(`private field is not allowed: ${path}.${key}`);
    rejectPrivate(child, `${path}.${key}`, seen);
  }
}

export function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

export function signed(base) {
  rejectPrivate(base);
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}

export function stableId(type, id) { return `${text(type, 'type', 128)}:${text(id, 'id', 512)}`; }

export function pathMatches(pattern, candidate) {
  const escaped = String(pattern)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replaceAll('**', '___DOUBLE_STAR___')
    .replaceAll('*', '[^/]*')
    .replaceAll('___DOUBLE_STAR___', '.*');
  return new RegExp(`^${escaped}$`).test(String(candidate).replaceAll('\\', '/'));
}
