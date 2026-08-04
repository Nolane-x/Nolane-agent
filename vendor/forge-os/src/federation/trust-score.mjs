const AUTHORITY_SCORE = { official:30, vendor:24, 'standards-body':28, local:30, community:8 };
export function calculateProviderTrust(input = {}) {
  const blockers = [...new Set(input.scan?.blockers ?? [])];
  if (blockers.length) return { score:0, blockers, reasons:['blocking security findings'] };
  let score = AUTHORITY_SCORE[input.source?.authority] ?? 0;
  const reasons = [];
  if (input.provenance?.pinned) { score += 18; reasons.push('source revision pinned'); }
  if (input.provenance?.signed) { score += 12; reasons.push('source signature verified'); }
  if (input.license?.mode === 'vendor-allowed' && !input.license?.ambiguous) { score += 10; reasons.push('redistribution license clear'); }
  else if (input.license?.mode === 'link-only') score += 3;
  if (input.evaluation?.status === 'pass') { score += Math.max(0, Math.min(20, Math.round((input.evaluation.qualityDelta ?? 0) * 100))); reasons.push('behavioral evaluation passed'); }
  if ((input.scan?.warnings?.length ?? 0) > 0) score -= Math.min(15, input.scan.warnings.length * 3);
  // Popularity is intentionally capped and cannot override trust blockers.
  score += Math.min(5, Math.log10(Math.max(1, input.popularity?.stars ?? 0)));
  return { score:Math.max(0,Math.min(100,Math.round(score))), blockers, reasons };
}
