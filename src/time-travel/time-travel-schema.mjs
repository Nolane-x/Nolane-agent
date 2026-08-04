import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

export const TIME_TRAVEL_SCHEMAS = Object.freeze({
  index: 'nolane.time-travel-index.v1',
  checkpoint: 'nolane.time-travel-checkpoint.v1',
  comparison: 'nolane.time-travel-comparison.v1',
  restorePlan: 'nolane.time-travel-restore-plan.v1',
  restoreReceipt: 'nolane.time-travel-restore-receipt.v1',
  branchReceipt: 'nolane.time-travel-branch-receipt.v1',
  replayReceipt: 'nolane.time-travel-replay-receipt.v1',
  export: 'nolane.time-travel-evidence-bundle.v1',
});

export function freeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) freeze(child, seen);
  return Object.freeze(value);
}

export function signed(base) { return freeze({ ...base, receiptSha256: canonicalSha256(base) }); }

export function safeRelativePath(value) {
  const raw = String(value ?? '').replaceAll('\\', '/').trim();
  if (!raw || raw.includes('\0') || raw.startsWith('/') || /^[A-Za-z]:\//.test(raw)) throw Object.assign(new TypeError('A relative project path is required'), { code: 'TIME_TRAVEL_INVALID_PATH', statusCode: 400 });
  const parts = raw.split('/').filter((part) => part && part !== '.');
  if (!parts.length || parts.some((part) => part === '..')) throw Object.assign(new TypeError('Path escapes the project workspace'), { code: 'TIME_TRAVEL_PATH_ESCAPE', statusCode: 403 });
  return parts.join('/');
}

export function safeLabel(value, fallback = 'Checkpoint') {
  return String(value ?? fallback).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 240) || fallback;
}
