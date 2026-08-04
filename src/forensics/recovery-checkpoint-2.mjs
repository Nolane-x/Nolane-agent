import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
const SHA256 = /^[a-f0-9]{64}$/;
const PROTECTED = ['completeParityClaimAllowed','comparativeSuperiorityClaimAllowed','windowsUiCertified','providerRealCertified'];
function object(value, label) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} is required`); return value; }
export function verifyForensicRecoveryCheckpoint2(input = {}) {
  const custody = object(input.custody, 'Source custody');
  const symbolInventory = object(input.symbolInventory, 'Symbol inventory');
  const truthLedger = object(input.truthLedger, 'Truth ledger');
  const assertionBaseline = object(input.assertionBaseline, 'Assertion baseline');
  const uiAudit = object(input.uiAudit, 'UI audit');
  const uiRelease = object(input.uiRelease, 'UI release');
  const claims = object(input.claims, 'Recovery claims');
  if (!custody.records?.some((item) => item.id === 'nolane-native-canonical' && item.status !== 'verified')) throw new Error('Checkpoint 2 requires missing canonical NolaneNative source to remain explicit');
  if (!Number.isSafeInteger(symbolInventory.files) || symbolInventory.files < 1 || !Number.isSafeInteger(symbolInventory.symbols) || symbolInventory.symbols < 1 || symbolInventory.parseFailures !== 0 || !SHA256.test(symbolInventory.inventorySha256 ?? '')) throw new Error('Symbol inventory is incomplete');
  if (truthLedger.completeParityEligible !== false || Number(truthLedger.unresolved) < 1) throw new Error('Truth ledger must retain unresolved NolaneNative records');
  const evidence = assertionBaseline.coverage?.summary;
  if (!evidence || evidence.requirementsTotal !== 48 || evidence.requirementsBound < 1 || evidence.requirementsUnbound < 0 || evidence.requirementsBound + evidence.requirementsUnbound !== evidence.requirementsTotal || evidence.requirementsPositiveBound !== evidence.requirementsBound || evidence.requirementsNegativeBound !== evidence.requirementsBound || evidence.overBroadTestFiles !== 0 || !SHA256.test(assertionBaseline.receiptSha256 ?? '')) throw new Error('Assertion evidence baseline is invalid or over-claimed');
  if (uiAudit.defaultUiVersion !== 'v3' || uiAudit.sourceLocalComplete !== true || uiAudit.summary?.implemented !== 18 || uiAudit.summary?.partial !== 0 || uiAudit.summary?.missing !== 0) throw new Error('UI v3 source-local implementation is incomplete');
  if (uiAudit.complete !== false || uiAudit.summary?.externalCertification !== 1) throw new Error('UI external certification must remain pending');
  if (uiRelease.sourceLocalPass !== true || uiRelease.uiV3SourceLocalComplete !== true || uiRelease.missingModules !== 0 || !SHA256.test(uiRelease.receiptSha256 ?? '')) throw new Error('UI source release receipt is invalid');
  if (uiRelease.windows8GbCertified !== false || uiRelease.screenReaderCertified !== false || uiRelease.externalScreenshotCertified !== false) throw new Error('External certification may not be synthesized');
  for (const claim of PROTECTED) if (claims[claim] !== false) throw new Error(`Protected claim must remain false: ${claim}`);
  if (claims.uiV3SourceLocalComplete !== true || claims.uiV3Complete !== false) throw new Error('Recovery claim policy must distinguish source-local UI from external completion');
  const base = {
    schema: 'nolane.forensics.recovery-checkpoint-2-verification.v1', status: 'pass',
    uiV3SourceLocalComplete: true, uiV3BetaDefaultVerified: true, uiV3ExternallyCertified: false,
    functionLevelNolaneNativeParityVerified: false,
    assertionEvidenceReconstructionComplete: assertionBaseline.coverage.certifiable === true,
    assertionEvidence: { total: evidence.requirementsTotal, bound: evidence.requirementsBound, unbound: evidence.requirementsUnbound, positiveBound: evidence.requirementsPositiveBound, negativeBound: evidence.requirementsNegativeBound },
    symbolInventory: { files: symbolInventory.files, symbols: symbolInventory.symbols, surfaces: symbolInventory.surfaces, parseFailures: symbolInventory.parseFailures, inventorySha256: symbolInventory.inventorySha256 },
    nolane_nativeTruth: { total: truthLedger.total, resolved: truthLedger.resolved, unresolved: truthLedger.unresolved },
    externalBlockers: ['canonical-nolane-native-source-bytes','provider-real-certification','windows-8gb-performance','screen-reader-certification','visual-screenshot-certification'],
    claims: Object.fromEntries(PROTECTED.map((claim) => [claim, false])),
  };
  return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
}
