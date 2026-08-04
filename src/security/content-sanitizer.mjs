import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const BIDI_RE = /[\u202A-\u202E\u2066-\u2069]/g;
const INJECTION_RE = /(?:ignore\s+(?:all\s+)?previous\s+instructions|system\s*:|developer\s*:|reveal\s+(?:the\s+)?(?:system|developer)\s+prompt|jailbreak)/i;
const HTML_RE = /<\/?[a-z][^>]*>/i;

export function sanitizeUntrustedContent(value, { maxChars = 12_000 } = {}) {
  const limit = Number(maxChars);
  if (!Number.isInteger(limit) || limit < 1 || limit > 1_000_000) throw new TypeError('maxChars must be between 1 and 1000000');
  const original = String(value ?? '');
  const flags = [];
  if (CONTROL_RE.test(original)) flags.push('control-characters');
  CONTROL_RE.lastIndex = 0;
  if (BIDI_RE.test(original)) flags.push('bidi-overrides');
  BIDI_RE.lastIndex = 0;
  if (INJECTION_RE.test(original)) flags.push('prompt-injection-pattern');
  if (HTML_RE.test(original)) flags.push('html-like-content');
  const cleaned = original.replace(CONTROL_RE, '').replace(BIDI_RE, '');
  const text = cleaned.slice(0, limit);
  const base = Object.freeze({
    schema: 'forge.sanitized-content.v1',
    renderAs: 'text',
    text,
    truncated: cleaned.length > limit,
    originalChars: original.length,
    sanitizedChars: text.length,
    flags: Object.freeze([...new Set(flags)].sort()),
  });
  return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
}
