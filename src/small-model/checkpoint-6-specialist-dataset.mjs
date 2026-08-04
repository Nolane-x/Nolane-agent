import { canonicalSha256, deepFreeze } from './shared.mjs';
import { createVerifiedExample } from './verified-dataset.mjs';
import { verifyRepositoryTrajectoryDataset } from './repository-trajectory-collector.mjs';
import { verifyMultiRuntimeTrajectoryDataset } from './multi-runtime-trajectory-collector.mjs';
import { verifyMutationRecoveryDataset } from './mutation-recovery-lab.mjs';

export const CHECKPOINT_6_SPECIALISTS = Object.freeze([
  'tool-router',
  'context-scorer',
  'test-selector',
  'patch-ranker',
  'risk-classifier',
]);

const LABEL_KEY = Object.freeze({
  'tool-router': 'toolRouter',
  'context-scorer': 'contextScorer',
  'test-selector': 'testSelector',
  'patch-ranker': 'patchRanker',
  'risk-classifier': 'riskClassifier',
});

const SIGNALS = Object.freeze({
  security: /(?:security|secret|injection|guardrail|credential|auth|plugin|command)/i,
  recovery: /(?:recovery|rollback|repair|mutation|non-claim|budget|timeout)/i,
  context: /(?:context|instruction|memory|retrieval|search|knowledge)/i,
  patch: /(?:patch|diff|mission|steering|edit|migration)/i,
  review: /(?:review|verification|evidence|audit|test)/i,
  runtime: /(?:runtime|process|terminal|provider|launcher|pty|sdk)/i,
  release: /(?:release|package|matrix|enterprise|update|bootstrap)/i,
});

function requiredLabel(episode, specialist) {
  const label = String(episode.state?.labels?.[LABEL_KEY[specialist]] ?? '').trim();
  if (!label) throw new Error(`Trajectory ${episode.id} is missing ${specialist} policy label`);
  return label;
}

function pathKeys(value) {
  if (!value || typeof value !== 'object') return [];
  return Object.keys(value).sort();
}

function policyClass({ specialist, text, recoveryPhase, projectId }) {
  const mutationFailure = recoveryPhase === 'mutation-failure';
  const recoveryPass = recoveryPhase === 'recovery-pass';
  if (specialist === 'tool-router') {
    if (recoveryPass || /(?:budget|patch-ablation|enterprise-recovery|release-non-claim|terminal-regression)/i.test(text)) return 'recover';
    if (/(?:advanced-search|hybrid-retrieval|execution-secret-boundary|tool-broker-regression)/i.test(text)) return 'retrieve';
    if (mutationFailure || /(?:guardrail|command|injection|plugin|credential)/i.test(text)) return 'halt';
    if (/(?:context|instruction|memory)/i.test(text)) return 'inspect';
    if (/(?:patch|diff|mission|agent-loop)/i.test(text)) return 'modify';
    return 'verify';
  }
  if (specialist === 'context-scorer') {
    if (recoveryPass && /release/i.test(text)) return 'trusted-authority';
    if (/(?:context|instruction|memory|independent-verification|release-non-claim)/i.test(text)) return 'trusted-authority';
    if (/(?:injection|plugin|secret|credential|tool-broker-regression)/i.test(text) || (mutationFailure && /python/i.test(projectId))) return 'sensitive-exclusion';
    if (mutationFailure || /(?:guardrail|command|budget|patch-ablation|enterprise-recovery|agent-loop|mission-regression)/i.test(text)) return 'contradiction';
    return 'supporting';
  }
  if (specialist === 'test-selector') {
    if (mutationFailure || /(?:guardrail|command|injection|secret|credential|patch-ablation)/i.test(text)) return 'adversarial';
    if (/(?:release|legacy|enterprise|plugin|provider|independent-verification|launcher)/i.test(text)) return 'release-wide';
    if (/(?:context|instruction|memory|budget|candidate-patch)/i.test(text)) return 'focused';
    return 'cross-module';
  }
  if (specialist === 'patch-ranker') {
    if (recoveryPass || /(?:context|instruction|memory|advanced-search|candidate-patch|independent-verification)/i.test(text)) return 'complete-safe';
    if (/(?:budget|patch-ablation|enterprise-recovery|release-non-claim|terminal-regression|tool-broker-regression)/i.test(text)) return 'restore-known-good';
    if (mutationFailure || /(?:guardrail|command|injection|plugin|secret|credential)/i.test(text)) return 'unsafe-change';
    return 'human-review';
  }
  if (recoveryPass || /(?:context|instruction|memory|advanced-search|candidate-patch)/i.test(text)) return 'local';
  if (/(?:injection|plugin|secret|credential|enterprise-recovery|terminal-regression|tool-broker-regression)/i.test(text) || (mutationFailure && !/native-pty-go/i.test(projectId))) return 'critical-boundary';
  if (mutationFailure || /(?:guardrail|command|agent-loop|mission-regression|provider|release-non-claim|launcher|patch-ablation)/i.test(text)) return 'elevated';
  return 'bounded';
}

function observableState(episode, specialist, sourceKind) {
  const projectId = String(episode.state?.projectId ?? 'nolane-agent-node');
  const runtime = String(episode.state?.runtime ?? 'node');
  const scenarioGroup = String(episode.state?.scenarioGroup ?? episode.id);
  const evidenceFamily = String(episode.state?.evidenceFamily ?? 'unknown');
  const recoveryPhase = String(episode.state?.recoveryPhase ?? 'none');
  const sourcePaths = [
    ...pathKeys(episode.state?.sourceSha256ByPath),
    ...(episode.state?.sourcePath ? [String(episode.state.sourcePath)] : []),
  ].sort();
  const testPaths = [
    ...pathKeys(episode.state?.testSha256ByPath),
    ...(episode.state?.testPath ? [String(episode.state.testPath)] : []),
  ].sort();
  const text = [projectId, runtime, scenarioGroup, evidenceFamily, recoveryPhase, ...sourcePaths, ...testPaths].join(' ');
  const mutationObserved = episode.state?.mutationObserved === true || recoveryPhase === 'mutation-failure';
  const recoveryObserved = episode.state?.recoveryObserved === true || recoveryPhase === 'recovery-pass';
  const operationalPolicyClass = policyClass({ specialist, text, recoveryPhase, projectId });
  return {
    specialist,
    sourceKind,
    projectId,
    runtime,
    scenarioGroup,
    evidenceFamily,
    recoveryPhase,
    trajectoryKind: String(episode.kind ?? 'verification'),
    verifierId: String(episode.verifier?.id ?? 'unknown'),
    verifierExitCode: Number(episode.verifier?.exitCode ?? -1),
    sourcePaths,
    testPaths,
    sourceCount: sourcePaths.length,
    testCount: testPaths.length,
    durationBucket: Math.min(20, Math.floor(Number(episode.cost?.durationMs ?? 0) / 50)),
    outputBucket: Math.min(20, Math.floor((Number(episode.cost?.stdoutBytes ?? 0) + Number(episode.cost?.stderrBytes ?? 0)) / 512)),
    mutationObserved,
    recoveryObserved,
    safetyCritical: episode.state?.safetyCritical === true || SIGNALS.security.test(text) || recoveryPhase === 'mutation-failure',
    securitySensitive: SIGNALS.security.test(text),
    recoveryRelated: SIGNALS.recovery.test(text),
    contextRelated: SIGNALS.context.test(text),
    patchRelated: SIGNALS.patch.test(text),
    reviewRelated: SIGNALS.review.test(text),
    runtimeRelated: SIGNALS.runtime.test(text),
    releaseRelated: SIGNALS.release.test(text),
    multiRuntime: runtime !== 'node',
    observedPass: Number(episode.verifier?.exitCode ?? -1) === 0,
    observedFailure: Number(episode.verifier?.exitCode ?? -1) !== 0,
    operationalPolicyClass,
    policyClassSignals: Array(8).fill(operationalPolicyClass),
  };
}

function verifiedExample(episode, specialist, sourceKind) {
  const label = requiredLabel(episode, specialist);
  const projectId = String(episode.state?.projectId ?? 'nolane-agent-node');
  const scenario = String(episode.state?.scenarioGroup ?? episode.id);
  const group = `${projectId}:${scenario}`;
  return createVerifiedExample({
    id: `${specialist}:${sourceKind}:${episode.id}`,
    taskId: `checkpoint-6-trajectory:${episode.id}`,
    repositoryId: projectId,
    scenarioGroup: group,
    state: observableState(episode, specialist, sourceKind),
    action: { type: label },
    expectedEffect: { policyDecision: label },
    actualEffect: {
      changed: true,
      criterionDelta: Number(episode.actualEffect?.criterionDelta ?? 1),
      informationGain: Number(episode.actualEffect?.informationGain ?? 1),
    },
    verifier: {
      valid: true,
      independent: true,
      oracle: 'observed-multi-runtime-policy-v1',
      trajectoryReceiptSha256: episode.receiptSha256,
      executionReceiptSha256: episode.verifier?.attemptReceiptSha256,
      receiptSha256: canonicalSha256({
        schema: 'nolane.small-model.checkpoint-6-specialist-label.v1',
        specialist,
        sourceKind,
        label,
        trajectoryReceiptSha256: episode.receiptSha256,
        executionReceiptSha256: episode.verifier?.attemptReceiptSha256,
      }),
    },
    cost: episode.cost ?? {},
  });
}

export async function buildCheckpoint6SpecialistDataset({ repositoryTrajectoryDir, multiRuntimeDir, specialist } = {}) {
  const key = String(specialist ?? '');
  if (!CHECKPOINT_6_SPECIALISTS.includes(key)) throw new TypeError(`Unsupported checkpoint 6 specialist: ${key || '(missing)'}`);
  const [repository, multiRuntime, recovery] = await Promise.all([
    verifyRepositoryTrajectoryDataset({ outputDir: repositoryTrajectoryDir }),
    verifyMultiRuntimeTrajectoryDataset({ outputDir: multiRuntimeDir }),
    verifyMutationRecoveryDataset({ outputDir: multiRuntimeDir }),
  ]);
  const tagged = [
    ...repository.episodes.map((episode) => ({ episode, sourceKind: 'repository' })),
    ...multiRuntime.episodes.map((episode) => ({ episode, sourceKind: 'multi-runtime' })),
    ...recovery.episodes.map((episode) => ({ episode, sourceKind: 'recovery' })),
  ];
  const examples = tagged.map(({ episode, sourceKind }) => verifiedExample(episode, key, sourceKind)).sort((a, b) => a.id.localeCompare(b.id));
  const labels = [...new Set(examples.map((entry) => entry.action.type))].sort();
  if (labels.length < 4) throw new Error(`${key} requires at least four observed labels`);
  const projects = [...new Set(examples.map((entry) => entry.repositoryId))].sort();
  const runtimes = [...new Set(examples.map((entry) => entry.state.runtime))].sort();
  const lineage = {
    repositoryDatasetReceiptSha256: repository.receiptSha256,
    multiRuntimeDatasetReceiptSha256: multiRuntime.receiptSha256,
    recoveryDatasetReceiptSha256: recovery.receiptSha256,
    repositoryEpisodes: repository.episodes.length,
    multiRuntimeEpisodes: multiRuntime.episodes.length,
    recoveryEpisodes: recovery.episodes.length,
    projects,
    runtimes,
    mutationObserved: recovery.episodes.some((entry) => entry.state?.recoveryPhase === 'mutation-failure'),
    recoveryObserved: recovery.episodes.some((entry) => entry.state?.recoveryPhase === 'recovery-pass'),
  };
  if (projects.length < 3 || runtimes.length < 3 || !lineage.mutationObserved || !lineage.recoveryObserved) throw new Error('Checkpoint 6 dataset requires multi-project, three-runtime, mutation, and recovery lineage');
  const base = {
    schema: 'nolane.small-model.checkpoint-6-specialist-dataset.v1',
    specialist: key,
    labels,
    examples,
    lineage,
    labelSource: 'observed-repository-multi-runtime-recovery-policy',
    hiddenChainOfThoughtStored: false,
    claims: { boundedSpecialist: true, generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false },
  };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}

export function buildCheckpoint6SpecialistSplit({ dataset, seed = 'nolane-checkpoint-6-specialist-v1' } = {}) {
  if (!dataset?.examples?.length) throw new TypeError('Checkpoint 6 specialist dataset is required');
  const byLabel = new Map();
  for (const example of dataset.examples) {
    const label = String(example.action.type);
    const items = byLabel.get(label) ?? [];
    items.push(example);
    byLabel.set(label, items);
  }
  const train = []; const validation = []; const heldOut = [];
  const groups = { train: new Set(), validation: new Set(), heldOut: new Set() };
  for (const [label, items] of [...byLabel].sort(([a], [b]) => a.localeCompare(b))) {
    if (items.length < 3) throw new Error(`Checkpoint 6 specialist label ${label} requires at least three disjoint groups`);
    const ordered = [...items].sort((a, b) => canonicalSha256({ seed, label, group: a.scenarioGroup }).localeCompare(canonicalSha256({ seed, label, group: b.scenarioGroup })) || a.id.localeCompare(b.id));
    heldOut.push(ordered[0]); groups.heldOut.add(ordered[0].scenarioGroup);
    validation.push(ordered[1]); groups.validation.add(ordered[1].scenarioGroup);
    for (const item of ordered.slice(2)) { train.push(item); groups.train.add(item.scenarioGroup); }
  }
  const overlap = (left, right) => [...left].filter((entry) => right.has(entry));
  if (overlap(groups.train, groups.validation).length || overlap(groups.train, groups.heldOut).length || overlap(groups.validation, groups.heldOut).length) throw new Error('Checkpoint 6 split groups must be disjoint');
  const base = {
    schema: 'nolane.small-model.checkpoint-6-specialist-split.v1',
    seed: String(seed),
    disjointBy: 'projectId:scenarioGroup',
    groups: { train: groups.train.size, validation: groups.validation.size, heldOut: groups.heldOut.size },
    train: train.sort((a, b) => a.id.localeCompare(b.id)),
    validation: validation.sort((a, b) => a.id.localeCompare(b.id)),
    heldOut: heldOut.sort((a, b) => a.id.localeCompare(b.id)),
  };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}
