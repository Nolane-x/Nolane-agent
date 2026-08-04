import { createHash } from 'node:crypto';

const DEFINITIONS = Object.freeze([
  Object.freeze({ type: 'private_key', expression: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g }),
  Object.freeze({ type: 'github_token', expression: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,255}\b|\bgithub_pat_[A-Za-z0-9_]{20,255}\b/g }),
  Object.freeze({ type: 'openai_api_key', expression: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,255}\b/g }),
  Object.freeze({ type: 'aws_access_key', expression: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g }),
  Object.freeze({ type: 'google_api_key', expression: /\bAIza[A-Za-z0-9_-]{30,255}\b/g }),
  Object.freeze({ type: 'slack_token', expression: /\bxox[baprs]-[A-Za-z0-9-]{12,255}\b/g }),
  Object.freeze({ type: 'jwt', expression: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g }),
  Object.freeze({ type: 'credential_assignment', expression: /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|passwd|token)\s*[=:]\s*["']?([A-Za-z0-9_./+~=-]{12,})["']?/gi, capture: 1 }),
]);

function lineColumn(text, index) {
  const before = text.slice(0, index);
  const lines = before.split('\n');
  return Object.freeze({ line: lines.length, column: lines.at(-1).length + 1 });
}

function fingerprint(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

function overlaps(left, right) {
  return left.start < right.end && right.start < left.end;
}

export class SecretScanError extends Error {
  constructor(result) {
    super(`Secret scan blocked ${result.findings.length} finding(s)`);
    this.name = 'SecretScanError';
    this.code = 'SECRET_SCAN_BLOCKED';
    this.findings = result.findings;
  }
}

export class SecretScanner {
  constructor({ definitions = DEFINITIONS, maxBytes = 5_000_000 } = {}) {
    if (!Array.isArray(definitions) || definitions.length === 0) throw new TypeError('secret definitions are required');
    this.definitions = definitions;
    this.maxBytes = Number(maxBytes);
    if (!Number.isInteger(this.maxBytes) || this.maxBytes < 1 || this.maxBytes > 100_000_000) throw new TypeError('maxBytes must be between 1 and 100000000');
  }

  scanText(value, { source = 'text' } = {}) {
    const text = String(value ?? '');
    if (Buffer.byteLength(text) > this.maxBytes) {
      const error = new Error(`Secret scan input exceeds ${this.maxBytes} bytes`);
      error.code = 'SECRET_SCAN_INPUT_TOO_LARGE';
      throw error;
    }
    const spans = [];
    for (const definition of this.definitions) {
      const flags = definition.expression.flags.includes('g') ? definition.expression.flags : `${definition.expression.flags}g`;
      const expression = new RegExp(definition.expression.source, flags);
      let match;
      while ((match = expression.exec(text)) !== null) {
        const secret = definition.capture ? match[definition.capture] : match[0];
        if (!secret) continue;
        const relative = definition.capture ? match[0].indexOf(secret) : 0;
        const start = match.index + Math.max(0, relative);
        const end = start + secret.length;
        const candidate = { start, end, type: definition.type, secret };
        if (!spans.some((span) => overlaps(span, candidate))) spans.push(candidate);
        if (match[0].length === 0) expression.lastIndex += 1;
      }
    }
    spans.sort((left, right) => left.start - right.start || right.end - left.end);
    const findings = spans.map((span) => {
      const position = lineColumn(text, span.start);
      return Object.freeze({
        type: span.type,
        source: String(source),
        line: position.line,
        column: position.column,
        fingerprint: fingerprint(span.secret),
      });
    });
    let cursor = 0;
    let redactedText = '';
    for (const span of spans) {
      redactedText += text.slice(cursor, span.start);
      redactedText += `[REDACTED:${span.type}]`;
      cursor = span.end;
    }
    redactedText += text.slice(cursor);
    return Object.freeze({
      schema: 'forge.secret-scan.v1',
      source: String(source),
      blocked: findings.length > 0,
      findings: Object.freeze(findings),
      redactedText,
      contentSha256: createHash('sha256').update(text).digest('hex'),
    });
  }

  assertClean(value, options = {}) {
    const result = this.scanText(value, options);
    if (result.blocked) throw new SecretScanError(result);
    return result;
  }
}
