export const REPOSITORY_TRAJECTORY_PROBES = Object.freeze([
  {
    id: 'repo-guardrail-contracts', kind: 'verification', actionType: 'stop', testPath: 'tests/agent-runtime-guardrail-contracts.test.mjs',
    sourcePaths: ['src/orchestration/task-contract.mjs', 'src/security/verification-claim-guard.mjs', 'src/security/autonomy-policy.mjs'],
    state: { evidenceFamily: 'guardrail', scenarioGroup: 'agent-runtime-guardrail', labels: { toolRouter: 'stop', contextScorer: 'counter-evidence', testSelector: 'mutation', patchRanker: 'reject', riskClassifier: 'high' } },
  },
  {
    id: 'repo-budget-recovery-contracts', kind: 'recovery', actionType: 'rollback', testPath: 'tests/agent-runtime-budget-recovery-contracts.test.mjs',
    sourcePaths: ['src/agent/budget.mjs'],
    state: { evidenceFamily: 'budget', scenarioGroup: 'agent-runtime-budget', labels: { toolRouter: 'rollback', contextScorer: 'counter-evidence', testSelector: 'unit', patchRanker: 'rollback', riskClassifier: 'medium' } },
  },
  {
    id: 'repo-context-tool-contracts', kind: 'tool-policy', actionType: 'read', testPath: 'tests/agent-runtime-context-tool-contracts.test.mjs',
    sourcePaths: ['src/agent/context-builder.mjs', 'src/agent/agent-loop.mjs'],
    state: { evidenceFamily: 'context', scenarioGroup: 'agent-runtime-context', labels: { toolRouter: 'read', contextScorer: 'pin', testSelector: 'unit', patchRanker: 'accept', riskClassifier: 'low' } },
  },
  {
    id: 'repo-mission-state-contracts', kind: 'planning', actionType: 'patch', testPath: 'tests/mission-runtime-state-verification-contracts.test.mjs',
    sourcePaths: ['src/storage/studio-store.mjs', 'src/orchestration/mission-runner.mjs'],
    state: { evidenceFamily: 'mission', scenarioGroup: 'mission-runtime-state', labels: { toolRouter: 'patch', contextScorer: 'support', testSelector: 'integration', patchRanker: 'review', riskClassifier: 'medium' } },
  },
  {
    id: 'repo-command-governance-contracts', kind: 'verification', actionType: 'stop', testPath: 'tests/execution-command-governance-contracts.test.mjs',
    sourcePaths: ['src/security/autonomy-policy.mjs', 'src/security/command-risk-classifier.mjs'],
    state: { evidenceFamily: 'command', scenarioGroup: 'execution-command-governance', labels: { toolRouter: 'stop', contextScorer: 'counter-evidence', testSelector: 'mutation', patchRanker: 'reject', riskClassifier: 'high' } },
  },
  {
    id: 'repo-secret-boundary-contracts', kind: 'verification', actionType: 'search', testPath: 'tests/execution-secret-boundary-contracts.test.mjs',
    sourcePaths: ['src/security/redaction.mjs', 'src/execution/tool-broker.mjs'],
    state: { evidenceFamily: 'secret', scenarioGroup: 'execution-secret-boundary', labels: { toolRouter: 'search', contextScorer: 'exclude', testSelector: 'mutation', patchRanker: 'reject', riskClassifier: 'critical' } },
  },
  {
    id: 'repo-process-lifecycle-contracts', kind: 'tool-policy', actionType: 'test', testPath: 'tests/execution-process-lifecycle-contracts.test.mjs',
    sourcePaths: ['src/execution/tool-broker.mjs'],
    state: { evidenceFamily: 'process', scenarioGroup: 'execution-process-lifecycle', labels: { toolRouter: 'test', contextScorer: 'support', testSelector: 'integration', patchRanker: 'review', riskClassifier: 'medium' } },
  },
  {
    id: 'repo-terminal-governance-contracts', kind: 'tool-policy', actionType: 'test', testPath: 'tests/terminal-lifecycle-governance-contracts.test.mjs',
    sourcePaths: ['src/terminal/terminal-manager.mjs'],
    state: { evidenceFamily: 'terminal', scenarioGroup: 'terminal-lifecycle-governance', labels: { toolRouter: 'test', contextScorer: 'support', testSelector: 'integration', patchRanker: 'review', riskClassifier: 'medium' } },
  },
  {
    id: 'repo-agent-loop-regression', kind: 'planning', actionType: 'patch', testPath: 'tests/agent-loop.test.mjs',
    sourcePaths: ['src/agent/agent-loop.mjs', 'src/agent/context-builder.mjs', 'src/providers/provider-registry.mjs'],
    state: { evidenceFamily: 'agent-loop', scenarioGroup: 'legacy-agent-loop', labels: { toolRouter: 'patch', contextScorer: 'counter-evidence', testSelector: 'full', patchRanker: 'review', riskClassifier: 'high' } },
  },
  {
    id: 'repo-mission-runner-regression', kind: 'planning', actionType: 'patch', testPath: 'tests/mission-runner.test.mjs',
    sourcePaths: ['src/orchestration/mission-runner.mjs', 'src/orchestration/task-graph.mjs', 'src/orchestration/interrupts.mjs'],
    state: { evidenceFamily: 'mission-regression', scenarioGroup: 'legacy-mission-runner', labels: { toolRouter: 'patch', contextScorer: 'counter-evidence', testSelector: 'full', patchRanker: 'review', riskClassifier: 'high' } },
  },
  {
    id: 'repo-tool-broker-regression', kind: 'verification', actionType: 'search', testPath: 'tests/tool-broker.test.mjs',
    sourcePaths: ['src/execution/tool-broker.mjs', 'src/security/path-policy.mjs', 'src/security/redaction.mjs'],
    state: { evidenceFamily: 'tool-broker-regression', scenarioGroup: 'legacy-tool-broker', labels: { toolRouter: 'search', contextScorer: 'exclude', testSelector: 'full', patchRanker: 'rollback', riskClassifier: 'critical' } },
  },
  {
    id: 'repo-terminal-manager-regression', kind: 'recovery', actionType: 'rollback', testPath: 'tests/terminal-manager.test.mjs',
    sourcePaths: ['src/terminal/terminal-manager.mjs'],
    state: { evidenceFamily: 'terminal-regression', scenarioGroup: 'legacy-terminal-manager', labels: { toolRouter: 'rollback', contextScorer: 'exclude', testSelector: 'full', patchRanker: 'rollback', riskClassifier: 'critical' } },
  },

  {
    id: 'repo-context-utility-selector', kind: 'tool-policy', actionType: 'read', testPath: 'tests/context-utility-selector.test.mjs', sourcePaths: 'auto',
    state: { evidenceFamily: 'context-utility', scenarioGroup: 'context-utility-selector', labels: { toolRouter: 'read', contextScorer: 'pin', testSelector: 'unit', patchRanker: 'accept', riskClassifier: 'low' } },
  },
  {
    id: 'repo-instruction-policy-service', kind: 'tool-policy', actionType: 'read', testPath: 'tests/instruction-policy-service.test.mjs', sourcePaths: 'auto',
    state: { evidenceFamily: 'instruction-policy', scenarioGroup: 'instruction-policy-service', labels: { toolRouter: 'read', contextScorer: 'pin', testSelector: 'unit', patchRanker: 'accept', riskClassifier: 'low' } },
  },
  {
    id: 'repo-memory-policy-controller', kind: 'tool-policy', actionType: 'read', testPath: 'tests/memory-policy-controller.test.mjs', sourcePaths: 'auto',
    state: { evidenceFamily: 'memory-policy', scenarioGroup: 'memory-policy-controller', labels: { toolRouter: 'read', contextScorer: 'pin', testSelector: 'unit', patchRanker: 'accept', riskClassifier: 'low' } },
  },
  {
    id: 'repo-advanced-search-service', kind: 'localization', actionType: 'search', testPath: 'tests/advanced-search-service.test.mjs', sourcePaths: 'auto',
    state: { evidenceFamily: 'advanced-search', scenarioGroup: 'advanced-search-service', labels: { toolRouter: 'search', contextScorer: 'support', testSelector: 'integration', patchRanker: 'accept', riskClassifier: 'low' } },
  },
  {
    id: 'repo-hybrid-evidence-retrieval', kind: 'localization', actionType: 'search', testPath: 'tests/hybrid-evidence-retrieval-service.test.mjs', sourcePaths: 'auto',
    state: { evidenceFamily: 'hybrid-retrieval', scenarioGroup: 'hybrid-evidence-retrieval', labels: { toolRouter: 'search', contextScorer: 'support', testSelector: 'integration', patchRanker: 'review', riskClassifier: 'medium' } },
  },
  {
    id: 'repo-candidate-patch-selector', kind: 'planning', actionType: 'patch', testPath: 'tests/candidate-patch-selector.test.mjs', sourcePaths: 'auto',
    state: { evidenceFamily: 'candidate-patch', scenarioGroup: 'candidate-patch-selector', labels: { toolRouter: 'patch', contextScorer: 'support', testSelector: 'unit', patchRanker: 'accept', riskClassifier: 'low' } },
  },
  {
    id: 'repo-patch-engine-transaction', kind: 'planning', actionType: 'patch', testPath: 'tests/patch-engine-transaction.test.mjs', sourcePaths: 'auto',
    state: { evidenceFamily: 'patch-transaction', scenarioGroup: 'patch-engine-transaction', labels: { toolRouter: 'patch', contextScorer: 'support', testSelector: 'integration', patchRanker: 'review', riskClassifier: 'medium' } },
  },
  {
    id: 'repo-diff-review-service', kind: 'verification', actionType: 'patch', testPath: 'tests/diff-review-service.test.mjs', sourcePaths: 'auto',
    state: { evidenceFamily: 'diff-review', scenarioGroup: 'diff-review-service', labels: { toolRouter: 'patch', contextScorer: 'counter-evidence', testSelector: 'integration', patchRanker: 'review', riskClassifier: 'medium' } },
  },
  {
    id: 'repo-counterfactual-patch-ablator', kind: 'recovery', actionType: 'rollback', testPath: 'tests/counterfactual-patch-ablator.test.mjs', sourcePaths: 'auto',
    state: { evidenceFamily: 'patch-ablation', scenarioGroup: 'counterfactual-patch-ablator', labels: { toolRouter: 'rollback', contextScorer: 'counter-evidence', testSelector: 'mutation', patchRanker: 'rollback', riskClassifier: 'high' } },
  },
  {
    id: 'repo-action-guardrail-pipeline', kind: 'verification', actionType: 'stop', testPath: 'tests/action-guardrail-pipeline.test.mjs', sourcePaths: 'auto',
    state: { evidenceFamily: 'action-guardrail', scenarioGroup: 'action-guardrail-pipeline', labels: { toolRouter: 'stop', contextScorer: 'counter-evidence', testSelector: 'mutation', patchRanker: 'reject', riskClassifier: 'high' } },
  },
  {
    id: 'repo-command-risk-classifier', kind: 'verification', actionType: 'stop', testPath: 'tests/command-risk-classifier.test.mjs', sourcePaths: 'auto',
    state: { evidenceFamily: 'command-risk', scenarioGroup: 'command-risk-classifier', labels: { toolRouter: 'stop', contextScorer: 'counter-evidence', testSelector: 'mutation', patchRanker: 'reject', riskClassifier: 'high' } },
  },
  {
    id: 'repo-browser-injection-guard', kind: 'verification', actionType: 'stop', testPath: 'tests/browser-injection-guard.test.mjs', sourcePaths: 'auto',
    state: { evidenceFamily: 'browser-injection', scenarioGroup: 'browser-injection-guard', labels: { toolRouter: 'stop', contextScorer: 'exclude', testSelector: 'mutation', patchRanker: 'reject', riskClassifier: 'critical' } },
  },
  {
    id: 'repo-contextual-injection-security', kind: 'verification', actionType: 'stop', testPath: 'tests/contextual-injection-security.test.mjs', sourcePaths: 'auto',
    state: { evidenceFamily: 'contextual-injection', scenarioGroup: 'contextual-injection-security', labels: { toolRouter: 'stop', contextScorer: 'exclude', testSelector: 'mutation', patchRanker: 'reject', riskClassifier: 'critical' } },
  },
  {
    id: 'repo-independent-verification-runtime', kind: 'verification', actionType: 'test', testPath: 'tests/independent-verification-runtime.test.mjs', sourcePaths: 'auto',
    state: { evidenceFamily: 'independent-verification', scenarioGroup: 'independent-verification-runtime', labels: { toolRouter: 'test', contextScorer: 'pin', testSelector: 'full', patchRanker: 'accept', riskClassifier: 'medium' } },
  },
  {
    id: 'repo-mission-steering-service', kind: 'planning', actionType: 'patch', testPath: 'tests/mission-steering-service.test.mjs', sourcePaths: 'auto',
    state: { evidenceFamily: 'mission-steering', scenarioGroup: 'mission-steering-service', labels: { toolRouter: 'patch', contextScorer: 'support', testSelector: 'integration', patchRanker: 'review', riskClassifier: 'medium' } },
  },
  {
    id: 'repo-provider-registry', kind: 'verification', actionType: 'test', testPath: 'tests/provider-registry.test.mjs', sourcePaths: 'auto',
    state: { evidenceFamily: 'provider-registry', scenarioGroup: 'provider-registry', labels: { toolRouter: 'test', contextScorer: 'support', testSelector: 'full', patchRanker: 'review', riskClassifier: 'high' } },
  },
  {
    id: 'repo-enterprise-cloud-recovery', kind: 'recovery', actionType: 'rollback', testPath: 'tests/enterprise-cloud-recovery.test.mjs', sourcePaths: 'auto',
    state: { evidenceFamily: 'enterprise-recovery', scenarioGroup: 'enterprise-cloud-recovery', labels: { toolRouter: 'rollback', contextScorer: 'counter-evidence', testSelector: 'full', patchRanker: 'rollback', riskClassifier: 'critical' } },
  },
  {
    id: 'repo-plugin-capability-review', kind: 'verification', actionType: 'stop', testPath: 'tests/plugin-capability-review.test.mjs', sourcePaths: 'auto',
    state: { evidenceFamily: 'plugin-review', scenarioGroup: 'plugin-capability-review', labels: { toolRouter: 'stop', contextScorer: 'exclude', testSelector: 'full', patchRanker: 'reject', riskClassifier: 'critical' } },
  },
  {
    id: 'repo-release-non-claim-manifest', kind: 'recovery', actionType: 'rollback', testPath: 'tests/release-non-claim-manifest.test.mjs', sourcePaths: 'auto',
    state: { evidenceFamily: 'release-non-claim', scenarioGroup: 'release-non-claim-manifest', labels: { toolRouter: 'rollback', contextScorer: 'pin', testSelector: 'full', patchRanker: 'rollback', riskClassifier: 'high' } },
  },
  {
    id: 'repo-review-queue-service', kind: 'verification', actionType: 'test', testPath: 'tests/review-queue-service.test.mjs', sourcePaths: 'auto',
    state: { evidenceFamily: 'review-queue', scenarioGroup: 'review-queue-service', labels: { toolRouter: 'test', contextScorer: 'support', testSelector: 'integration', patchRanker: 'review', riskClassifier: 'medium' } },
  },
]);
