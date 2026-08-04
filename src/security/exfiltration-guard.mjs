import { createHash } from 'node:crypto';
import { signed, text } from '../construction/construction-utils.mjs';
import { SecretScanner } from './secret-scanner.mjs';

const BOUNDARIES = new Set(['prompt', 'context', 'memory', 'trace', 'log', 'artifact', 'error', 'network']);
function entropyLike(value) {
  if (value.length < 24) return false;
  const chars = new Set(value).size;
  return chars >= 18 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value);
}

export class ExfiltrationGuard {
  constructor({ secretScanner = new SecretScanner(), maxBytes = 1_000_000 } = {}) { this.secretScanner = secretScanner; this.maxBytes = maxBytes; }
  inspect({ boundary, payload, destination = 'local' } = {}) {
    const kind = text(boundary, 'boundary', 128);
    if (!BOUNDARIES.has(kind)) throw new TypeError(`Unsupported boundary: ${kind}`);
    const value = typeof payload === 'string' ? payload : JSON.stringify(payload ?? null);
    if (Buffer.byteLength(value) > this.maxBytes) throw new RangeError('payload exceeds exfiltration scan budget');
    const scan = this.secretScanner.scanText(value, { source: kind });
    const findings = [];
    if (scan.blocked) findings.push({ kind: 'secret-material', count: scan.findings.length });
    const candidates = value.match(/[A-Za-z0-9_\-+/=]{24,}/g) ?? [];
    if (candidates.some(entropyLike)) findings.push({ kind: 'high-entropy-payload', count: 1 });
    if (kind === 'network' && destination !== 'local' && value.length > 100_000) findings.push({ kind: 'bulk-cross-boundary-payload', count: 1 });
    return signed({
      schema: 'forge.exfiltration-guard.v1',
      boundary: kind,
      destination: String(destination).slice(0, 512),
      status: findings.length ? 'block' : 'pass',
      findings,
      payloadSha256: createHash('sha256').update(value).digest('hex'),
      payloadBytes: Buffer.byteLength(value),
      claims: { rawPayloadStored: false, secretMaterialStored: false },
    });
  }
}
