import { createHash } from 'node:crypto';
import { signed, text } from '../construction/construction-utils.mjs';

const RULES = Object.freeze({
  shell: [
    ['command-separator', /(?:^|[^\\])[;&|`]|\$\(|\r|\n/],
    ['shell-redirection', /(?:^|\s)(?:>|>>|<)\s*[^\s]/],
  ],
  sql: [
    ['sql-control', /(?:'|\")\s*(?:or|and)\s+\d+\s*=\s*\d+|--|\/\*|;\s*(?:drop|delete|update|insert)\b/i],
  ],
  path: [
    ['path-traversal', /(?:^|[\\/])\.\.(?:[\\/]|$)|%2e%2e(?:%2f|%5c)/i],
    ['absolute-path', /^(?:[a-z]:[\\/]|[\\/]{2}|\/)/i],
  ],
  template: [
    ['template-expression', /\{\{[\s\S]*?(?:constructor|process|require|import|__proto__)[\s\S]*?\}\}|<%[\s\S]*?%>/i],
  ],
  'dynamic-code': [
    ['dynamic-code', /\b(?:eval|Function|execScript|vm\.runIn)\s*\(/i],
  ],
  prompt: [
    ['prompt-injection', /ignore\s+(?:all\s+)?previous\s+instructions|reveal\s+(?:the\s+)?(?:system|developer)\s+prompt|\bsystem\s*:/i],
  ],
});

export class ContextualInjectionDetector {
  detect({ context, value, escaping = [] } = {}) {
    const kind = text(context, 'context', 128);
    const rules = RULES[kind];
    if (!rules) throw new TypeError(`Unsupported injection context: ${kind}`);
    const candidate = String(value ?? '').slice(0, 200_000);
    const escaped = new Set(Array.isArray(escaping) ? escaping.map(String) : []);
    const findings = rules
      .filter(([code, expression]) => expression.test(candidate) && !escaped.has(code))
      .map(([code]) => Object.freeze({ code, context: kind, severity: kind === 'prompt' || kind === 'dynamic-code' ? 'critical' : 'high' }));
    return signed({
      schema: 'forge.contextual-injection.v1',
      context: kind,
      contentSha256: createHash('sha256').update(candidate).digest('hex'),
      status: findings.length ? 'block' : 'pass',
      findings,
      claims: { automaticRewritePerformed: false, contextSpecificEscapingRequired: true },
    });
  }
}
