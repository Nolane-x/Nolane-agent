import { migrateCheckpoint5LedgerEvidence } from './checkpoint-5-evidence-migration.mjs';
import { migrateCheckpoint6LedgerEvidence } from './checkpoint-6-evidence-migration.mjs';
function clone(value) { return structuredClone(value); }
function unique(values) { return [...new Set(values.filter(Boolean).map(String))].sort(); }

const DIRECT_TEST_MIGRATIONS = Object.freeze({
  'tests/storage.test.mjs': 'tests/studio-store-compatibility.test.mjs',
  'tests/planner.test.mjs': 'tests/mission-planner-compatibility.test.mjs',
  'tests/browser-agent.test.mjs': 'tests/browser-agent-service.test.mjs',
});
const SOURCE_AS_TEST = new Set([
  'src/verification/test-integrity-guard.mjs',
  'src/construction/test-impact-selector.mjs',
  'src/testing/test-engine.mjs',
]);
const PRODUCTION_MIGRATIONS = Object.freeze({
  'vendor/forge-os/src/context/work-unit-contexts.mjs': 'vendor/forge-os/src/context/work-unit-context.mjs',
  'vendor/forge-os/src/execution/execution-graph.mjs': 'vendor/forge-os/src/fabric/execution-graph.mjs',
});

const READ_SEARCH = /đọc|tìm|xếp hạng|vị trí|số dòng|output|kết quả|result|extension|ngôn ngữ/i;
const TRANSACTION = /rollback|hunk|base hash|checksum|unified|diff|phiên bản|context patch|một phần|bản sao/i;
function patchSuite(title) {
  if (READ_SEARCH.test(String(title))) return 'tests/patch-engine-read-search.test.mjs';
  if (TRANSACTION.test(String(title))) return 'tests/patch-engine-transaction.test.mjs';
  return 'tests/patch-engine-safety-write.test.mjs';
}

export function migrateMasterRequirementEvidence(requirement = {}) {
  const value = clone(requirement);
  value.acceptance ??= {};
  const aliases = [];
  const testPaths = [];
  for (const original of value.acceptance.testPaths ?? []) {
    if (original === 'tests/patch-engine.test.mjs') {
      const replacement = patchSuite(value.title);
      testPaths.push(replacement);
      aliases.push({ kind: 'test', from: original, to: replacement, reason: 'historical-patch-suite-partition' });
      continue;
    }
    if (SOURCE_AS_TEST.has(original)) {
      aliases.push({ kind: 'test', from: original, to: null, reason: 'source-module-was-not-a-test' });
      continue;
    }
    const replacement = DIRECT_TEST_MIGRATIONS[original];
    if (replacement) {
      testPaths.push(replacement);
      aliases.push({ kind: 'test', from: original, to: replacement, reason: 'historical-test-path-migration' });
    } else testPaths.push(original);
  }
  const productionEntryPoints = [];
  for (const original of value.acceptance.productionEntryPoints ?? []) {
    const replacement = PRODUCTION_MIGRATIONS[original];
    if (replacement) {
      productionEntryPoints.push(replacement);
      aliases.push({ kind: 'production', from: original, to: replacement, reason: 'historical-production-path-migration' });
    } else productionEntryPoints.push(original);
  }
  value.acceptance.testPaths = unique(testPaths);
  value.acceptance.productionEntryPoints = unique(productionEntryPoints);
  value.acceptance.productionEntrypoint = value.acceptance.productionEntryPoints[0] ?? null;
  value.acceptance.historicalEvidenceAliases = [...(value.acceptance.historicalEvidenceAliases ?? []), ...aliases]
    .sort((a, b) => `${a.kind}:${a.from}`.localeCompare(`${b.kind}:${b.from}`));
  value.metadata ??= {};
  value.metadata.evidencePathMigrationCount = value.acceptance.historicalEvidenceAliases.length;
  return value;
}

export function migrateMasterLedgerEvidence(ledger = {}) {
  const value = clone(ledger);
  value.requirements = (value.requirements ?? []).map(migrateMasterRequirementEvidence);
  return migrateCheckpoint6LedgerEvidence(migrateCheckpoint5LedgerEvidence(value));
}
