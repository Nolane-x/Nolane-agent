import { signed, text } from '../construction/construction-utils.mjs';

const PROTECTED = [
  /^src\/security\//,
  /^src\/release\//,
  /^scripts\/(?:verify|generate-frontier|package-release|run-full-release)/,
  /^docs\/(?:feature-audit|LIMITATIONS|VERIFICATION-REPORT|REMAINING-GAPS)/,
  /(?:capability|policy|verifier|audit|guardrail)/i,
];

export class ProtectedBoundaryGuard {
  authorizeChange({ paths = [], actor = {}, overrideReceipt = null } = {}) {
    if (!Array.isArray(paths) || !paths.length) throw new TypeError('paths are required');
    const normalized = [...new Set(paths.map((item) => text(item, 'path', 2048).replaceAll('\\', '/')))].sort();
    const protectedPaths = normalized.filter((candidate) => PROTECTED.some((rule) => rule.test(candidate)));
    const humanOverride = actor.type === 'human' && overrideReceipt?.status === 'approved' && /^[a-f0-9]{64}$/i.test(String(overrideReceipt.receiptSha256 ?? ''));
    return signed({
      schema: 'forge.protected-boundary-decision.v1',
      actor: { id: text(actor.id, 'actor.id', 512), type: text(actor.type, 'actor.type', 64) },
      paths: normalized,
      protectedPaths,
      allowed: protectedPaths.length === 0 || humanOverride,
      reasons: protectedPaths.length === 0 ? [] : humanOverride ? ['human-override-approved'] : ['protected-boundary-human-override-required'],
      overrideReceiptSha256: humanOverride ? overrideReceipt.receiptSha256 : null,
    });
  }
}
