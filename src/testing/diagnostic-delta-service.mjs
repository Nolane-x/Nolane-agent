import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { redactSecrets } from '../security/redaction.mjs';

function boundedText(value, maxBytes, label) {
  const text = String(value ?? '');
  if (Buffer.byteLength(text) > maxBytes) throw new Error(`${label} exceeds ${maxBytes} byte limit`);
  return text;
}

function normalizeMessage(value) { return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 2000); }
function normalizePath(value) { return String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, '').slice(0, 1000); }

function parseDiagnostics(text, maxDiagnostics) {
  const output = [];
  const lines = String(text).split(/\r?\n/);
  const add = (item) => {
    if (output.length >= maxDiagnostics) return;
    const normalized = {
      path: normalizePath(item.path),
      line: Math.max(1, Number(item.line) || 1),
      column: Math.max(1, Number(item.column) || 1),
      severity: /warn/i.test(item.severity) ? 'warning' : 'error',
      code: item.code ? String(item.code).slice(0, 200) : null,
      message: normalizeMessage(item.message),
    };
    if (!normalized.message) return;
    output.push(Object.freeze({ ...normalized, fingerprint: canonicalSha256(normalized) }));
  };
  for (const line of lines) {
    let match = line.match(/^(.+?)\((\d+),(\d+)\):\s*(error|warning)\s*([A-Za-z0-9_.-]+)?\s*:\s*(.+)$/i);
    if (match) { add({ path: match[1], line: match[2], column: match[3], severity: match[4], code: match[5], message: match[6] }); continue; }
    match = line.match(/^(.+?):(\d+):(\d+)\s+(error|warning)\s*([A-Za-z0-9_.-]+)?\s*:\s*(.+)$/i);
    if (match) { add({ path: match[1], line: match[2], column: match[3], severity: match[4], code: match[5], message: match[6] }); continue; }
    match = line.match(/^(.+?):(\d+)(?::(\d+))?\s*[-:]?\s*(error|warning)\s*([A-Za-z0-9_.-]+)?\s*:?\s*(.+)$/i);
    if (match) { add({ path: match[1], line: match[2], column: match[3] ?? 1, severity: match[4], code: match[5], message: match[6] }); continue; }
    match = line.match(/^\s*(Error|Warning):\s*(.+)$/i);
    if (match) add({ path: '<process>', line: 1, column: 1, severity: match[1], code: null, message: match[2] });
  }
  return output;
}

export class DiagnosticDeltaService {
  constructor({ maxLogBytes = 5_000_000, maxDiagnostics = 5000 } = {}) {
    this.maxLogBytes = Math.max(1024, Number(maxLogBytes) || 5_000_000);
    this.maxDiagnostics = Math.max(1, Math.min(50_000, Number(maxDiagnostics) || 5000));
  }

  compare({ baseline = '', current = '', secretValues = [] } = {}) {
    const safeBaseline = redactSecrets(boundedText(baseline, this.maxLogBytes, 'baseline diagnostics'), { secretValues });
    const safeCurrent = redactSecrets(boundedText(current, this.maxLogBytes, 'current diagnostics'), { secretValues });
    const baselineItems = parseDiagnostics(safeBaseline, this.maxDiagnostics);
    const currentItems = parseDiagnostics(safeCurrent, this.maxDiagnostics);
    const before = new Map(baselineItems.map((item) => [item.fingerprint, item]));
    const after = new Map(currentItems.map((item) => [item.fingerprint, item]));
    const newDiagnostics = currentItems.filter((item) => !before.has(item.fingerprint));
    const persistingDiagnostics = currentItems.filter((item) => before.has(item.fingerprint));
    const resolvedDiagnostics = baselineItems.filter((item) => !after.has(item.fingerprint));
    const base = {
      schema: 'forge.diagnostic-delta.v1',
      summary: { baseline: baselineItems.length, current: currentItems.length, new: newDiagnostics.length, persisting: persistingDiagnostics.length, resolved: resolvedDiagnostics.length },
      newDiagnostics,
      persistingDiagnostics,
      resolvedDiagnostics,
      baselineSha256: canonicalSha256(safeBaseline),
      currentSha256: canonicalSha256(safeCurrent),
      truncated: baselineItems.length >= this.maxDiagnostics || currentItems.length >= this.maxDiagnostics,
    };
    return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
}
