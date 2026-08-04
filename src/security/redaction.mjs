const PATTERNS = [
  { re: /\bsk-[A-Za-z0-9_-]{16,}\b/g, replace: '[REDACTED]' },
  { re: /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/g, replace: '[REDACTED]' },
  { re: /\bxox[baprs]-[A-Za-z0-9-]{12,}\b/g, replace: '[REDACTED]' },
  { re: /\bAIza[A-Za-z0-9_-]{20,}\b/g, replace: '[REDACTED]' },
  { re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, replace: '[REDACTED]' },
  { re: /\bBearer\s+[A-Za-z0-9._~+\/-]{12,}\b/gi, replace: 'Bearer [REDACTED]' },
  { re: /((?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password)\s*[=:]\s*["']?)[^\s,"'}]{8,}/gi, replace: '$1[REDACTED]' },
];

function redactString(value, secretValues) {
  let text = value;
  for (const secret of secretValues) {
    if (!secret || secret.length < 4) continue;
    text = text.split(secret).join('[REDACTED]');
  }
  for (const { re, replace } of PATTERNS) text = text.replace(re, replace);
  return text;
}

export function redactSecrets(value, { secretValues = [] } = {}) {
  const secrets = [...new Set(secretValues.map((item) => String(item)).filter(Boolean))].sort((a, b) => b.length - a.length);
  const seen = new WeakMap();
  const visit = (node) => {
    if (typeof node === 'string') return redactString(node, secrets);
    if (node === null || typeof node !== 'object') return node;
    if (seen.has(node)) return '[CIRCULAR]';
    if (Array.isArray(node)) {
      const out = []; seen.set(node, out);
      for (const item of node) out.push(visit(item));
      return out;
    }
    const out = {}; seen.set(node, out);
    for (const [key, child] of Object.entries(node)) out[key] = visit(child);
    return out;
  };
  return visit(value);
}
