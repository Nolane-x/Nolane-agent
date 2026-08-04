const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\b(?:OPENAI|ANTHROPIC|GEMINI|GOOGLE|AWS|AZURE)_[A-Z0-9_]*(?:KEY|SECRET|TOKEN)\s*=\s*\S+/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bghp_[A-Za-z0-9]{30,}\b/,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{16,}\b/,
  /\bnpm_[A-Za-z0-9]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  /\bhf_[A-Za-z0-9]{20,}\b/,
  /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s/:@]+:[^\s@]+@/i,
  /\b(?:session|sessionid|connect\.sid|auth_token)=[A-Za-z0-9%._~-]{24,}\b/i,
];

export function assertSafeValue(value, path = '$', ancestors = new WeakSet()) {
  if (value === null || typeof value !== 'object') return value;
  if (ancestors.has(value)) throw new TypeError(`Cyclic input at ${path}`);
  ancestors.add(value);
  try {
    for (const key of Object.keys(value)) {
      if (DANGEROUS_KEYS.has(key)) throw new TypeError(`Dangerous key ${key} at ${path}`);
      assertSafeValue(value[key], `${path}.${key}`, ancestors);
    }
    return value;
  } finally {
    ancestors.delete(value);
  }
}

export function boundedJsonParse(text, maxBytes = 1_000_000) {
  if (typeof text !== 'string') throw new TypeError('JSON input must be text');
  if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new RangeError('JSON input is too large');
  const parsed = JSON.parse(text);
  return assertSafeValue(parsed);
}

export function containsSecret(value) {
  let text;
  try { text = typeof value === 'string' ? value : JSON.stringify(value); }
  catch { throw new TypeError('Value is not serializable for secret screening'); }
  if (typeof text !== 'string') throw new TypeError('Value is not serializable for secret screening');
  return SECRET_PATTERNS.some((pattern) => pattern.test(text));
}

export function assertNoSecrets(value) {
  if (containsSecret(value)) throw new TypeError('Potential secret material is not allowed in ForgeOS artifacts');
  return value;
}

export function requireHumanConfirmation({ action, confirmation }) {
  const expected = `CONFIRM ${String(action ?? '').trim()}`;
  if (!action || confirmation !== expected) throw new Error(`Explicit human confirmation required: ${expected}`);
  return true;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
