import { deepFreeze, requireSha256, signed } from '../superiority-utils.mjs';

const REQUIRED_BREAKPOINTS = [640, 900, 1180, 1440];
const REQUIRED_SEMANTICS = ['landmarks', 'keyboardNavigation', 'focusVisible', 'liveRegions', 'reducedMotion', 'zoom200', 'labels'];

export class LocalUICertificationLab {
  certify(input = {}) {
    const sourceHash = requireSha256(input.sourceHash, 'sourceHash');
    const breakpoints = [...new Set((Array.isArray(input.breakpoints) ? input.breakpoints : []).map(Number))].sort((a, b) => a - b);
    if (!REQUIRED_BREAKPOINTS.every((value) => breakpoints.includes(value))) throw new Error('Required responsive breakpoints are missing');
    const semantics = input.semantics ?? {};
    const missingSemantics = REQUIRED_SEMANTICS.filter((key) => semantics[key] !== true);
    if (missingSemantics.length) throw new Error(`Required accessibility semantics missing: ${missingSemantics.join(', ')}`);
    const budgets = input.budgets ?? {}; const metrics = input.metrics ?? {};
    const budgetPairs = [
      ['maxDomNodes', 'domNodes'], ['maxRssBytes', 'rssBytes'], ['maxIdleCpuPercent', 'idleCpuPercent'], ['maxLongTaskMs', 'longestTaskMs'], ['maxInputLatencyMs', 'inputLatencyMs'],
    ];
    for (const [budgetKey, metricKey] of budgetPairs) if (!(Number(budgets[budgetKey]) > 0) || !(Number(metrics[metricKey]) >= 0)) throw new Error(`UI budget or metric missing: ${budgetKey}/${metricKey}`);
    const budgetResults = budgetPairs.map(([budgetKey, metricKey]) => deepFreeze({ budgetKey, metricKey, budget: Number(budgets[budgetKey]), observed: Number(metrics[metricKey]), pass: Number(metrics[metricKey]) <= Number(budgets[budgetKey]) }));
    const visualHashes = (Array.isArray(input.visualHashes) ? input.visualHashes : []).map((hash) => requireSha256(hash, 'visualHash'));
    if (visualHashes.length < REQUIRED_BREAKPOINTS.length) throw new Error('Visual baseline hashes missing for responsive breakpoints');
    const localPerformanceBudgetsPassed = budgetResults.every((item) => item.pass);
    return signed({
      schema: 'nolane.superiority.local-ui-certification.v1', sourceHash, breakpoints, semantics: deepFreeze({ ...semantics }), budgetResults, visualHashes,
      localAccessibilityImplemented: true, localResponsiveImplemented: true, localPerformanceBudgetsPassed,
      windowsCertificationRequired: true, assistiveTechnologyCertificationRequired: true, machineLabelled8GbBaselineRequired: true,
      requirementProjection: deepFreeze({ 'NOL-UI-002': 'external_gate', 'NOL-UI-030': 'external_gate', 'NOL-UI-031': 'external_gate', 'NOL-UI-032': 'external_gate' }),
      claims: { wcag22AaCertified: false, windowsCertified: false, narratorNvdaCertified: false, localImplementationVerified: localPerformanceBudgetsPassed },
    });
  }

  snapshot() { return signed({ schema: 'nolane.superiority.local-ui-certification-lab.v1', requiredBreakpoints: REQUIRED_BREAKPOINTS, requiredSemantics: REQUIRED_SEMANTICS, claims: { windowsCertified: false, wcag22AaCertified: false } }); }
}
