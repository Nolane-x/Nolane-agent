const RESOLVED_TRUTH_STATES = new Set(['exact', 'superset', 'excluded-with-reason']);

function freeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) value[key] = freeze(entry);
    return Object.freeze(value);
  }
  return value;
}

function hasReceipt(receipts, type) {
  return receipts.some((receipt) => receipt?.type === type && receipt?.status === 'verified' && receipt?.independent === true && receipt?.fixture !== true);
}

export function evaluateRecoveryClaims({ custody = [], truthLedger = [], uiAudit = {}, externalReceipts = [] } = {}) {
  const blockers = [];
  const canonical = custody.find((record) => record?.id === 'nolane-native-canonical' || record?.kind === 'upstream-source');
  const canonicalVerified = canonical?.status === 'verified';
  if (!canonicalVerified) blockers.push('Canonical NolaneNative source bytes are not verified');

  const unresolvedTruth = truthLedger.filter((record) => !RESOLVED_TRUTH_STATES.has(record?.status));
  if (truthLedger.length === 0) blockers.push('Function-level truth ledger is empty');
  if (unresolvedTruth.length > 0) blockers.push(`${unresolvedTruth.length} truth-ledger records remain unresolved`);

  const uiV3SourceLocalComplete = uiAudit?.sourceLocalComplete === true && uiAudit?.defaultUiVersion === 'v3';
  const uiComplete = uiAudit?.complete === true && uiAudit?.defaultUiVersion === 'v3';
  if (!uiV3SourceLocalComplete) blockers.push('UI v3 source-local implementation or default switch is incomplete');
  else if (!uiComplete) blockers.push('External UI certification is still pending');

  const windowsUiCertified = hasReceipt(externalReceipts, 'windows-ui-certification');
  const providerRealCertified = hasReceipt(externalReceipts, 'provider-real-certification');
  const comparativeBenchmarkCertified = hasReceipt(externalReceipts, 'comparative-benchmark');
  if (!windowsUiCertified) blockers.push('Real Windows UI certification receipt is missing');
  if (!providerRealCertified) blockers.push('Provider-real certification receipt is missing');
  if (!comparativeBenchmarkCertified) blockers.push('Independent same-budget comparative benchmark receipt is missing');

  const completeParityClaimAllowed = canonicalVerified && truthLedger.length > 0 && unresolvedTruth.length === 0 && providerRealCertified && windowsUiCertified;
  const comparativeSuperiorityClaimAllowed = completeParityClaimAllowed && comparativeBenchmarkCertified;

  return freeze({
    schema: 'nolane.forensics.recovery-claim-policy.v1',
    completeParityClaimAllowed,
    comparativeSuperiorityClaimAllowed,
    windowsUiCertified,
    providerRealCertified,
    localArchitectureDepthVerified: false,
    allOriginalGoalsComplete: false,
    uiV3SourceLocalComplete,
    uiV3Complete: uiComplete,
    smallModelSuperintelligenceImplemented: false,
    blockers,
  });
}
