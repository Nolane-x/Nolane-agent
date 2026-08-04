import path from 'node:path';
import { redactSecrets } from '../security/redaction.mjs';
import { signed, text } from '../construction/construction-utils.mjs';

const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?previous\s+instructions/i,
  /reveal\s+(?:the\s+)?(?:system|developer)\s+(?:prompt|message)/i,
  /act\s+as\s+(?:the\s+)?system/i,
  /override\s+(?:your\s+)?(?:rules|policy|instructions)/i,
  /send\s+(?:all\s+)?(?:secrets|credentials|cookies)/i,
];
const EXECUTABLE_EXTENSIONS = new Set(['.exe', '.msi', '.bat', '.cmd', '.ps1', '.sh', '.app', '.dmg', '.pkg', '.deb', '.rpm', '.apk', '.jar']);
const EXECUTABLE_MIME = /(?:x-msdownload|x-executable|x-shellscript|java-archive|application\/vnd\.android\.package-archive)/i;

export class BrowserInjectionGuard {
  constructor({ maxPreviewBytes = 4_000 } = {}) { this.maxPreviewBytes = Math.max(256, Math.min(32_000, Number(maxPreviewBytes) || 4_000)); }
  screen({ source = 'page', content = '', filename = '', mimeType = '' } = {}) {
    const sourceKind = text(source, 'source', 64).toLowerCase();
    const raw = String(content ?? '');
    const findings = [];
    for (const pattern of INJECTION_PATTERNS) if (pattern.test(raw)) { findings.push({ kind: 'prompt-injection', severity: 'high', source: sourceKind }); break; }
    const extension = path.extname(String(filename ?? '')).toLowerCase();
    if (sourceKind === 'download' && (EXECUTABLE_EXTENSIONS.has(extension) || EXECUTABLE_MIME.test(String(mimeType ?? '')))) findings.push({ kind: 'executable-download', severity: 'critical', source: sourceKind, extension: extension || null });
    const redacted = String(redactSecrets(raw)).replace(/(Authorization\s*:\s*Bearer\s+)[^\s,;]+/gi, '$1[REDACTED]');
    const preview = Buffer.from(redacted).subarray(0, this.maxPreviewBytes).toString('utf8');
    return signed({ schema: 'forge.browser-content-screening.v1', source: sourceKind, allowed: findings.length === 0, findings, redactedPreview: preview, contentBytes: Buffer.byteLength(raw), claims: { rawContentStored: false, secretContentStored: false, downloadExecuted: false } });
  }
}
