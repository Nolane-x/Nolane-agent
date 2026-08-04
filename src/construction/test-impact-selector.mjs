import { signed, strings, text } from './construction-utils.mjs';

export function selectVerificationStages({ changedSymbols = [], graphEdges = [], relatedTests = [], historicalFailures = [], risk = 'low', semanticFindings = [] } = {}) {
  const symbols = strings(changedSymbols, 'changedSymbols', 10_000, 512);
  const riskLevel = text(risk, 'risk', 64);
  const directlyRelated = new Set();
  const impacted = new Set(symbols);
  for (const edge of graphEdges ?? []) if (symbols.includes(String(edge.from ?? '')) || symbols.includes(String(edge.to ?? ''))) { impacted.add(String(edge.from ?? '')); impacted.add(String(edge.to ?? '')); }
  for (const testItem of relatedTests ?? []) if ((testItem.symbolIds ?? []).some((id) => impacted.has(String(id)))) directlyRelated.add(String(testItem.testId));
  const stages = [{ kind: 'syntax-type', testIds: [], reasons: ['changed-source'] }];
  if (directlyRelated.size) stages.push({ kind: 'targeted', testIds: [...directlyRelated].sort(), reasons: ['direct-symbol-impact'] });
  if (impacted.size > symbols.length || directlyRelated.size > 1) stages.push({ kind: 'module', testIds: [], reasons: ['dependent-symbol-impact'] });
  const findingKinds = new Set((semanticFindings ?? []).map((item) => String(item.kind ?? item)));
  const wide = riskLevel === 'high' || riskLevel === 'critical' || ['breaking-public-api', 'schema-change', 'dependency-change'].some((kind) => findingKinds.has(kind));
  if (wide) stages.push({ kind: 'integration', testIds: [], reasons: ['wide-semantic-impact'] });
  if (findingKinds.has('permission-expansion') || findingKinds.has('security-critical-scope')) stages.push({ kind: 'security', testIds: [], reasons: ['security-impact'] });
  if (['breaking-public-api', 'schema-change', 'test-integrity-weakened'].some((kind) => findingKinds.has(kind))) stages.push({ kind: 'mutation-probe', testIds: [], reasons: ['test-strength-required'] });
  if (wide || historicalFailures.length) stages.push({ kind: 'full-suite', testIds: strings(historicalFailures, 'historicalFailures', 1_000, 512), reasons: historicalFailures.length ? ['historical-regression-risk'] : ['high-risk-change'] });
  return signed({ schema: 'forge.test-impact-selection.v1', changedSymbols: symbols, impactedSymbols: [...impacted].sort(), stages, claims: { commandsExecuted: false, fullSuiteAlwaysRequired: false } });
}
