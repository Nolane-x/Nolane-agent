import { createHash } from 'node:crypto';
import { signed, text } from '../construction/construction-utils.mjs';
import { sanitizeUntrustedContent } from './content-sanitizer.mjs';
import { SecretScanner } from './secret-scanner.mjs';

const SOURCES = new Set(['repository', 'browser', 'terminal', 'tool']);

export class PromptInjectionQuarantine {
  constructor({ maxChars = 12_000, secretScanner = new SecretScanner() } = {}) {
    this.maxChars = Number(maxChars);
    if (!Number.isInteger(this.maxChars) || this.maxChars < 1 || this.maxChars > 1_000_000) throw new TypeError('maxChars is invalid');
    this.secretScanner = secretScanner;
  }
  screen({ sourceKind, content, metadata = {} } = {}) {
    const source = text(sourceKind, 'sourceKind', 128);
    if (!SOURCES.has(source)) throw new TypeError(`Unsupported source kind: ${source}`);
    const value = String(content ?? '');
    const sanitized = sanitizeUntrustedContent(value, { maxChars: this.maxChars });
    const secrets = this.secretScanner.scanText(value, { source });
    const findings = [...sanitized.flags];
    if (secrets.blocked) findings.push('secret-material');
    const status = findings.includes('prompt-injection-pattern') || secrets.blocked ? 'quarantine' : findings.length ? 'review' : 'pass';
    return signed({
      schema: 'forge.prompt-injection-quarantine.v1',
      sourceKind: source,
      sourceId: metadata.sourceId ? String(metadata.sourceId).slice(0, 512) : null,
      status,
      findings: [...new Set(findings)].sort(),
      contentSha256: createHash('sha256').update(value).digest('hex'),
      safeProjection: { contentIncluded: false, originalChars: value.length, truncated: sanitized.truncated, renderAs: 'metadata-only' },
      claims: { rawContentStored: false, secretMaterialStored: false, quarantineAutomaticallyExecutesContent: false },
    });
  }
}
