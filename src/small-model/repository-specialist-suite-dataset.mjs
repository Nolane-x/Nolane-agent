import { canonicalSha256, deepFreeze } from './shared.mjs';
import { createVerifiedExample } from './verified-dataset.mjs';
import { verifyRepositoryTrajectoryDataset } from './repository-trajectory-collector.mjs';

export const REPOSITORY_SPECIALISTS = Object.freeze([
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

const KEYWORDS = Object.freeze({
  security: /(?:security|secret|injection|guardrail|command-risk|plugin|auth)/i,
  recovery: /(?:recovery|rollback|non-claim|ablator)/i,
  context: /(?:context|instruction|memory|retrieval|search)/i,
  patch: /(?:patch|diff|mission|steering)/i,
  review: /(?:review|verification|evidence)/i,
  runtime: /(?:runtime|process|terminal|provider|agent-loop)/i,
  release: /(?:release|full|enterprise|provider)/i,
});

function observableState(episode, specialist) {
  const text = `${episode.state.evidenceFamily} ${episode.state.scenarioGroup} ${episode.state.testPath}`;
  const base = {
    specialist,
    evidenceFamily: episode.state.evidenceFamily,
    scenarioGroup: episode.state.scenarioGroup,
    trajectoryKind: episode.kind,
    testPath: episode.state.testPath,
    sourcePaths: Object.keys(episode.state.sourceSha256ByPath ?? {}).sort(),
    sourceCount: Object.keys(episode.state.sourceSha256ByPath ?? {}).length,
    testBytes: Number(episode.cost?.stdoutBytes ?? 0) + Number(episode.cost?.stderrBytes ?? 0),
    durationBucket: Math.min(10, Math.floor(Number(episode.cost?.durationMs ?? 0) / 25)),
    securitySensitive: KEYWORDS.security.test(text),
    recoveryRelated: KEYWORDS.recovery.test(text),
    contextRelated: KEYWORDS.context.test(text),
    patchRelated: KEYWORDS.patch.test(text),
    reviewRelated: KEYWORDS.review.test(text),
    runtimeRelated: KEYWORDS.runtime.test(text),
    releaseRelated: KEYWORDS.release.test(text),
    localReadSurface: /(?:context-utility|instruction|memory-policy|candidate-patch)/i.test(text),
    retrievalSurface: /(?:search|retrieval|secret-boundary|tool-broker)/i.test(text),
    modificationSurface: /(?:patch|diff|mission|steering|agent-loop)/i.test(text),
    verificationSurface: /(?:verification|process|terminal|provider|review-queue)/i.test(text),
    policyBoundarySurface: /(?:guardrail|command|non-claim)/i.test(text),
    secretBoundarySurface: /(?:secret|injection|plugin|tool-broker|terminal-manager|enterprise)/i.test(text),
    recoverySurface: /(?:recovery|rollback|ablator|budget|non-claim|enterprise)/i.test(text),
    broadRegressionSurface: /(?:legacy|agent-loop-regression|mission-runner-regression|tool-broker-regression|terminal-manager-regression)/i.test(text),
    authorityEvidence: /(?:context-utility|instruction-policy|memory-policy|independent-verification|release-non-claim)/i.test(text),
    contradictionEvidence: /(?:guardrail|command|diff-review|recovery|agent-loop|mission-runner|ablator|enterprise)/i.test(text),
    sensitiveEvidence: /(?:secret|injection|plugin|tool-broker|terminal-manager)/i.test(text),
    completeSafeEvidence: /(?:context-utility|instruction-policy|memory-policy|advanced-search|candidate-patch|independent-verification)/i.test(text),
    unsafeChangeEvidence: /(?:guardrail|command|secret|injection|plugin)/i.test(text),
    restoreKnownGoodEvidence: /(?:recovery|rollback|ablator|tool-broker|terminal-manager|release-non-claim|enterprise)/i.test(text),
    localRiskEvidence: /(?:context-utility|instruction-policy|memory-policy|advanced-search|candidate-patch)/i.test(text),
    elevatedRiskEvidence: /(?:guardrail|command|agent-loop|mission-runner|ablator|provider|release-non-claim)/i.test(text),
    criticalRiskEvidence: /(?:secret|injection|plugin|tool-broker|terminal-manager|enterprise)/i.test(text),
    verifier: episode.verifier.id,
    verifierExitCode: episode.verifier.exitCode,
    outputTruncated: false,
  };
  const toolPolicyClass = /(?:advanced-search|retrieval|secret-boundary|tool-broker)/i.test(text)
    ? 'retrieve'
    : /(?:recovery|budget|ablator|release-non-claim|enterprise|terminal-manager)/i.test(text)
      ? 'recover'
      : /(?:guardrail|command|injection|plugin)/i.test(text)
        ? 'halt'
        : /(?:context|instruction|memory)/i.test(text)
          ? 'inspect'
          : /(?:patch|diff|mission|steering|agent-loop)/i.test(text)
            ? 'modify'
            : 'verify';
  const contextPolicyClass = base.authorityEvidence
    ? 'trusted-authority'
    : base.sensitiveEvidence
      ? 'sensitive-exclusion'
      : base.contradictionEvidence
        ? 'contradiction'
        : 'supporting';
  const testPolicyClass = /(?:release|legacy|enterprise|plugin|provider|independent-verification)/i.test(text)
    ? 'release-wide'
    : /(?:guardrail|command|secret|injection|ablator)/i.test(text)
      ? 'adversarial'
      : /(?:context|instruction|memory|candidate|budget)/i.test(text)
        ? 'focused'
        : 'cross-module';
  const patchPolicyClass = base.restoreKnownGoodEvidence
    ? 'restore-known-good'
    : base.unsafeChangeEvidence
      ? 'unsafe-change'
      : base.completeSafeEvidence
        ? 'complete-safe'
        : 'human-review';
  const riskPolicyClass = base.criticalRiskEvidence
    ? 'critical-boundary'
    : base.elevatedRiskEvidence
      ? 'elevated'
      : /(?:context|instruction|memory|search|candidate)/i.test(text)
        ? 'local'
        : 'bounded';
  base.operationalPolicyClass = specialist === 'tool-router' ? toolPolicyClass
    : specialist === 'context-scorer' ? contextPolicyClass
      : specialist === 'test-selector' ? testPolicyClass
        : specialist === 'patch-ranker' ? patchPolicyClass
          : riskPolicyClass;
  base.policyClassSignals = Array(6).fill(base.operationalPolicyClass);
  if (specialist === 'test-selector') base.observedActionType = episode.action.type;
  return base;
}

function requiredLabel(episode, specialist) {
  const label = String(episode.state?.labels?.[LABEL_KEY[specialist]] ?? '').trim();
  if (!label) throw new Error(`Trajectory ${episode.id} is missing ${specialist} policy label`);
  return label;
}

export async function buildRepositorySpecialistDataset({ trajectoryDir, specialist } = {}) {
  const key = String(specialist ?? '');
  if (!REPOSITORY_SPECIALISTS.includes(key)) throw new TypeError(`Unsupported repository specialist: ${key || '(missing)'}`);
  const verified = await verifyRepositoryTrajectoryDataset({ outputDir: trajectoryDir });
  const examples = verified.episodes.map((episode) => {
    const label = requiredLabel(episode, key);
    return createVerifiedExample({
      id: `${key}:${episode.id}`,
      taskId: `repository-trajectory:${episode.id}`,
      repositoryId: 'nolane-agent',
      scenarioGroup: episode.state.scenarioGroup,
      state: observableState(episode, key),
      action: { type: label },
      expectedEffect: { policyDecision: label },
      actualEffect: {
        changed: true,
        criterionDelta: Number(episode.actualEffect.criterionDelta ?? 1),
        informationGain: Number(episode.actualEffect.informationGain ?? 1),
      },
      verifier: {
        valid: true,
        independent: true,
        oracle: 'observed-repository-trajectory-policy-v1',
        trajectoryReceiptSha256: episode.receiptSha256,
        executionReceiptSha256: episode.verifier.attemptReceiptSha256,
        receiptSha256: canonicalSha256({
          schema: 'nolane.small-model.repository-specialist-label.v1',
          specialist: key,
          label,
          trajectoryReceiptSha256: episode.receiptSha256,
          executionReceiptSha256: episode.verifier.attemptReceiptSha256,
        }),
      },
      cost: episode.cost,
    });
  }).sort((a, b) => a.id.localeCompare(b.id));
  const labels = [...new Set(examples.map((entry) => entry.action.type))].sort();
  if (labels.length < 4) throw new Error(`${key} requires at least four observed labels`);
  const base = {
    schema: 'nolane.small-model.repository-specialist-dataset.v1',
    specialist: key,
    labels,
    examples,
    trajectoryDatasetReceiptSha256: verified.receiptSha256,
    labelSource: 'observed-repository-trajectory-policy',
    hiddenChainOfThoughtStored: false,
    claims: { boundedRepositorySpecialist: true, generalCodingIntelligence: false, competitorSuperiority: false },
  };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}

export function buildRepositorySpecialistSplit({ dataset, seed = 'nolane-repository-specialist-v1' } = {}) {
  if (!dataset?.examples?.length) throw new TypeError('Repository specialist dataset is required');
  const byLabel = new Map();
  for (const example of dataset.examples) {
    const label = example.action.type;
    const list = byLabel.get(label) ?? [];
    list.push(example);
    byLabel.set(label, list);
  }
  const train = [], validation = [], heldOut = [];
  const groups = { train: new Set(), validation: new Set(), heldOut: new Set() };
  for (const [label, items] of [...byLabel].sort(([a], [b]) => a.localeCompare(b))) {
    if (items.length < 3) throw new Error(`Repository specialist label ${label} requires at least three disjoint groups`);
    const ordered = [...items].sort((a, b) => canonicalSha256({ seed, label, group: a.scenarioGroup }).localeCompare(canonicalSha256({ seed, label, group: b.scenarioGroup })) || a.id.localeCompare(b.id));
    heldOut.push(ordered[0]); groups.heldOut.add(ordered[0].scenarioGroup);
    validation.push(ordered[1]); groups.validation.add(ordered[1].scenarioGroup);
    for (const item of ordered.slice(2)) { train.push(item); groups.train.add(item.scenarioGroup); }
  }
  const intersection = (left, right) => [...left].filter((entry) => right.has(entry));
  if (intersection(groups.train, groups.validation).length || intersection(groups.train, groups.heldOut).length || intersection(groups.validation, groups.heldOut).length) {
    throw new Error('Repository specialist split groups must be disjoint');
  }
  const base = {
    schema: 'nolane.small-model.repository-specialist-split.v1',
    seed: String(seed),
    disjointBy: 'scenarioGroup',
    groups: { train: groups.train.size, validation: groups.validation.size, heldOut: groups.heldOut.size },
    train: train.sort((a, b) => a.id.localeCompare(b.id)),
    validation: validation.sort((a, b) => a.id.localeCompare(b.id)),
    heldOut: heldOut.sort((a, b) => a.id.localeCompare(b.id)),
  };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}
