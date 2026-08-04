import { boundedNumber, signed, strings, text } from './construction-utils.mjs';

function finding(kind, severity, score, evidence = []) { return { kind, severity, score, evidence: [...evidence] }; }

export function analyzeSemanticPatch(input = {}) {
  const taskKind = text(input.taskKind ?? 'unknown', 'taskKind', 128);
  const changedFiles = Math.floor(boundedNumber(input.changedFiles, 0, 0, 100_000, 'changedFiles'));
  const changedLines = Math.floor(boundedNumber(input.changedLines, 0, 0, 1_000_000, 'changedLines'));
  const changedSymbols = strings(input.changedSymbols ?? [], 'changedSymbols', 10_000, 512);
  const findings = [];
  let score = Math.min(20, changedFiles * 1.5) + Math.min(15, changedLines / 20) + Math.min(20, changedSymbols.length * 2);

  for (const change of input.publicApiChanges ?? []) {
    if (change?.compatibility === 'breaking') { findings.push(finding('breaking-public-api', 'critical', 35, [String(change.symbolId ?? '')])); score += 35; }
    else { findings.push(finding('public-api-change', 'high', 15, [String(change?.symbolId ?? '')])); score += 15; }
  }
  const schemaChanges = Array.isArray(input.schemaChanges) ? input.schemaChanges : [];
  if (schemaChanges.length) { findings.push(finding('schema-change', 'high', 20, schemaChanges.map(String))); score += 20 + Math.min(10, schemaChanges.length * 2); }
  const configChanges = Array.isArray(input.configChanges) ? input.configChanges : [];
  if (configChanges.length) { findings.push(finding('configuration-change', 'medium', 8, configChanges.map(String))); score += 8; }
  const dependencyChanges = Array.isArray(input.dependencyChanges) ? input.dependencyChanges : [];
  if (dependencyChanges.length) { findings.push(finding('dependency-change', 'high', 15, dependencyChanges.map(String))); score += 15; }
  const generatedPaths = strings(input.generatedPaths ?? [], 'generatedPaths', 2_000, 2_048);
  if (generatedPaths.length) { findings.push(finding('generated-source-edit', 'critical', 30, generatedPaths)); score += 30; }
  const weakenedTests = strings(input.weakenedTests ?? [], 'weakenedTests', 2_000, 2_048);
  if (weakenedTests.length) { findings.push(finding('test-integrity-weakened', 'critical', 30, weakenedTests)); score += 30; }
  const permissions = Array.isArray(input.permissionChanges) ? input.permissionChanges : [];
  if (permissions.length) { findings.push(finding('permission-expansion', 'critical', 30, permissions.map((item) => `${item.kind ?? 'unknown'}:${item.scope ?? 'unknown'}`))); score += 30; }
  const securityCriticalScopes = strings(input.securityCriticalScopes ?? [], 'securityCriticalScopes', 1_000, 2_048);
  if (securityCriticalScopes.length) { findings.push(finding('security-critical-scope', 'high', 18, securityCriticalScopes)); score += 18; }
  const controlFlowChanges = Math.floor(boundedNumber(input.controlFlowChanges, 0, 0, 100_000, 'controlFlowChanges'));
  if (controlFlowChanges) { findings.push(finding('control-flow-change', 'medium', Math.min(20, controlFlowChanges * 3), [String(controlFlowChanges)])); score += Math.min(20, controlFlowChanges * 3); }
  const callerCount = Math.floor(boundedNumber(input.callerCount, 0, 0, 100_000, 'callerCount'));
  score += Math.min(25, callerCount * 1.5);
  const revertedLines = Math.floor(boundedNumber(input.revertedLines, 0, 0, 1_000_000, 'revertedLines'));
  const correctionCycles = Math.floor(boundedNumber(input.correctionCycles, 0, 0, 10_000, 'correctionCycles'));
  const editCost = { changedLines, changedFiles, revertedLines, correctionCycles, total: changedLines + revertedLines + correctionCycles * 20 };
  const blockingFindings = findings.filter((item) => item.severity === 'critical').map((item) => item.kind);
  return signed({ schema: 'forge.semantic-patch-report.v1', taskKind, changedFiles, changedLines, changedSymbols, callerCount, semanticFootprint: Number(score.toFixed(3)), findings, blockingFindings, allowed: blockingFindings.length === 0, editCost, claims: { unknownRelationsGuessed: false, textualDiffUsedAsSoleRiskMetric: false } });
}
