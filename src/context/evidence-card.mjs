import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { redactSecrets } from '../security/redaction.mjs';

const SHA256 = /^[a-f0-9]{64}$/;

function clean(value, label, max = 4_000, required = true) {
  const output = String(value ?? '').trim();
  if (required && !output) throw new TypeError(`${label} is required`);
  if (output.length > max) throw new TypeError(`${label} exceeds ${max} characters`);
  return output;
}
function hash(value, label, required = true) {
  const output = String(value ?? '').trim().toLowerCase();
  if (!output && !required) return null;
  if (!SHA256.test(output)) throw new TypeError(`${label} must be a SHA-256 digest`);
  return output;
}
function integer(value, label, min = 0) {
  const output = Number(value);
  if (!Number.isInteger(output) || output < min) throw new TypeError(`${label} must be an integer at least ${min}`);
  return output;
}
function boundedNumber(value, label, min, max) {
  const output = Number(value);
  if (!Number.isFinite(output) || output < min || output > max) throw new TypeError(`${label} must be between ${min} and ${max}`);
  return output;
}
function strings(value = [], label = 'items') {
  if (!Array.isArray(value) || value.length > 128) throw new TypeError(`${label} must be an array of at most 128 items`);
  return [...new Set(value.map((item, index) => clean(item, `${label}[${index}]`, 256)).filter(Boolean))].sort();
}
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

export function createEvidenceCard(input = {}) {
  const source = clean(input.source, 'source', 128);
  const path = clean(input.path ?? input.sourceRef ?? source, 'path', 4_096);
  const symbol = clean(input.symbol, 'symbol', 512, false) || null;
  const startLine = integer(input.startLine ?? input.lines?.[0] ?? 1, 'source span startLine', 1);
  const endLine = integer(input.endLine ?? input.lines?.[1] ?? startLine, 'source span endLine', 1);
  if (endLine < startLine) throw new TypeError('source span endLine must not precede startLine');
  const sourceHash = hash(input.sourceHash, 'sourceHash');
  const currentHash = hash(input.currentHash, 'currentHash', false);
  const trust = boundedNumber(input.trust ?? input.confidence ?? 0.5, 'trust', 0, 1);
  const tokenCost = integer(input.tokenCost, 'tokenCost', 0);
  const text = redactSecrets(String(input.text ?? ''), { secretValues: input.secretValues ?? [] }).replace(/\u0000/g, '').slice(0, 32_000);
  const claim = clean(input.claim ?? input.reason ?? `${source} evidence at ${path}:${startLine}-${endLine}`, 'claim', 4_000);
  const supports = strings(input.supports, 'supports');
  const contradicts = strings(input.contradicts, 'contradicts');
  const provenance = {
    source, path, symbol, lines: [startLine, endLine], sourceHash,
    branch: clean(input.branch, 'branch', 512, false) || null,
    worktree: clean(input.worktree, 'worktree', 1_024, false) || null,
  };
  const evidenceId = `ev_${canonicalSha256(provenance).slice(0, 32)}`;
  const base = {
    schema: 'forge.evidence-card.v1', evidenceId, source, path, symbol, lines: provenance.lines,
    sourceHash, currentHash, branch: provenance.branch, worktree: provenance.worktree,
    freshness: currentHash ? (currentHash === sourceHash ? 'fresh' : 'stale') : clean(input.freshness, 'freshness', 32, false) || 'unknown',
    claim, trust, supports, contradicts, tokenCost, tokenCostMethod: clean(input.tokenCostMethod, 'tokenCostMethod', 128, false) || 'provided-or-degraded', text,
  };
  return freeze({ ...base, receiptSha256: canonicalSha256(base) });
}
