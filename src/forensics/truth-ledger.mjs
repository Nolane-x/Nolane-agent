const STATUSES = new Set(['exact', 'superset', 'partial', 'absent', 'excluded-with-reason', 'external-unverified', 'upstream-source-unavailable']);
const RESOLVED = new Set(['exact', 'superset', 'excluded-with-reason']);

function freeze(value) {
  if (value && typeof value === 'object' && Object.isFrozen(value)) return value;
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) value[key] = freeze(entry);
    return Object.freeze(value);
  }
  return value;
}

function strings(value, name) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.length === 0)) throw new TypeError(`${name} must be an array of non-empty strings`);
  return [...new Set(value)].sort();
}

export function validateTruthLedgerRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new TypeError('Truth ledger record is required');
  if (typeof record.id !== 'string' || !/^mapping-[a-f0-9]{24}$/.test(record.id)) throw new TypeError('Truth ledger mapping id is invalid');
  if (typeof record.upstreamId !== 'string' || record.upstreamId.length === 0) throw new TypeError('Truth ledger upstreamId is required');
  if (!STATUSES.has(record.status)) throw new TypeError(`Unsupported truth ledger status: ${record.status}`);
  const nolaneSymbolIds = strings(record.nolaneSymbolIds ?? [], 'nolaneSymbolIds');
  const productionWiring = strings(record.productionWiring ?? [], 'productionWiring');
  const positiveAssertions = strings(record.positiveAssertions ?? [], 'positiveAssertions');
  const negativeAssertions = strings(record.negativeAssertions ?? [], 'negativeAssertions');
  const compatibilityEvidence = strings(record.compatibilityEvidence ?? [], 'compatibilityEvidence');
  const candidateNolaneFileIds = strings(record.candidateNolaneFileIds ?? [], 'candidateNolaneFileIds');
  const failureBranches = Number(record.failureBranches ?? 0);
  if (!Number.isSafeInteger(failureBranches) || failureBranches < 0) throw new TypeError('failureBranches must be a non-negative integer');

  if (record.status === 'exact' || record.status === 'superset') {
    if (record.upstreamSourceAvailability !== 'verified') throw new Error('Exact or superset mapping requires canonical upstream source verification');
    if (typeof record.upstreamSymbolId !== 'string' || record.upstreamSymbolId.length === 0) throw new Error('Exact or superset mapping requires an upstream symbol ID');
    if (nolaneSymbolIds.length === 0) throw new Error('Exact or superset mapping requires Nolane symbol IDs');
    if (productionWiring.length === 0) throw new Error('Exact or superset mapping requires production wiring');
    if (positiveAssertions.length === 0) throw new Error('Exact or superset mapping requires a positive assertion');
    if (failureBranches > 0 && negativeAssertions.length === 0) throw new Error('Failure-bearing mapping requires a negative assertion');
    if (record.status === 'superset' && compatibilityEvidence.length === 0) throw new Error('Superset mapping requires compatibility evidence');
  }

  if (record.status === 'excluded-with-reason') {
    if (!record.exclusion || typeof record.exclusion !== 'object') throw new Error('Excluded mapping requires exclusion metadata');
    if (typeof record.exclusion.category !== 'string' || record.exclusion.category.trim() === '') throw new Error('Excluded mapping requires an exclusion category');
    if (typeof record.exclusion.reason !== 'string' || record.exclusion.reason.trim() === '') throw new Error('Excluded mapping requires an exclusion reason');
  }

  if (record.status === 'upstream-source-unavailable' && record.upstreamSourceAvailability !== 'source-bytes-unavailable') {
    throw new Error('upstream-source-unavailable requires source-bytes-unavailable availability');
  }

  return freeze({
    schema: 'nolane.forensics.truth-ledger-record.v1',
    ...record,
    nolaneSymbolIds,
    productionWiring,
    positiveAssertions,
    negativeAssertions,
    compatibilityEvidence,
    candidateNolaneFileIds,
    failureBranches,
    exclusion: record.exclusion ? { category: record.exclusion.category.trim(), reason: record.exclusion.reason.trim() } : null,
  });
}

export function summarizeTruthLedger(records) {
  if (!Array.isArray(records)) throw new TypeError('Truth ledger records must be an array');
  const validated = records.map(validateTruthLedgerRecord);
  const seen = new Set();
  for (const record of validated) {
    if (seen.has(record.upstreamId)) throw new Error(`Duplicate upstream ownership: ${record.upstreamId}`);
    seen.add(record.upstreamId);
  }
  const byStatus = Object.fromEntries([...STATUSES].sort().map((status) => [status, validated.filter((record) => record.status === status).length]));
  const resolved = validated.filter((record) => RESOLVED.has(record.status)).length;
  const unresolved = validated.length - resolved;
  const blockers = validated.filter((record) => !RESOLVED.has(record.status)).map((record) => ({ upstreamId: record.upstreamId, status: record.status }));
  return freeze({
    schema: 'nolane.forensics.truth-ledger-summary.v1',
    total: validated.length,
    resolved,
    unresolved,
    byStatus,
    completeParityEligible: validated.length > 0 && unresolved === 0,
    blockersTotal: blockers.length,
    blockerSample: blockers.slice(0, 50),
  });
}
