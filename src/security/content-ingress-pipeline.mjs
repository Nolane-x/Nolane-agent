import { createHash } from 'node:crypto';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { deepFreeze, text } from '../construction/construction-utils.mjs';
import { sanitizeUntrustedContent } from './content-sanitizer.mjs';
import { SecretScanner } from './secret-scanner.mjs';

const SOURCE_KINDS = new Set([
  'repository',
  'instruction',
  'plugin',
  'handoff',
  'memory',
  'reference',
  'browser',
  'terminal',
  'tool',
]);

function boundedSourceId(value) {
  const sourceId = String(value ?? '').trim();
  if (!sourceId) throw new TypeError('sourceId is required');
  if (sourceId.length > 512) throw new RangeError('sourceId exceeds 512 characters');
  return sourceId;
}

function marker({ status, sourceKind, sourceId, contentSha256, findings, receiptSha256 }) {
  const label = status === 'quarantine' ? 'quarantined-content' : 'review-required-content';
  return `[${label} sourceKind=${sourceKind} sourceId=${JSON.stringify(sourceId)} contentSha256=${contentSha256} findings=${findings.join(',') || 'none'} receiptSha256=${receiptSha256}]`;
}

export class ContentIngressPipeline {
  constructor({ maxChars = 12_000, secretScanner = new SecretScanner() } = {}) {
    this.maxChars = Number(maxChars);
    if (!Number.isInteger(this.maxChars) || this.maxChars < 1 || this.maxChars > 1_000_000) {
      throw new TypeError('maxChars must be between 1 and 1000000');
    }
    if (!secretScanner || typeof secretScanner.scanText !== 'function') throw new TypeError('secretScanner must expose scanText()');
    this.secretScanner = secretScanner;
  }

  screen({ sourceKind, sourceId, content } = {}) {
    const kind = text(sourceKind, 'sourceKind', 128);
    if (!SOURCE_KINDS.has(kind)) throw new TypeError(`Unsupported source kind: ${kind}`);
    const id = boundedSourceId(sourceId);
    const raw = String(content ?? '');
    const sanitized = sanitizeUntrustedContent(raw, { maxChars: this.maxChars });
    const secretScan = this.secretScanner.scanText(raw, { source: `${kind}:${id}` });
    const findings = [...sanitized.flags];
    for (const finding of secretScan.findings) findings.push(`secret:${finding.type}`);
    const uniqueFindings = [...new Set(findings)].sort();
    const status = uniqueFindings.includes('prompt-injection-pattern') || secretScan.blocked
      ? 'quarantine'
      : uniqueFindings.length > 0
        ? 'review'
        : 'pass';
    const contentSha256 = createHash('sha256').update(raw).digest('hex');
    const base = {
      schema: 'nolane.agent.content-ingress.v1',
      sourceKind: kind,
      sourceId: id,
      status,
      findings: uniqueFindings,
      contentSha256,
      originalChars: raw.length,
      sanitizedChars: sanitized.text.length,
      truncated: sanitized.truncated,
      contentIncluded: status === 'pass',
      renderAs: status === 'pass' ? 'text' : 'metadata-only',
      claims: {
        rawContentStoredInReceipt: false,
        secretMaterialStoredInReceipt: false,
        quarantinedContentExecuted: false,
      },
    };
    const receiptSha256 = canonicalSha256(base);
    const safeText = status === 'pass'
      ? sanitized.text
      : marker({ status, sourceKind: kind, sourceId: id, contentSha256, findings: uniqueFindings, receiptSha256 });
    return deepFreeze({ ...base, safeText, receiptSha256 });
  }
}
