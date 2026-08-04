function clone(value) { return structuredClone(value); }
function unique(values) { return [...new Set(values.filter(Boolean).map(String))].sort(); }

const BROAD = new Set([
  'tests/agent-loop.test.mjs',
  'tests/mission-runner.test.mjs',
  'tests/tool-broker.test.mjs',
  'tests/terminal-manager.test.mjs',
]);

const BINDINGS = Object.freeze({
  guardrail: Object.freeze({
    testPath: 'tests/agent-runtime-guardrail-contracts.test.mjs',
    positiveTestNames: Object.freeze(['agent runtime allows scoped reversible actions with explicit policy']),
    negativeTestNames: Object.freeze(['agent runtime rejects scope expansion and unsupported self-certification']),
  }),
  budget: Object.freeze({
    testPath: 'tests/agent-runtime-budget-recovery-contracts.test.mjs',
    positiveTestNames: Object.freeze(['run budget records bounded turns tools tokens and elapsed time']),
    negativeTestNames: Object.freeze(['run budget rejects cancellation and exhausted limits']),
  }),
  context: Object.freeze({
    testPath: 'tests/agent-runtime-context-tool-contracts.test.mjs',
    positiveTestNames: Object.freeze(['context builder emits structured execution instructions and closed tool schemas']),
    negativeTestNames: Object.freeze(['context builder rejects missing compiled context and tool schemas reject shell-string ambiguity']),
  }),
  mission: Object.freeze({
    testPath: 'tests/mission-runtime-state-verification-contracts.test.mjs',
    positiveTestNames: Object.freeze(['mission runner creates reviewer-gated tasks and records candidate review state']),
    negativeTestNames: Object.freeze(['mission runner rejects unsafe plans and marks failed work without false completion']),
  }),
  command: Object.freeze({
    testPath: 'tests/execution-command-governance-contracts.test.mjs',
    positiveTestNames: Object.freeze(['command governance allows reversible local development operations']),
    negativeTestNames: Object.freeze(['command governance rejects or requires approval for dangerous external operations']),
  }),
  secret: Object.freeze({
    testPath: 'tests/execution-secret-boundary-contracts.test.mjs',
    positiveTestNames: Object.freeze(['secret redaction removes nested credentials without mutating safe values']),
    negativeTestNames: Object.freeze(['workspace boundary rejects traversal and symlink escape before secret-bearing files are read']),
  }),
  process: Object.freeze({
    testPath: 'tests/execution-process-lifecycle-contracts.test.mjs',
    positiveTestNames: Object.freeze(['process lifecycle returns stdout stderr exit code duration and bounded stdin']),
    negativeTestNames: Object.freeze(['process lifecycle rejects non-allowlisted commands and kills timeouts']),
  }),
  terminal: Object.freeze({
    testPath: 'tests/terminal-lifecycle-governance-contracts.test.mjs',
    positiveTestNames: Object.freeze(['terminal lifecycle isolates project ownership and releases sandbox leases']),
    negativeTestNames: Object.freeze(['terminal lifecycle rejects unknown projects disallowed shells and missing attachable PIDs']),
  }),
});

function category(requirement) {
  const title = String(requirement?.title ?? '').toLowerCase();
  const paths = new Set(requirement?.acceptance?.testPaths ?? []);
  const executionFamily = paths.has('tests/tool-broker.test.mjs') || paths.has('tests/terminal-manager.test.mjs');
  if (executionFamily) {
    if (/terminal|\btui\b|\bpty\b|pid|shell|sandbox lease|terminal and tui lifecycle/i.test(title)) return 'terminal';
    if (/stdout|stderr|exit code|thời gian chạy|timeout|hủy tiến trình|orphan|process con|stdin|streaming output|không chạy tiến trình vô hạn/i.test(title)) return 'process';
    if (/secret|credential|api key|token phạm vi|token tồn tại|rotation|mask|ẩn secret|lộ|ssh agent|docker socket|upload|exfiltration|biến môi trường tạm|phân quyền secret/i.test(title)) return 'secret';
    return 'command';
  }
  if (/budget|giới hạn token|giới hạn lượt|giới hạn thời gian|vòng lặp vô hạn|vòng lặp tool|chi phí|gián đoạn|cancel/i.test(title)) return 'budget';
  if (/guardrail|quyền|phạm vi|scope|prompt injection|secret exfiltration|audit log|command injection|file hệ thống|phê duyệt|tự tăng quyền|nguy hiểm|hoàn tác|ngoài task|kiểm chứng/i.test(title)) return 'guardrail';
  if (/context|repository|codebase|file liên quan|hướng dẫn|schema|tool|model|streaming|yêu cầu người dùng|nhận task|stack trace|phân tích log|output không đúng schema/i.test(title)) return 'context';
  return 'mission';
}

export function migrateCheckpoint5RequirementEvidence(requirement = {}) {
  const value = clone(requirement);
  value.acceptance ??= {};
  const originalPaths = Array.isArray(value.acceptance.testPaths) ? value.acceptance.testPaths.map(String) : [];
  const broadPaths = originalPaths.filter((item) => BROAD.has(item));
  if (broadPaths.length === 0 || (Array.isArray(value.acceptance.assertionBindings) && value.acceptance.assertionBindings.length > 0)) return value;
  const binding = BINDINGS[category(value)];
  const remaining = originalPaths.filter((item) => !BROAD.has(item));
  value.acceptance.testPaths = unique([...remaining, binding.testPath]);
  value.acceptance.assertionBindings = [{
    schema: 'nolane.forensics.requirement-assertion-binding-input.v1',
    testPath: binding.testPath,
    positiveTestNames: [...binding.positiveTestNames],
    negativeTestNames: [...binding.negativeTestNames],
  }];
  const aliases = broadPaths.map((from) => ({ kind: 'test', from, to: binding.testPath, reason: 'checkpoint-5-explicit-assertion-binding' }));
  value.acceptance.historicalEvidenceAliases = [...(value.acceptance.historicalEvidenceAliases ?? []), ...aliases]
    .sort((a, b) => `${a.kind}:${a.from}:${a.to ?? ''}`.localeCompare(`${b.kind}:${b.from}:${b.to ?? ''}`));
  value.metadata ??= {};
  value.metadata.checkpoint5EvidenceFamily = category(value);
  value.metadata.evidencePathMigrationCount = value.acceptance.historicalEvidenceAliases.length;
  return value;
}

export function migrateCheckpoint5LedgerEvidence(ledger = {}) {
  const value = clone(ledger);
  const before = new Set((value.requirements ?? []).map((item) => String(item.id)));
  let migratedRequirements = 0;
  value.requirements = (value.requirements ?? []).map((item) => {
    const next = migrateCheckpoint5RequirementEvidence(item);
    if (next.metadata?.checkpoint5EvidenceFamily && !item.metadata?.checkpoint5EvidenceFamily) migratedRequirements += 1;
    return next;
  });
  const after = new Set(value.requirements.map((item) => String(item.id)));
  const inventedRequirementIds = [...after].filter((id) => !before.has(id)).length;
  value.metadata ??= {};
  value.metadata.checkpoint5EvidenceMigration = { schema: 'nolane.forensics.checkpoint-5-evidence-migration.v1', migratedRequirements, inventedRequirementIds };
  return value;
}

export { BINDINGS as CHECKPOINT5_ASSERTION_BINDINGS };
