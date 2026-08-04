import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const PROTECTED_CLAIMS = ['completeParityClaimAllowed', 'comparativeSuperiorityClaimAllowed', 'windowsUiCertified', 'providerRealCertified'];

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} is required`);
  return value;
}

export function verifyForensicRecoveryCheckpoint1(input = {}) {
  const custody = requireObject(input.custody, 'Source custody');
  const symbolInventory = requireObject(input.symbolInventory, 'Symbol inventory');
  const provisionalNolaneNative = requireObject(input.provisionalNolaneNative, 'Provisional NolaneNative inventory');
  const truthLedger = requireObject(input.truthLedger, 'Truth ledger');
  const evidenceAudit = requireObject(input.evidenceAudit, 'Evidence audit');
  const verifier = requireObject(input.verifier, 'Verifier receipt');
  const uiAudit = requireObject(input.uiAudit, 'UI v3 audit');
  const claims = requireObject(input.claims, 'Recovery claims');

  if (!Array.isArray(custody.records) || !custody.records.some((record) => record.id === 'nolane-native-canonical')) throw new Error('Source custody must identify canonical NolaneNative source');
  if (!Number.isSafeInteger(symbolInventory.files) || symbolInventory.files <= 0 || !Number.isSafeInteger(symbolInventory.symbols) || symbolInventory.symbols <= 0) throw new Error('Symbol inventory must contain production files and symbols');
  if (Number(symbolInventory.parseFailures) !== 0) throw new Error('Symbol inventory contains parse failures');
  if (!/^[a-f0-9]{64}$/.test(symbolInventory.inventorySha256 ?? '')) throw new Error('Symbol inventory must be content-addressed');
  if (!Number.isSafeInteger(provisionalNolaneNative.records) || provisionalNolaneNative.records <= 0) throw new Error('Provisional NolaneNative inventory must contain historical records');
  if (provisionalNolaneNative.functionInventoryRecords !== 0) throw new Error('Provisional path metadata may not masquerade as a function inventory');
  if (provisionalNolaneNative.canonicalSourceAvailable !== false) throw new Error('Checkpoint 1 expects canonical NolaneNative source availability to remain explicit');
  if (truthLedger.total !== provisionalNolaneNative.records) throw new Error('Truth ledger must account for every provisional NolaneNative record');
  if (truthLedger.completeParityEligible !== false || Number(truthLedger.unresolved) <= 0) throw new Error('Truth ledger must keep unresolved upstream evidence visible');
  if (!Number.isSafeInteger(evidenceAudit.verifiedRequirements) || !Array.isArray(evidenceAudit.violations)) throw new Error('Evidence audit is incomplete');
  if (verifier.failClosed !== true) throw new Error('Verifier receipt does not prove fail-closed behavior');
  if (verifier.status !== 'pass' || !Array.isArray(verifier.decisions) || verifier.decisions.some((decision) => decision.pass !== true)) throw new Error('Verifier fail-closed self-check did not pass');
  if (!uiAudit.summary || typeof uiAudit.complete !== 'boolean') throw new Error('UI v3 gap registry is incomplete');
  for (const claim of PROTECTED_CLAIMS) if (claims[claim] !== false) throw new Error(`Protected claim must remain false: ${claim}`);

  const base = {
    schema: 'nolane.forensics.recovery-checkpoint-1-verification.v1',
    status: 'pass',
    localRecoveryInfrastructureVerified: true,
    fullNolaneNativeParityVerified: false,
    comparativeSuperiorityVerified: false,
    uiV3Complete: uiAudit.complete === true,
    canonicalNolaneNativeSourceAvailable: false,
    symbolInventory: {
      files: symbolInventory.files,
      symbols: symbolInventory.symbols,
      surfaces: symbolInventory.surfaces,
      parseFailures: symbolInventory.parseFailures,
      inventorySha256: symbolInventory.inventorySha256,
    },
    nolane_nativeInventory: {
      provisionalPathRecords: provisionalNolaneNative.records,
      functionInventoryRecords: provisionalNolaneNative.functionInventoryRecords,
      resolvedTruthRecords: truthLedger.resolved,
      unresolvedTruthRecords: truthLedger.unresolved,
    },
    evidenceAudit: {
      certifiable: evidenceAudit.certifiable === true,
      verifiedRequirements: evidenceAudit.verifiedRequirements,
      violations: evidenceAudit.violations.length,
      overBroadEvidence: Array.isArray(evidenceAudit.overBroadEvidence) ? evidenceAudit.overBroadEvidence.length : 0,
    },
    uiAudit: {
      defaultUiVersion: uiAudit.defaultUiVersion,
      complete: uiAudit.complete,
      summary: uiAudit.summary,
    },
    claims: Object.fromEntries(PROTECTED_CLAIMS.map((claim) => [claim, false])),
  };
  return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
}
