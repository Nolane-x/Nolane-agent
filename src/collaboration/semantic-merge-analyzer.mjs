import { boundedNumber, signed, text } from '../construction/construction-utils.mjs';

function list(value, key) { return Object.freeze([...(value ?? [])].map((item) => typeof item === 'string' ? item : { ...item })); }
function finding(kind, severity, message, evidence, blocking = true) { return { kind, severity, message, evidence, blocking }; }

export class SemanticMergeAnalyzer {
  constructor({ blockingConfidence = 0.75 } = {}) { this.blockingConfidence = boundedNumber(blockingConfidence, 0.75, 0, 1, 'blockingConfidence'); }
  analyze({ candidates = [], graphEdges = [], apiContracts = [], testContracts = [] } = {}) {
    const normalized = candidates.map((candidate, index) => ({ candidateId: text(candidate.candidateId, `candidates[${index}].candidateId`, 256), changedFiles: list(candidate.changedFiles), changedSymbols: list(candidate.changedSymbols), apiAssumptions: list(candidate.apiAssumptions), logicFingerprints: list(candidate.logicFingerprints), behaviorContracts: list(candidate.behaviorContracts), verificationReceiptSha256: candidate.verificationReceiptSha256 ?? null }));
    const findings = [];
    for (let i = 0; i < normalized.length; i += 1) for (let j = i + 1; j < normalized.length; j += 1) {
      const left = normalized[i]; const right = normalized[j];
      const leftApis = new Map(left.apiAssumptions.map((a) => [String(a.apiId), a]));
      for (const assumption of right.apiAssumptions) { const other = leftApis.get(String(assumption.apiId)); if (other && (Number(other.revision) !== Number(assumption.revision) || String(other.signature) !== String(assumption.signature))) findings.push(finding('incompatible-api-assumption', 'critical', `${left.candidateId} and ${right.candidateId} assume incompatible ${assumption.apiId}`, { left: other, right: assumption, candidates: [left.candidateId, right.candidateId] })); }
      const fingerprints = new Set(left.logicFingerprints.map(String)); for (const fp of right.logicFingerprints.map(String)) if (fingerprints.has(fp)) findings.push(finding('duplicate-logic', 'high', `Candidates duplicate logic fingerprint ${fp}`, { fingerprint: fp, candidates: [left.candidateId, right.candidateId] }));
      const contracts = new Map(left.behaviorContracts.map((c) => [String(c.symbolId), c])); for (const contract of right.behaviorContracts) { const other = contracts.get(String(contract.symbolId)); if (other && String(other.effect) !== String(contract.effect)) findings.push(finding('behavior-conflict', 'critical', `Candidates disagree on behavior of ${contract.symbolId}`, { left: other, right: contract, candidates: [left.candidateId, right.candidateId] })); }
      const sharedSymbols = left.changedSymbols.filter((symbol) => right.changedSymbols.includes(symbol)); for (const symbol of sharedSymbols) findings.push(finding('shared-symbol-ownership', 'high', `Candidates modify the same symbol ${symbol}`, { symbol, candidates: [left.candidateId, right.candidateId] }));
    }
    for (const edge of graphEdges ?? []) {
      const confidence = boundedNumber(edge.confidence, 0.5, 0, 1, 'graph edge confidence');
      if (edge.ambiguous || confidence < this.blockingConfidence) findings.push(finding('ambiguous-dependency', 'medium', `Dependency ${edge.from} ${edge.relation} ${edge.to} is ambiguous`, { ...edge }, false));
    }
    for (const contract of apiContracts ?? []) if (contract?.compatible === false) findings.push(finding('api-contract-failure', 'critical', `API contract ${contract.apiId ?? '<unknown>'} is incompatible`, contract));
    for (const contract of testContracts ?? []) if (contract?.compatible === false) findings.push(finding('test-contract-conflict', 'high', `Test contract ${contract.testId ?? '<unknown>'} conflicts`, contract));
    const blocking = findings.filter((item) => item.blocking && ['high', 'critical'].includes(item.severity));
    const status = blocking.length ? 'blocked' : findings.length ? 'pass-with-review' : 'pass';
    return signed({ schema: 'forge.semantic-merge-analysis.v1', status, candidateIds: normalized.map((c) => c.candidateId), findings, blockingFindingCount: blocking.length, claims: { fullProgramEquivalenceProven: false, gitConflictRequiredForFinding: false, automaticMergeExecuted: false } });
  }
}
