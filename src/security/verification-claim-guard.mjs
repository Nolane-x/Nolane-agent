import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const CLAIMS = Object.freeze([
  ['test-success', /\b(?:all\s+)?tests?\s+(?:have\s+)?pass(?:ed)?\b|\b\d+\s*\/\s*\d+\s+tests?\s+pass(?:ed)?\b|(?:toàn bộ|tất cả)\s+(?:bài\s+)?test\s+(?:đã\s+)?(?:pass|đạt)/i],
  ['completion', /\b(?:the\s+)?(?:implementation|task|work|feature)\s+(?:is\s+|has\s+been\s+)?(?:complete|completed|finished)\b|\b(?:đã\s+)?(?:hoàn thành|hoàn tất)\b/i],
  ['fix', /\b(?:the\s+)?bug\s+(?:is\s+|has\s+been\s+)?fixed\b|\b(?:đã\s+)?sửa(?:\s+xong)?\s+lỗi\b/i],
  ['build-success', /\bbuild\s+(?:has\s+)?(?:passed|succeeded|successful)\b|\bbuild\s+(?:đã\s+)?(?:pass|thành công)\b/i],
]);

function freeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) freeze(child, seen);
  return Object.freeze(value);
}

function commands(activity) { return Array.isArray(activity?.commandsRun) ? activity.commandsRun : []; }
function hasSuccessfulCommand(activity, pattern) {
  return commands(activity).some((entry) => Number(entry.exitCode) === 0 && pattern.test([entry.command, ...(entry.args ?? [])].join(' ')));
}
function passingReceipts(receipts) { return (Array.isArray(receipts) ? receipts : []).filter((receipt) => receipt?.status === 'pass' && /^[a-f0-9]{64}$/.test(String(receipt?.receiptSha256 ?? ''))); }
function passingCriterionReceipts(receipts) {
  return (Array.isArray(receipts) ? receipts : []).filter((receipt) => {
    if (receipt?.schema !== 'forge.acceptance-criterion-verification.v1' || receipt?.status !== 'pass') return false;
    const claimed = String(receipt.receiptSha256 ?? '').toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(claimed)) return false;
    const { receiptSha256: _ignored, ...unsigned } = receipt;
    return canonicalSha256(unsigned) === claimed && /^[a-f0-9]{64}$/.test(String(receipt.sourceHash ?? '')) && /^[a-f0-9]{40,64}$/.test(String(receipt.commit ?? '')) && /^[a-f0-9]{64}$/.test(String(receipt.artifactSha256 ?? ''));
  });
}
function errorDisclosed(output, error) {
  const message = String(error?.message ?? '').trim();
  if (!message) return true;
  const significant = message.length > 120 ? message.slice(0, 120) : message;
  return String(output).toLowerCase().includes(significant.toLowerCase());
}

export class VerificationClaimGuard {
  assess({ output = '', receipts = [], activity = {}, requiredCriterionIds = [] } = {}) {
    const originalOutput = String(output ?? '');
    const claims = CLAIMS.filter(([, pattern]) => pattern.test(originalOutput)).map(([id]) => id);
    const passReceipts = passingReceipts(receipts);
    const requiredCriteria = [...new Set((Array.isArray(requiredCriterionIds) ? requiredCriterionIds : []).map(String).filter(Boolean))].sort();
    const verifiedCriterionIds = [...new Set(passingCriterionReceipts(receipts).map((receipt) => String(receipt.criterionId)))].sort();
    const verifiedCriterionSet = new Set(verifiedCriterionIds);
    const unverifiedCriterionIds = requiredCriteria.filter((id) => !verifiedCriterionSet.has(id));
    const criteriaSatisfied = unverifiedCriterionIds.length === 0;
    const errors = Array.isArray(activity?.errors) ? activity.errors : [];
    const failedSteps = (Array.isArray(activity?.stepResults) ? activity.stepResults : []).filter((step) => ['fail', 'failed', 'error', 'timeout'].includes(String(step?.status ?? '').toLowerCase()));
    const testPass = hasSuccessfulCommand(activity, /(?:^|\s)(?:test|pytest|vitest|jest|go\s+test|cargo\s+test)(?:\s|$)/i) && passReceipts.length > 0;
    const buildPass = hasSuccessfulCommand(activity, /(?:^|\s)(?:build|compile|typecheck)(?:\s|$)/i) && passReceipts.length > 0;
    const clean = errors.length === 0 && failedSteps.length === 0;
    const changed = Array.isArray(activity?.filesWritten) && activity.filesWritten.length > 0;
    const support = {
      'test-success': testPass,
      'build-success': buildPass,
      completion: clean && passReceipts.length > 0 && criteriaSatisfied,
      fix: clean && changed && testPass && criteriaSatisfied,
    };
    const unsupportedClaims = claims.filter((claim) => support[claim] !== true);
    const undisclosedErrors = errors.filter((error) => !errorDisclosed(originalOutput, error));
    const warnings = [];
    if (unsupportedClaims.length) warnings.push(`UNVERIFIED CLAIMS: ${unsupportedClaims.join(', ')}`);
    if (undisclosedErrors.length) warnings.push(`UNDISCLOSED ERRORS: ${undisclosedErrors.map((error) => String(error.message ?? error)).join(' | ')}`);
    const safeOutput = warnings.length ? `[FORGE VERIFICATION GUARD]\n${warnings.join('\n')}\n\n${originalOutput}` : originalOutput;
    const status = unsupportedClaims.length || undisclosedErrors.length
      ? 'blocked-unverified-claims'
      : claims.length ? 'supported-candidate' : 'candidate';
    const base = {
      schema: 'forge.verification-claim-assessment.v1',
      status,
      originalOutput,
      safeOutput,
      claims,
      unsupportedClaims,
      undisclosedErrorCount: undisclosedErrors.length,
      evidenceReceiptSha256: passReceipts.map((receipt) => receipt.receiptSha256),
      verifiedCriterionIds,
      unverifiedCriterionIds,
    };
    return freeze({ ...base, assessmentSha256: canonicalSha256(base) });
  }
}
