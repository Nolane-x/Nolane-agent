function clone(value) { return structuredClone(value); }
function unique(values) { return [...new Set(values.filter(Boolean).map(String))].sort(); }
function normalizedPaths(requirement) {
  return unique(requirement?.acceptance?.productionEntryPoints ?? requirement?.acceptance?.productionEntrypoint ?? []);
}
function isExternal(requirement) {
  return /external/i.test(String(requirement?.status ?? ''))
    || (requirement?.acceptance?.externalConditions?.length ?? 0) > 0
    || Boolean(requirement?.acceptance?.externalCondition);
}

const BINDINGS = Object.freeze({
  'local-frontier': Object.freeze({
    testPath: 'tests/local-frontier-completion-contracts.test.mjs',
    positiveTestNames: Object.freeze(['local frontier completion contract lazily exposes bounded runtimes with content receipts']),
    negativeTestNames: Object.freeze(['local frontier completion contract rejects use after close and keeps competitor claims locked']),
  }),
  capability: Object.freeze({
    testPath: 'tests/capability-governance-contracts.test.mjs',
    positiveTestNames: Object.freeze(['capability governance contract normalizes permissions and authorizes only scoped grants']),
    negativeTestNames: Object.freeze(['capability governance contract rejects unknown permissions delegation escalation and deny overrides']),
  }),
  'repository-discovery': Object.freeze({
    testPath: 'tests/repository-discovery-contracts.test.mjs',
    positiveTestNames: Object.freeze(['repository discovery contract enumerates bounded files without following symlinks']),
    negativeTestNames: Object.freeze(['repository discovery contract rejects missing roots and enforces file budgets']),
  }),
  'cloud-recovery': Object.freeze({
    testPath: 'tests/cloud-recovery-contracts.test.mjs',
    positiveTestNames: Object.freeze(['cloud recovery contract fences leases retries jobs and bounds autoscaling']),
    negativeTestNames: Object.freeze(['cloud recovery contract rejects stale fencing and cross-tenant authorization by default']),
  }),
  'frontier-governance': Object.freeze({
    testPath: 'tests/frontier-governance-contracts.test.mjs',
    positiveTestNames: Object.freeze(['frontier governance contract records repository ownership while keeping promotion human gated']),
    negativeTestNames: Object.freeze(['frontier governance contract rejects operations after close and never exposes adapters or autonomous claims']),
  }),
  'git-workspace': Object.freeze({
    testPath: 'tests/git-workspace-governance-contracts.test.mjs',
    positiveTestNames: Object.freeze(['git workspace governance contract records immutable branch status diff and receipts']),
    negativeTestNames: Object.freeze(['git workspace governance contract rejects unknown projects cross-project tasks and failed git commands']),
  }),
  'context-repository': Object.freeze({
    testPath: 'tests/context-repository-intelligence-contracts.test.mjs',
    positiveTestNames: Object.freeze(['context repository intelligence contract selects useful evidence and executes cited stages in order']),
    negativeTestNames: Object.freeze(['context repository intelligence contract rejects uncited facts suppresses duplicates and obeys budget exhaustion']),
  }),
  'nolane-session': Object.freeze({
    testPath: 'tests/nolane-native-session-contracts.test.mjs',
    positiveTestNames: Object.freeze(['session store contract persists recovers searches and compresses bounded history']),
    negativeTestNames: Object.freeze(['session store contract rejects cross-profile access conflicts duplicates and invalid compression']),
  }),
  'nolane-orchestration': Object.freeze({
    testPath: 'tests/nolane-native-orchestration-contracts.test.mjs',
    positiveTestNames: Object.freeze(['orchestration contract wires skills delegations gateways scheduling messaging plugins and trajectory export']),
    negativeTestNames: Object.freeze(['orchestration contract rejects capability escalation unverified handoff unknown skills and invalid trajectories']),
  }),
  'nolane-runtime': Object.freeze({
    testPath: 'tests/nolane-native-runtime-contracts.test.mjs',
    positiveTestNames: Object.freeze(['native runtime contract verifies the offline Nolane protocol manifest and dependency lock']),
    negativeTestNames: Object.freeze(['native runtime contract rejects path escape tampering and requests before start']),
  }),
  'specialist-governance': Object.freeze({
    testPath: 'tests/small-model-specialist-governance-contracts.test.mjs',
    positiveTestNames: Object.freeze(['specialist governance contract registers routes serializes state records resources and rolls back independently']),
    negativeTestNames: Object.freeze(['specialist governance contract rejects unsupported models unsafe trust updates invalid benchmarks and missing rollback']),
  }),
  'third-party-provenance': Object.freeze({
    testPath: 'tests/third-party-provenance-contracts.test.mjs',
    positiveTestNames: Object.freeze(['third party provenance contract preserves MIT attribution and clean-room transformation accounting']),
    negativeTestNames: Object.freeze(['third party provenance contract rejects missing attribution ownership claims and distributed NolaneNative runtime claims']),
  }),
});

const FAMILY_MATCHERS = Object.freeze([
  ['local-frontier', (path) => path.startsWith('src/frontier-completion/') || path.startsWith('benchmark/frontier/') || path === 'docs/local-frontier-completion-measurement-4.0.0.json'],
  ['capability', (path) => path === 'src/security/capability-registry.mjs'],
  ['repository-discovery', (path) => path === 'src/repository/repository-discovery-service.mjs'],
  ['cloud-recovery', (path) => path === 'src/cloud/cloud-queue.mjs' || path === 'src/cloud/cloud-sandbox-service.mjs' || path === 'src/cloud/kubernetes-sandbox-driver.mjs'],
  ['frontier-governance', (path) => path.startsWith('src/frontier/') || path === 'src/runtime/frontier-governance-plane.mjs'],
  ['git-workspace', (path) => path === 'src/execution/task-workspace.mjs' || path === 'src/repository/git-inspector.mjs'],
  ['context-repository', (path) => path === 'src/agent/context-builder.mjs' || path === 'src/repository/repository-index.mjs' || path === 'vendor/forge-os/src/context/work-unit-context.mjs'],
  ['nolane-session', (path) => path === 'src/nolane-native/session-store.mjs'],
  ['nolane-orchestration', (path) => path === 'src/nolane-native/orchestration-service.mjs'],
  ['nolane-runtime', (path) => path === 'src/nolane-native/runtime-service.mjs'],
  ['specialist-governance', (path) => path === 'src/small-model/specialist-model-fabric.mjs' || path === 'src/small-model/model-state-serializer.mjs'],
  ['third-party-provenance', (path) => path === 'THIRD_PARTY_NOTICES.md'],
]);

export function classifyCheckpoint6EvidenceFamily(requirement = {}) {
  const paths = normalizedPaths(requirement);
  for (const [family, matches] of FAMILY_MATCHERS) {
    if (paths.some(matches)) return family;
  }
  return null;
}

export function migrateCheckpoint6RequirementEvidence(requirement = {}) {
  const value = clone(requirement);
  if (isExternal(value) || (Array.isArray(value?.acceptance?.assertionBindings) && value.acceptance.assertionBindings.length > 0)) return value;
  const family = classifyCheckpoint6EvidenceFamily(value);
  if (!family) return value;
  const binding = BINDINGS[family];
  value.acceptance ??= {};
  const originalTests = unique(value.acceptance.testPaths ?? value.acceptance.exactTest ?? []);
  value.acceptance.testPaths = [binding.testPath];
  if (family === 'third-party-provenance') {
    const originalProduction = normalizedPaths(value);
    value.acceptance.productionEntryPoints = ['src/release/third-party-provenance.mjs'];
    value.acceptance.productionEntrypoint = 'src/release/third-party-provenance.mjs';
    const productionAliases = originalProduction.map((from) => ({ kind: 'production', from, to: 'src/release/third-party-provenance.mjs', reason: 'checkpoint-6-executable-provenance-verifier' }));
    value.acceptance.historicalEvidenceAliases = [...(value.acceptance.historicalEvidenceAliases ?? []), ...productionAliases];
  }
  value.acceptance.assertionBindings = [{
    schema: 'nolane.forensics.requirement-assertion-binding-input.v1',
    testPath: binding.testPath,
    positiveTestNames: [...binding.positiveTestNames],
    negativeTestNames: [...binding.negativeTestNames],
  }];
  const aliases = originalTests
    .filter((from) => from !== binding.testPath)
    .map((from) => ({ kind: 'test', from, to: binding.testPath, reason: 'checkpoint-6-production-family-assertion-binding' }));
  value.acceptance.historicalEvidenceAliases = [...(value.acceptance.historicalEvidenceAliases ?? []), ...aliases]
    .sort((a, b) => `${a.kind}:${a.from}:${a.to ?? ''}`.localeCompare(`${b.kind}:${b.from}:${b.to ?? ''}`));
  value.metadata ??= {};
  value.metadata.checkpoint6EvidenceFamily = family;
  value.metadata.evidencePathMigrationCount = value.acceptance.historicalEvidenceAliases.length;
  return value;
}

export function migrateCheckpoint6LedgerEvidence(ledger = {}) {
  const value = clone(ledger);
  const beforeIds = new Set((value.requirements ?? []).map((item) => String(item.id)));
  let migratedRequirements = 0;
  let unmatchedRequirements = 0;
  value.requirements = (value.requirements ?? []).map((item) => {
    const eligible = !isExternal(item) && !(Array.isArray(item?.acceptance?.assertionBindings) && item.acceptance.assertionBindings.length > 0);
    const family = eligible ? classifyCheckpoint6EvidenceFamily(item) : null;
    const next = migrateCheckpoint6RequirementEvidence(item);
    if (family && next.metadata?.checkpoint6EvidenceFamily && !item.metadata?.checkpoint6EvidenceFamily) migratedRequirements += 1;
    else if (eligible && !family) unmatchedRequirements += 1;
    return next;
  });
  const afterIds = new Set(value.requirements.map((item) => String(item.id)));
  const inventedRequirementIds = [...afterIds].filter((id) => !beforeIds.has(id)).length;
  value.metadata ??= {};
  value.metadata.checkpoint6EvidenceMigration = {
    schema: 'nolane.forensics.checkpoint-6-evidence-migration.v1',
    migratedRequirements,
    unmatchedRequirements,
    inventedRequirementIds,
  };
  return value;
}

export { BINDINGS as CHECKPOINT6_ASSERTION_BINDINGS };
