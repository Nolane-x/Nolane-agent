import path from 'node:path';
import { stableForensicId } from './stable-id.mjs';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const UNAVAILABLE_STATES = Object.freeze(['excluded-with-reason', 'external-unverified', 'upstream-source-unavailable']);
const AVAILABLE_STATES = Object.freeze(['exact', 'superset', 'partial', 'absent', 'excluded-with-reason', 'external-unverified']);

function freeze(value) {
  if (value && typeof value === 'object' && Object.isFrozen(value)) return value;
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) value[key] = freeze(entry);
    return Object.freeze(value);
  }
  return value;
}

function safePath(value, label) {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${label} is required`);
  const normalized = value.replaceAll('\\', '/');
  if (path.posix.isAbsolute(normalized) || /^[a-zA-Z]:\//.test(normalized) || normalized.split('/').includes('..')) throw new TypeError(`Unsafe ${label}: ${value}`);
  return normalized;
}

function validateRaw(raw, { expectedArchiveSha256, lineNumber }) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError(`NolaneNative ledger line ${lineNumber} must be an object`);
  const source = safePath(raw.source, 'NolaneNative source path');
  if (!SHA256_PATTERN.test(raw.sourceArchiveSha256 ?? '')) throw new TypeError(`NolaneNative ledger line ${lineNumber} has invalid source archive SHA-256`);
  if (raw.sourceArchiveSha256 !== expectedArchiveSha256) throw new Error(`NolaneNative archive SHA-256 mismatch on line ${lineNumber}`);
  if (!SHA256_PATTERN.test(raw.sourceArchiveEntrySha256 ?? '')) throw new TypeError(`NolaneNative ledger line ${lineNumber} has invalid source entry SHA-256`);
  if (!Number.isSafeInteger(raw.bytes) || raw.bytes < 0) throw new TypeError(`NolaneNative ledger line ${lineNumber} has invalid byte count`);
  if (raw.target !== null && raw.target !== undefined) safePath(raw.target, 'Nolane target path');
  if (raw.parityState === 'exact' || raw.parityState === 'superset') throw new Error(`Historical ledger line ${lineNumber} may not assert ${raw.parityState} parity`);
  return { ...raw, source };
}

export function importNolaneNativeTransformationLedger({ jsonlText, expectedArchiveSha256, canonicalSourceAvailable = false } = {}) {
  if (typeof jsonlText !== 'string') throw new TypeError('jsonlText is required');
  if (!SHA256_PATTERN.test(expectedArchiveSha256 ?? '')) throw new TypeError('expectedArchiveSha256 must be a lowercase SHA-256');
  const seen = new Set();
  const records = [];
  const lines = jsonlText.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index].trim();
    if (!text) continue;
    let raw;
    try { raw = JSON.parse(text); } catch (error) { throw new SyntaxError(`Invalid NolaneNative ledger JSON on line ${index + 1}: ${error.message}`); }
    const value = validateRaw(raw, { expectedArchiveSha256, lineNumber: index + 1 });
    const duplicateKey = `${value.source}\0${value.sourceArchiveEntrySha256}`;
    if (seen.has(duplicateKey)) throw new Error(`Duplicate NolaneNative ledger entry: ${value.source}`);
    seen.add(duplicateKey);
    const exclusion = value.action === 'exclude-with-reason' && typeof value.reason === 'string' && value.reason.trim().length > 0;
    const state = exclusion ? 'excluded-with-reason' : canonicalSourceAvailable ? 'absent' : 'upstream-source-unavailable';
    const identity = `${expectedArchiveSha256}:${value.source}:${value.sourceArchiveEntrySha256}`;
    records.push(freeze({
      schema: 'nolane.forensics.nolane_native-provisional-source-record.v1',
      id: stableForensicId('nolane-native-source', identity),
      sourcePath: value.source,
      sourceArchiveSha256: value.sourceArchiveSha256,
      sourceArchiveEntrySha256: value.sourceArchiveEntrySha256,
      bytes: value.bytes,
      directory: value.directory === true,
      historicalAction: value.action ?? null,
      historicalTarget: value.target ?? null,
      historicalStatus: value.status ?? null,
      evidenceClass: 'historical-path-ledger',
      sourceAvailability: canonicalSourceAvailable ? 'available-unparsed' : 'source-bytes-unavailable',
      isFunctionInventory: false,
      state,
      exclusionReason: exclusion ? value.reason.trim() : null,
      allowedParityStates: canonicalSourceAvailable ? AVAILABLE_STATES : UNAVAILABLE_STATES,
      parityBlocker: canonicalSourceAvailable ? 'Canonical source exists but symbol-level parsing is not yet bound' : 'Canonical NolaneNative source bytes are unavailable; path metadata cannot prove function parity',
    }));
  }
  records.sort((a, b) => a.id.localeCompare(b.id));
  const summary = {
    records: records.length,
    excludedWithReason: records.filter((record) => record.state === 'excluded-with-reason').length,
    upstreamSourceUnavailable: records.filter((record) => record.state === 'upstream-source-unavailable').length,
    functionInventoryRecords: 0,
    canonicalSourceAvailable: canonicalSourceAvailable === true,
  };
  return freeze({ schema: 'nolane.forensics.nolane_native-provisional-source-inventory.v1', expectedArchiveSha256, records, summary });
}
