import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { buildRemainingGapsReport, renderRemainingGapsMarkdown } from '../src/release/remaining-gaps-report.mjs';

const DECISION_VERIFIED = new Set(['29.1','29.2','29.4','29.5','29.6','29.7','29.9','29.10','29.11','29.12','29.15','29.18','30.1','30.3','30.4','30.5','30.6','30.7','30.8','30.9','30.10','30.11','30.12','30.16','30.18']);
const DECISION_PARTIAL = new Set(['29.3','29.8','29.13','29.14','29.16','30.2','30.17']);
const VERIFIED_MISSION_RUNTIME_VERIFIED = new Set(['29.3','29.8','29.13','29.14','29.16','34.9','34.11','34.12','34.13','34.14','40.4','40.12','40.18']);
const REPOSITORY_TRUTH_PLANE_VERIFIED = new Set(['32.2','32.3','32.4','32.7','32.9','32.10','32.11','32.12','32.15','32.17','32.18']);
const CONSTRUCTION_SAFETY_COMPLETION_VERIFIED = new Set(['34.16','35.6','35.7','35.11','35.12','35.13','35.15','36.4','36.5','36.6','36.11','36.14','36.16','37.4','37.5','37.11','37.15','46.9','46.11','46.13','46.16']);
const ADAPTIVE_LEARNING_TRUST_VERIFIED = new Set(['38.2','38.6','38.7','38.10','38.12','38.13','38.14','38.18','47.6','47.10','47.11']);
const INTELLIGENCE_COMPLETION_VERIFIED = new Set(['30.13','30.14','30.15','31.12','32.5','32.8','32.13','32.16','33.6','33.7','36.12','36.13','36.17']);
const INTELLIGENCE_VERIFIED = new Set(['31.1','31.3','31.7','31.8','31.10','31.13','31.14','31.15','32.1']);
const INTELLIGENCE_PARTIAL = new Set(['31.2','31.4','31.5','31.6','31.9','31.11','31.16','31.17','32.2','32.3','32.4','32.7','32.9','32.11','32.12','32.15','32.17','32.18']);
const POLYGLOT_VERIFIED = new Set(['32.14','33.14','33.15','33.16','33.17','33.18']);
const POLYGLOT_PARTIAL = new Set(['32.10','33.1','33.2','33.3','33.4','33.5','33.8','33.9','33.10','33.11','33.12','33.13']);
const COGNITION_VERIFIED = new Set(['34.1','34.2','34.3','34.4','34.5','34.6','34.7','34.8','34.10','34.15','34.17','34.18']);
const COGNITION_PARTIAL = new Set(['34.9','34.11','34.12','34.13','34.14','34.16']);
const CONSTRUCTION_VERIFIED = new Set(['35.1','35.2','35.3','35.4','35.5','35.8','35.9','35.10','35.14','35.16','35.17','35.18','36.1','36.2','36.3','36.8','36.9','36.10','36.15']);
const CONSTRUCTION_PARTIAL = new Set(['35.6','35.7','35.11','35.12','35.13','35.15','36.4','36.5','36.6','36.14','36.16']);
const VERIFICATION_VERIFIED = new Set(['37.1','37.2','37.3','37.6','37.7','37.8','37.9','37.10','37.12','37.13','37.14','37.16','37.17','37.18']);
const VERIFICATION_PARTIAL = new Set(['37.4','37.5','37.11','37.15']);
const ROUTING_VERIFIED = new Set(['38.1','38.3','38.4','38.5','38.8','38.9','38.11','38.15','38.16','38.17']);
const ROUTING_PARTIAL = new Set(['38.2','38.6','38.7','38.10','38.12','38.13','38.14','38.18']);
const MEMORY_OS_VERIFIED = new Set(['39.1','39.2','39.3','39.5','39.6','39.7','39.8','39.9','39.10','39.11','39.12','39.13','39.14','39.17','39.18']);
const MEMORY_OS_PARTIAL = new Set(['39.4','39.15','39.16']);
const RESOURCE_ADMISSION_VERIFIED = new Set(['40.1','40.2','40.6','40.7','40.10','40.11','40.13','40.14','40.15','40.16']);
const RESOURCE_ADMISSION_PARTIAL = new Set(['40.3','40.4','40.5','40.8','40.9','40.12','40.17','40.18']);
const COLLABORATION_VERIFIED = new Set(['41.1','41.2','41.3','41.4','41.5','41.6','41.7','41.8','41.10','41.12','41.13','41.15','41.16']);
const COLLABORATION_PARTIAL = new Set(['41.9','41.11','41.14','41.18']);
const BROWSER_EXPERIENCE_VERIFIED = new Set(['42.1','42.2','42.6','42.7','42.11','42.12','42.13','42.17','42.18']);
const BROWSER_EXPERIENCE_PARTIAL = new Set(['42.3','42.4','42.5','42.8','42.10','42.15','42.16']);
const UI_IDE_VERIFIED = new Set(['44.1','44.3','44.4','44.5','44.6','44.7','44.15']);
const UI_IDE_PARTIAL = new Set(['44.2','44.8','44.9','44.10','44.13','44.14','44.17','44.18']);
const SECURITY_VERIFIED = new Set(['43.1','43.2','43.3','43.4','43.5','43.6','43.7','43.8','43.12','43.14','43.15','43.16','43.17','43.18']);
const SECURITY_PARTIAL = new Set(['43.9','43.10','43.11','43.13']);
const CERTIFICATION_VERIFIED = new Set(['45.4','45.5','45.6','45.7','45.9','45.10','45.11','45.12','45.14','45.15']);
const CERTIFICATION_PARTIAL = new Set(['45.1','45.2','45.3','45.8','45.17']);
const CERTIFICATION_EXTERNAL = new Set(['45.13','45.16','45.18']);
const WORLD_MODEL_VERIFIED = new Set(['46.1','46.2','46.3','46.4','46.5','46.6','46.7','46.8','46.10','46.12','46.14','46.15','46.17','46.18']);
const WORLD_MODEL_PARTIAL = new Set(['46.9','46.11','46.13','46.16']);
const DEVELOPMENT_VERIFIED = new Set(['47.1','47.2','47.3','47.4','47.5','47.7','47.8','47.9','47.12','47.13','47.14','47.15','47.16','47.17','47.18']);
const DEVELOPMENT_PARTIAL = new Set(['47.6','47.10','47.11']);
const FRONTIER_VERIFIED = new Set(['29.17','32.6','36.7','36.18','41.17',...Array.from({ length: 18 }, (_, index) => `48.${index + 1}`)]);
const FRONTIER_PARTIAL = new Set(['36.11','44.12','44.16']);
const FRONTIER_EXTERNAL = new Set(['31.18','42.9','42.14','44.11']);
const FRONTIER_SPECIAL = new Set([...FRONTIER_VERIFIED, ...FRONTIER_PARTIAL, ...FRONTIER_EXTERNAL]);
const LOCAL_FRONTIER_COMPLETION_VERIFIED = new Set([
  '30.2','30.17','31.4','31.5','31.6','31.9','31.11','31.16','31.17',
  '33.5','33.8','33.9','33.10','33.11','33.12','33.13',
  '39.4','39.15','39.16','40.3','40.5','40.8','40.9','40.17','41.9','41.11','41.14','41.18',
  '42.3','42.4','42.5','42.8','42.10','42.15','42.16','43.9','43.10','43.11','43.13',
  '44.2','44.8','44.9','44.10','44.12','44.13','44.14','44.16','44.17','44.18',
  '45.1','45.2','45.8','45.17',
]);
const LOCAL_FRONTIER_COMPLETION_EXTERNAL = new Set(['31.2','33.1','33.2','33.3','33.4','45.3']);
const LOCAL_FRONTIER_COMPLETION_SPECIAL = new Set([...LOCAL_FRONTIER_COMPLETION_VERIFIED, ...LOCAL_FRONTIER_COMPLETION_EXTERNAL]);

const EVIDENCE = Object.freeze({
  decision: ['src/decision/acceptance-criteria-ledger.mjs','src/decision/decision-receipt-service.mjs','src/decision/decision-efficiency-metrics.mjs','src/decision/decision-plane.mjs','src/orchestration/verification-runner.mjs','src/security/verification-claim-guard.mjs','tests/acceptance-criteria-ledger.test.mjs','tests/decision-receipt-service.test.mjs','tests/decision-efficiency-metrics.test.mjs','tests/verification-criteria-binding.test.mjs','tests/decision-plane-app-wiring.test.mjs','tests/decision-efficiency-ui.test.mjs','docs/decision-efficiency-loop-measurement-2.20.0.json'],
  context: ['src/context/token-cost-adapter.mjs','src/context/evidence-card.mjs','src/context/context-utility-selector.mjs','src/context/context-escalation-controller.mjs','src/context/hybrid-evidence-retrieval-service.mjs','src/agent/context-orchestration-kernel.mjs','src/agent/agent-loop.mjs','tests/token-cost-adapter.test.mjs','tests/evidence-card.test.mjs','tests/context-utility-selector.test.mjs','tests/context-escalation-controller.test.mjs','tests/agent-loop-context-escalation.test.mjs','docs/decision-efficiency-loop-measurement-2.20.0.json'],
  resource: ['src/runtime/mission-process-ledger.mjs','src/runtime/mission-resource-fabric.mjs','tests/mission-process-ledger.test.mjs','tests/mission-resource-fabric.test.mjs','docs/mission-resource-fabric-measurement-2.19.0.json'],
  semantic: ['src/repository/embedding-provider.mjs','src/repository/embedding-model-pack.mjs','src/repository/onnx-code-embedding-provider.mjs','src/repository/quantized-vector-codec.mjs','src/repository/hybrid-code-reranker.mjs','src/repository/secure-semantic-index.mjs','src/repository/merkle-index.mjs','src/repository/repository-intelligence-fabric.mjs','tests/embedding-provider-registry.test.mjs','tests/onnx-code-embedding-provider.test.mjs','tests/quantized-vector-codec.test.mjs','tests/hybrid-code-reranker.test.mjs','tests/merkle-chunk-index.test.mjs','tests/repository-intelligence-fabric.test.mjs'],
  twin: ['src/repository/repository-digital-twin-service.mjs','src/repository/repository-intelligence-fabric.mjs','tests/repository-digital-twin-service.test.mjs','tests/repository-intelligence-fabric-app-wiring.test.mjs'],
  cognition: ['src/cognition/context-posterior-manager.mjs','src/cognition/hypothesis-population.mjs','src/cognition/epistemic-action-selector.mjs','src/cognition/structured-error-router.mjs','src/cognition/episodic-binder.mjs','src/cognition/agency-ledger.mjs','src/cognition/cognitive-policy-gates.mjs','src/cognition/cognitive-kernel.mjs','src/decision/decision-plane.mjs','src/agent/agent-loop.mjs','tests/context-posterior-manager.test.mjs','tests/hypothesis-population.test.mjs','tests/epistemic-action-selector.test.mjs','tests/structured-error-router.test.mjs','tests/episodic-binder.test.mjs','tests/agency-ledger.test.mjs','tests/cognitive-policy-gates.test.mjs','tests/cognitive-kernel.test.mjs','tests/cognitive-decision-plane-integration.test.mjs','tests/agent-loop-cognitive-mode.test.mjs'],
  polyglot: ['src/repository/language-capability-matrix.mjs','src/repository/grammar-pack-registry.mjs','src/repository/lsp-session-pool.mjs','src/repository/relationship-graph-fusion-service.mjs','src/repository/runtime-observation-store.mjs','src/repository/source-classifier.mjs','src/repository/framework-capability-registry.mjs','src/repository/architecture-drift-sentinel.mjs','src/repository/polyglot-intelligence-plane.mjs','tests/code-intelligence-v2.test.mjs','tests/relationship-graph-fusion-service.test.mjs','tests/runtime-observation-store.test.mjs','tests/architecture-drift-sentinel.test.mjs','tests/polyglot-intelligence-plane.test.mjs'],
  construction: ['src/construction/specification-compiler.mjs','src/construction/requirement-traceability-ledger.mjs','src/construction/invariant-ledger.mjs','src/construction/executable-plan-engine.mjs','src/construction/state-capsule-store.mjs','src/construction/prospective-obligation-ledger.mjs','src/construction/goal-conflict-resolver.mjs','src/construction/semantic-patch-analyzer.mjs','src/construction/dynamic-patch-budget.mjs','src/construction/test-impact-selector.mjs','src/construction/candidate-patch-selector.mjs','src/construction/completion-proof-builder.mjs','src/construction/construction-control-plane.mjs','src/decision/decision-plane.mjs','src/agent/agent-loop.mjs','tests/specification-compiler.test.mjs','tests/requirement-traceability-ledger.test.mjs','tests/invariant-ledger.test.mjs','tests/executable-plan-engine.test.mjs','tests/state-capsule-store.test.mjs','tests/prospective-obligation-ledger.test.mjs','tests/goal-conflict-resolver.test.mjs','tests/semantic-patch-analyzer.test.mjs','tests/dynamic-patch-budget.test.mjs','tests/test-impact-selector.test.mjs','tests/candidate-patch-selector.test.mjs','tests/completion-proof-builder.test.mjs','tests/construction-control-plane.test.mjs','tests/construction-decision-plane-integration.test.mjs','tests/agent-loop-construction-mode.test.mjs'],
  verification: ['src/verification/verification-pyramid-planner.mjs','src/verification/test-integrity-guard.mjs','src/verification/api-existence-gate.mjs','src/verification/adversarial-review-coordinator.mjs','src/verification/failure-injection-lab.mjs','src/verification/trajectory-confidence-calibrator.mjs','src/verification/semantic-completion-gate.mjs','src/verification/verification-control-plane.mjs','src/providers/verified-outcome-bandit.mjs','src/orchestration/verification-runner.mjs','src/construction/completion-proof-builder.mjs','tests/verification-pyramid-planner.test.mjs','tests/test-integrity-guard.test.mjs','tests/api-existence-gate.test.mjs','tests/adversarial-review-coordinator.test.mjs','tests/failure-injection-lab.test.mjs','tests/trajectory-confidence-calibrator.test.mjs','tests/verified-outcome-bandit.test.mjs','tests/verification-control-plane.test.mjs','tests/verification-runner-pyramid.test.mjs'],
  memoryOs: ['src/memory/memory-operating-system.mjs','src/memory/memory-policy-controller.mjs','src/memory/model-time-clock.mjs','src/memory/replay-scheduler.mjs','src/skills/compositional-skill-compiler.mjs','src/skills/skill-registry.mjs','src/skills/stability-plasticity-guard.mjs','src/runtime/memory-skill-resource-plane.mjs','tests/memory-operating-system.test.mjs','tests/memory-policy-controller.test.mjs','tests/replay-scheduler.test.mjs','tests/compositional-skill-compiler.test.mjs','tests/stability-plasticity-guard.test.mjs','tests/memory-skill-resource-plane.test.mjs'],
  resourceAdmission: ['src/runtime/resource-admission-controller.mjs','src/runtime/viability-region-controller.mjs','src/runtime/local-device-doctor.mjs','src/runtime/resource-lifecycle-coordinator.mjs','src/storage/content-addressed-artifact-store.mjs','src/runtime/mission-resource-fabric.mjs','tests/resource-admission-controller.test.mjs','tests/content-addressed-artifact-store.test.mjs','tests/memory-skill-resource-plane.test.mjs','tests/mission-resource-fabric.test.mjs'],
  collaboration: ['src/collaboration/shared-blackboard.mjs','src/collaboration/joint-commitment-ledger.mjs','src/collaboration/adaptive-topology-selector.mjs','src/collaboration/semantic-merge-analyzer.mjs','src/runtime/collaboration-experience-plane.mjs','tests/shared-blackboard.test.mjs','tests/joint-commitment-ledger.test.mjs','tests/adaptive-topology-selector.test.mjs','tests/semantic-merge-analyzer.test.mjs'],
  browserExperience: ['src/browser/deterministic-journey-replayer.mjs','src/browser/browser-injection-guard.mjs','src/experience/artifact-playback-service.mjs','tests/deterministic-journey-replayer.test.mjs','tests/browser-injection-guard.test.mjs','tests/artifact-playback-service.test.mjs'],
  uiIde: ['src/experience/review-queue-service.mjs','src/experience/mission-steering-service.mjs','ui/collaboration-experience-center.js','ui/collaboration-experience-center.css','extensions/vscode/src/mission-state.ts','extensions/vscode/src/client.ts','extensions/vscode/src/extension.ts','tests/collaboration-experience-ui.test.mjs','tests/vscode-mission-state-bridge.test.mjs','tests/collaboration-experience-http-api.test.mjs'],
  security: ['src/security/taint-analysis-engine.mjs','src/security/contextual-injection-detector.mjs','src/security/prompt-injection-quarantine.mjs','src/security/dependency-risk-intelligence.mjs','src/security/sbom-provenance-service.mjs','src/security/integrity-quarantine.mjs','src/security/exfiltration-guard.mjs','src/security/mission-capability-token-service.mjs','src/security/audit-hash-chain.mjs','src/security/protected-boundary-guard.mjs','src/security/sandbox-escape-adversarial-suite.mjs','src/verification/extended-failure-scenario-lab.mjs','tests/taint-analysis-engine.test.mjs','tests/contextual-injection-security.test.mjs','tests/supply-chain-security.test.mjs','tests/security-boundary-protection.test.mjs','tests/security-adversarial-runtime.test.mjs'],
  certification: ['src/benchmark/benchmark-schema.mjs','src/benchmark/comparability-contract.mjs','src/benchmark/contamination-guard.mjs','src/benchmark/benchmark-runner.mjs','src/benchmark/benchmark-scorer.mjs','src/benchmark/run-evidence-journal.mjs','src/benchmark/failure-taxonomy.mjs','src/benchmark/independent-attestation.mjs','src/benchmark/comparative-certification-service.mjs','tests/benchmark-comparability-contract.test.mjs','tests/benchmark-certified-evidence.test.mjs','tests/comparative-certification-service.test.mjs'],
  worldModel: ['src/world-model/world-model-registry.mjs','src/world-model/foresight-controller.mjs','src/world-model/counterfactual-simulator.mjs','src/world-model/simulation-receipt-ledger.mjs','src/runtime/world-development-plane.mjs','tests/world-model-portfolio.test.mjs','tests/counterfactual-simulator.test.mjs','tests/world-development-plane.test.mjs'],
  development: ['src/development/verified-self-model.mjs','src/development/developmental-goal-engine.mjs','src/development/developmental-stage-controller.mjs','src/runtime/world-development-plane.mjs','tests/verified-self-model.test.mjs','tests/developmental-learning.test.mjs','tests/world-development-plane.test.mjs'],
  repositoryTruthPlane: ['src/repository/repository-fact-ledger.mjs','src/repository/repository-truth-map-builder.mjs','src/repository/repository-evidence-query-planner.mjs','src/repository/repository-truth-viewer.mjs','src/repository/repository-workspace-state-adapter.mjs','src/repository/repository-digital-twin-service.mjs','src/repository/repository-intelligence-fabric.mjs','tests/repository-fact-ledger.test.mjs','tests/repository-truth-map-builder.test.mjs','tests/repository-evidence-query-planner.test.mjs','tests/repository-truth-viewer.test.mjs','tests/repository-truth-plane-integration.test.mjs','tests/repository-truth-plane-release-gate.test.mjs'],
  adaptiveLearningTrust: ['src/learning/task-feature-encoder.mjs','src/learning/held-out-policy-evaluator.mjs','src/learning/cohort-canary-governor.mjs','src/learning/strategy-policy-learner.mjs','src/learning/domain-trust-ledger.mjs','src/learning/model-switch-coordinator.mjs','src/learning/adaptive-learning-control-plane.mjs','src/development/teacher-challenge-lab.mjs','src/providers/adaptive-harness-lab.mjs','src/runtime/world-development-plane.mjs','tests/task-feature-held-out-evaluator.test.mjs','tests/cohort-canary-strategy-learning.test.mjs','tests/domain-trust-model-switch.test.mjs','tests/adaptive-learning-developmental-challenges.test.mjs','tests/adaptive-learning-trust-fabric-integration.test.mjs','tests/adaptive-learning-trust-fabric-release-gate.test.mjs'],
  constructionSafetyCompletion: ['src/construction/construction-contract-runtime.mjs','src/construction/semantic-change-safety-runtime.mjs','src/verification/independent-verification-runtime.mjs','src/cognition/causal-intervention-lab.mjs','src/world-model/counterfactual-change-runtime.mjs','src/construction/construction-control-plane.mjs','src/verification/verification-control-plane.mjs','src/cognition/cognitive-kernel.mjs','src/runtime/world-development-plane.mjs','tests/construction-contract-runtime.test.mjs','tests/semantic-change-safety-runtime.test.mjs','tests/independent-verification-runtime.test.mjs','tests/causal-counterfactual-runtime.test.mjs','tests/construction-safety-completion-integration.test.mjs','tests/construction-safety-completion-release-gate.test.mjs'],
  verifiedMissionRuntime: ['src/decision/verified-outcome-ledger.mjs','src/decision/correctness-first-objective.mjs','src/cognition/tool-effect-verifier.mjs','src/cognition/confidence-calibration-service.mjs','src/cognition/decision-state-machine.mjs','src/cognition/semantic-progress-detector.mjs','src/runtime/resource-attribution-ledger.mjs','src/runtime/disk-backed-raw-log.mjs','src/runtime/process-leak-reaper.mjs','src/runtime/verified-mission-runtime.mjs','src/decision/decision-plane.mjs','src/runtime/mission-resource-fabric.mjs','tests/verified-outcome-ledger.test.mjs','tests/correctness-first-objective.test.mjs','tests/tool-effect-verifier.test.mjs','tests/confidence-calibration-service.test.mjs','tests/decision-state-machine.test.mjs','tests/semantic-progress-detector.test.mjs','tests/resource-attribution-ledger.test.mjs','tests/disk-backed-raw-log.test.mjs','tests/process-leak-reaper.test.mjs','tests/verified-mission-runtime.test.mjs','tests/verified-mission-runtime-integration.test.mjs','tests/verified-mission-runtime-release-gate.test.mjs'],
  intelligenceCompletion: ['src/intelligence-completion/context-learning-kernel.mjs','src/intelligence-completion/paged-vector-store.mjs','src/intelligence-completion/repository-intelligence-completion-service.mjs','src/intelligence-completion/program-analysis-kernel.mjs','src/intelligence-completion/variable-lineage-service.mjs','src/intelligence-completion/counterfactual-patch-ablator.mjs','src/repository/repository-intelligence-fabric.mjs','tests/context-learning-kernel.test.mjs','tests/paged-vector-store.test.mjs','tests/repository-intelligence-completion-service.test.mjs','tests/program-analysis-kernel.test.mjs','tests/variable-lineage-service.test.mjs','tests/counterfactual-patch-ablator.test.mjs','tests/repository-intelligence-completion-fabric.test.mjs','tests/intelligence-completion-release-gate.test.mjs'],
  localFrontierCompletion: ['src/frontier-completion/harness-bpe-tokenizer.mjs','src/frontier-completion/context-cache-coherence.mjs','src/frontier-completion/semantic-index-runtime.mjs','src/frontier-completion/polyglot-evidence-runtime.mjs','src/frontier-completion/memory-resource-collaboration-runtime.mjs','src/frontier-completion/product-security-experience-runtime.mjs','src/frontier-completion/reproducible-benchmark-pack.mjs','src/frontier-completion/local-frontier-completion-plane.mjs','src/decision/decision-plane.mjs','ui/local-frontier-work-surface.js','ui/local-frontier-work-surface.css','benchmark/frontier/public-suite.json','benchmark/frontier/private-held-out.enc.json','tests/local-frontier-context-semantic.test.mjs','tests/local-frontier-polyglot-evidence.test.mjs','tests/local-frontier-memory-resource-collaboration.test.mjs','tests/local-frontier-product-security-experience.test.mjs','tests/local-frontier-benchmark-pack.test.mjs','tests/local-frontier-completion-plane.test.mjs','tests/local-frontier-completion-release-gate.test.mjs'],
  frontier: ['src/frontier/cross-repository-workspace-map.mjs','src/frontier/transactional-change-planner.mjs','src/frontier/synchronized-commit-chain.mjs','src/frontier/post-merge-sentinel.mjs','src/frontier/change-survival-ledger.mjs','src/frontier/self-healing-coordinator.mjs','src/frontier/cultural-lineage-ledger.mjs','src/frontier/self-improvement-constitution.mjs','src/runtime/frontier-governance-plane.mjs','tests/cross-repository-workspace-map.test.mjs','tests/transactional-change-planner.test.mjs','tests/synchronized-commit-chain.test.mjs','tests/post-merge-sentinel.test.mjs','tests/change-survival-ledger.test.mjs','tests/self-healing-coordinator.test.mjs','tests/cultural-lineage-ledger.test.mjs','tests/self-improvement-constitution.test.mjs','tests/frontier-governance-plane.test.mjs'],

});

function releaseAtLeast(version, minor) {
  const match = /^(\d+)\.(\d+)\./.exec(version);
  if (!match) return false;
  const major = Number(match[1]);
  const releaseMinor = Number(match[2]);
  return major > 2 || (major === 2 && releaseMinor >= minor);
}
function releaseAtLeastThree(version) { return /^(?:[3-9]|[1-9]\d+)\./.test(version); }
function releaseAtLeastThreeOne(version) { const match = /^(\d+)\.(\d+)\./.exec(version); return Boolean(match) && (Number(match[1]) > 3 || (Number(match[1]) === 3 && Number(match[2]) >= 1)); }
function releaseAtLeastThreeTwo(version) { const match = /^(\d+)\.(\d+)\./.exec(version); return Boolean(match) && (Number(match[1]) > 3 || (Number(match[1]) === 3 && Number(match[2]) >= 2)); }
function releaseAtLeastThreeThree(version) { const match = /^(\d+)\.(\d+)\./.exec(version); return Boolean(match) && (Number(match[1]) > 3 || (Number(match[1]) === 3 && Number(match[2]) >= 3)); }
function releaseAtLeastThreeFour(version) { const match = /^(\d+)\.(\d+)\./.exec(version); return Boolean(match) && (Number(match[1]) > 3 || (Number(match[1]) === 3 && Number(match[2]) >= 4)); }
function releaseAtLeastThreeFive(version) { const match = /^(\d+)\.(\d+)\./.exec(version); return Boolean(match) && (Number(match[1]) > 3 || (Number(match[1]) === 3 && Number(match[2]) >= 5)); }
function releaseAtLeastFour(version) { const match = /^(\d+)\.(\d+)\./.exec(version); return Boolean(match) && Number(match[1]) >= 4; }
function evidence(id, version) {
  if (LOCAL_FRONTIER_COMPLETION_SPECIAL.has(id) && releaseAtLeastFour(version)) return [...EVIDENCE.localFrontierCompletion, `docs/local-frontier-completion-measurement-${version}.json`];
  if (ADAPTIVE_LEARNING_TRUST_VERIFIED.has(id) && releaseAtLeastThreeFive(version)) return [...EVIDENCE.adaptiveLearningTrust, `docs/adaptive-learning-trust-fabric-measurement-${version}.json`];
  if (CONSTRUCTION_SAFETY_COMPLETION_VERIFIED.has(id) && releaseAtLeastThreeFour(version)) return [...EVIDENCE.constructionSafetyCompletion, `docs/construction-safety-completion-measurement-${version}.json`];
  if (REPOSITORY_TRUTH_PLANE_VERIFIED.has(id) && releaseAtLeastThreeThree(version)) return [...EVIDENCE.repositoryTruthPlane, `docs/repository-truth-plane-measurement-${version}.json`];
  if (VERIFIED_MISSION_RUNTIME_VERIFIED.has(id) && releaseAtLeastThreeTwo(version)) return [...EVIDENCE.verifiedMissionRuntime, `docs/verified-mission-runtime-measurement-${version}.json`];
  if (INTELLIGENCE_COMPLETION_VERIFIED.has(id) && releaseAtLeastThreeOne(version)) return [...EVIDENCE.intelligenceCompletion, `docs/intelligence-completion-measurement-${version}.json`];
  if (FRONTIER_SPECIAL.has(id)) return [...EVIDENCE.frontier, `docs/frontier-governance-measurement-${version}.json`];
  if (id === '29.9') return EVIDENCE.resource;
  if (id.startsWith('30.')) return EVIDENCE.context;
  if (id.startsWith('31.')) return [...EVIDENCE.semantic, `docs/repository-intelligence-fabric-measurement-${version}.json`];
  if (id.startsWith('35.') || id.startsWith('36.')) return [...EVIDENCE.construction, `docs/long-horizon-construction-measurement-${version}.json`];
  if (id.startsWith('37.') || id.startsWith('38.')) return [...EVIDENCE.verification, `docs/verification-learned-routing-measurement-${version}.json`];
  if (id.startsWith('39.')) return [...EVIDENCE.memoryOs, `docs/memory-skill-resource-os-measurement-${version}.json`];
  if (id.startsWith('40.')) return [...EVIDENCE.resourceAdmission, `docs/memory-skill-resource-os-measurement-${version}.json`];
  if (id.startsWith('41.')) return [...EVIDENCE.collaboration, `docs/collaboration-experience-measurement-${version}.json`];
  if (id.startsWith('42.')) return [...EVIDENCE.browserExperience, `docs/collaboration-experience-measurement-${version}.json`];
  if (id.startsWith('44.')) return [...EVIDENCE.uiIde, `docs/collaboration-experience-measurement-${version}.json`];
  if (id.startsWith('43.')) return [...EVIDENCE.security, `docs/security-certification-measurement-${version}.json`];
  if (id.startsWith('45.')) return [...EVIDENCE.certification, `docs/security-certification-measurement-${version}.json`];
  if (id.startsWith('46.')) return [...EVIDENCE.worldModel, `docs/world-development-measurement-${version}.json`];
  if (id.startsWith('47.')) return [...EVIDENCE.development, `docs/world-development-measurement-${version}.json`];
  if (id.startsWith('34.')) return [...EVIDENCE.cognition, `docs/cognitive-decision-kernel-measurement-${version}.json`];
  if (id.startsWith('33.') || id === '32.10' || id === '32.14') return [...EVIDENCE.polyglot, `docs/polyglot-runtime-intelligence-measurement-${version}.json`];
  if (id.startsWith('32.')) return [...EVIDENCE.twin, `docs/repository-intelligence-fabric-measurement-${version}.json`];
  return EVIDENCE.decision;
}
function counts(items) {
  const out = { verified_source_test: 0, partial: 0, external_gate: 0, not_implemented: 0 };
  for (const item of items) out[item.status] = (out[item.status] ?? 0) + 1;
  return out;
}
function classify(id, version) {
  if (releaseAtLeastFour(version) && LOCAL_FRONTIER_COMPLETION_EXTERNAL.has(id)) return 'external_gate';
  if (releaseAtLeastFour(version) && LOCAL_FRONTIER_COMPLETION_VERIFIED.has(id)) return 'verified_source_test';
  if (releaseAtLeastThreeFive(version) && ADAPTIVE_LEARNING_TRUST_VERIFIED.has(id)) return 'verified_source_test';
  if (releaseAtLeastThreeFour(version) && CONSTRUCTION_SAFETY_COMPLETION_VERIFIED.has(id)) return 'verified_source_test';
  if (releaseAtLeastThreeThree(version) && REPOSITORY_TRUTH_PLANE_VERIFIED.has(id)) return 'verified_source_test';
  if (releaseAtLeastThreeTwo(version) && VERIFIED_MISSION_RUNTIME_VERIFIED.has(id)) return 'verified_source_test';
  if (releaseAtLeastThreeOne(version) && INTELLIGENCE_COMPLETION_VERIFIED.has(id)) return 'verified_source_test';
  if (DECISION_VERIFIED.has(id)) return 'verified_source_test';
  if (DECISION_PARTIAL.has(id)) return 'partial';
  if (releaseAtLeast(version, 21) && INTELLIGENCE_VERIFIED.has(id)) return 'verified_source_test';
  if (releaseAtLeast(version, 21) && INTELLIGENCE_PARTIAL.has(id)) return 'partial';
  if (releaseAtLeast(version, 22) && POLYGLOT_VERIFIED.has(id)) return 'verified_source_test';
  if (releaseAtLeast(version, 22) && POLYGLOT_PARTIAL.has(id)) return 'partial';
  if (releaseAtLeast(version, 23) && COGNITION_VERIFIED.has(id)) return 'verified_source_test';
  if (releaseAtLeast(version, 23) && COGNITION_PARTIAL.has(id)) return 'partial';
  if (releaseAtLeast(version, 24) && CONSTRUCTION_VERIFIED.has(id)) return 'verified_source_test';
  if (releaseAtLeast(version, 24) && CONSTRUCTION_PARTIAL.has(id)) return 'partial';
  if (releaseAtLeast(version, 25) && VERIFICATION_VERIFIED.has(id)) return 'verified_source_test';
  if (releaseAtLeast(version, 25) && VERIFICATION_PARTIAL.has(id)) return 'partial';
  if (releaseAtLeast(version, 25) && ROUTING_VERIFIED.has(id)) return 'verified_source_test';
  if (releaseAtLeast(version, 25) && ROUTING_PARTIAL.has(id)) return 'partial';
  if (releaseAtLeast(version, 26) && MEMORY_OS_VERIFIED.has(id)) return 'verified_source_test';
  if (releaseAtLeast(version, 26) && MEMORY_OS_PARTIAL.has(id)) return 'partial';
  if (releaseAtLeast(version, 26) && RESOURCE_ADMISSION_VERIFIED.has(id)) return 'verified_source_test';
  if (releaseAtLeast(version, 26) && RESOURCE_ADMISSION_PARTIAL.has(id)) return 'partial';
  if (releaseAtLeast(version, 27) && COLLABORATION_VERIFIED.has(id)) return 'verified_source_test';
  if (releaseAtLeast(version, 27) && COLLABORATION_PARTIAL.has(id)) return 'partial';
  if (releaseAtLeast(version, 27) && BROWSER_EXPERIENCE_VERIFIED.has(id)) return 'verified_source_test';
  if (releaseAtLeast(version, 27) && BROWSER_EXPERIENCE_PARTIAL.has(id)) return 'partial';
  if (releaseAtLeast(version, 27) && UI_IDE_VERIFIED.has(id)) return 'verified_source_test';
  if (releaseAtLeast(version, 27) && UI_IDE_PARTIAL.has(id)) return 'partial';
  if (releaseAtLeast(version, 28) && SECURITY_VERIFIED.has(id)) return 'verified_source_test';
  if (releaseAtLeast(version, 28) && SECURITY_PARTIAL.has(id)) return 'partial';
  if (releaseAtLeast(version, 28) && CERTIFICATION_VERIFIED.has(id)) return 'verified_source_test';
  if (releaseAtLeast(version, 28) && CERTIFICATION_PARTIAL.has(id)) return 'partial';
  if (releaseAtLeast(version, 28) && CERTIFICATION_EXTERNAL.has(id)) return 'external_gate';
  if (releaseAtLeast(version, 29) && WORLD_MODEL_VERIFIED.has(id)) return 'verified_source_test';
  if (releaseAtLeast(version, 29) && WORLD_MODEL_PARTIAL.has(id)) return 'partial';
  if (releaseAtLeast(version, 29) && DEVELOPMENT_VERIFIED.has(id)) return 'verified_source_test';
  if (releaseAtLeast(version, 29) && DEVELOPMENT_PARTIAL.has(id)) return 'partial';
  if (releaseAtLeastThree(version) && FRONTIER_VERIFIED.has(id)) return 'verified_source_test';
  if (releaseAtLeastThree(version) && FRONTIER_PARTIAL.has(id)) return 'partial';
  if (releaseAtLeastThree(version) && FRONTIER_EXTERNAL.has(id)) return 'external_gate';
  return 'not_implemented';
}
function note(status, id, version, originalNote) {
  if (status === 'verified_source_test') {
    const release = LOCAL_FRONTIER_COMPLETION_VERIFIED.has(id) && releaseAtLeastFour(version) ? '4.0.0' : ADAPTIVE_LEARNING_TRUST_VERIFIED.has(id) && releaseAtLeastThreeFive(version) ? '3.5.0' : CONSTRUCTION_SAFETY_COMPLETION_VERIFIED.has(id) && releaseAtLeastThreeFour(version) ? '3.4.0' : REPOSITORY_TRUTH_PLANE_VERIFIED.has(id) && releaseAtLeastThreeThree(version) ? '3.3.0' : VERIFIED_MISSION_RUNTIME_VERIFIED.has(id) && releaseAtLeastThreeTwo(version) ? '3.2.0' : INTELLIGENCE_COMPLETION_VERIFIED.has(id) && releaseAtLeastThreeOne(version) ? '3.1.0' : FRONTIER_VERIFIED.has(id) ? '3.0.0' : id.startsWith('46.') || id.startsWith('47.') ? '2.29.0' : id.startsWith('43.') || id.startsWith('45.') ? '2.28.0' : id.startsWith('41.') || id.startsWith('42.') || id.startsWith('44.') ? '2.27.0' : id.startsWith('39.') || id.startsWith('40.') ? '2.26.0' : id.startsWith('37.') || id.startsWith('38.') ? '2.25.0' : id.startsWith('35.') || id.startsWith('36.') ? '2.24.0' : id.startsWith('34.') ? '2.23.0' : id.startsWith('33.') || id === '32.14' ? '2.22.0' : id.startsWith('31.') || id.startsWith('32.') ? '2.21.0' : '2.20.0';
    return `Có source, test trực tiếp và measurement/release-gate trong ${release}; không suy rộng thành benchmark vượt đối thủ.`;
  }
  if (status === 'partial') {
    if (id === '31.2') return 'Có contract lazy cho ONNX INT8, integrity/model digest và test bằng runtime adapter; Core chưa đóng gói hoặc vận hành model ONNX production nên yêu cầu vẫn partial.';
    return `Có một phần hành vi và test liên quan trong ${version}, nhưng acceptance criteria frontier đầy đủ chưa được đóng nên chưa được tính hoàn thành.`;
  }
  if (status === 'external_gate' && LOCAL_FRONTIER_COMPLETION_EXTERNAL.has(id) && releaseAtLeastFour(version)) {
    if (id === '31.2') return 'Cần model ONNX INT8 production có license, tokenizer và digest được ký; source local chỉ chứng minh adapter và fail-closed contract.';
    if (['33.1','33.2','33.3','33.4'].includes(id)) return 'Cần grammar/tree-sitter/LSP production binary tương ứng ngôn ngữ và nền tảng; không đóng gói fixture giả để nâng trạng thái.';
    if (id === '45.3') return 'Cần runner đối thủ, cùng model/máy/token/time/permissions và attestation độc lập; không có artifact đó trong môi trường local.';
  }
  return originalNote;
}

function rebrandReleaseContent(value) {
  if (typeof value === 'string') return value.replaceAll('Forge Studio', 'Nolane Agent');
  if (Array.isArray(value)) return value.map(rebrandReleaseContent);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, rebrandReleaseContent(child)]));
}

const root = path.resolve(process.argv[2] ?? '.');
const version = String(process.argv[3] ?? '3.0.0');
const input = rebrandReleaseContent(JSON.parse(await readFile(path.join(root, 'docs/frontier-requirements-3.0.0.json'), 'utf8')));
const sections = input.sections.map((section) => {
  const items = section.items.map((original) => {
    if (Number(section.number) < 29) return original;
    const status = classify(original.id, version);
    return {
      ...original,
      status,
      evidence: status === 'not_implemented' ? [] : evidence(original.id, version),
      note: note(status, original.id, version, original.note),
    };
  });
  return { ...section, summary: counts(items), items };
});
const all = sections.flatMap((section) => section.items);
const releaseGates = ['decision-efficiency-loop', 'context-engine-v3'];
if (releaseAtLeast(version, 21)) releaseGates.push('repository-intelligence-fabric');
if (releaseAtLeast(version, 22)) releaseGates.push('polyglot-runtime-intelligence');
if (releaseAtLeast(version, 23)) releaseGates.push('cognitive-decision-kernel');
if (releaseAtLeast(version, 24)) releaseGates.push('long-horizon-construction');
if (releaseAtLeast(version, 25)) releaseGates.push('verification-learned-routing');
if (releaseAtLeast(version, 26)) releaseGates.push('memory-skill-os', 'resource-admission-control');
if (releaseAtLeast(version, 27)) releaseGates.push('multi-agent-collaboration', 'browser-experience-surface');
if (releaseAtLeast(version, 28)) releaseGates.push('security-resilience-supply-chain', 'comparative-certification-harness');
if (releaseAtLeast(version, 29)) releaseGates.push('world-model-portfolio', 'developmental-agent-learning');
if (releaseAtLeastThree(version)) releaseGates.push('frontier-safety-and-self-healing');
if (releaseAtLeastThreeTwo(version)) releaseGates.push('verified-mission-runtime');
if (releaseAtLeastThreeThree(version)) releaseGates.push('repository-truth-plane');
if (releaseAtLeastThreeFour(version)) releaseGates.push('construction-safety-completion');
if (releaseAtLeastThreeFive(version)) releaseGates.push('adaptive-learning-trust-fabric');
if (releaseAtLeastFour(version)) releaseGates.push('local-frontier-completion');
const audit = {
  ...input,
  schema: 'nolane.agent.feature-audit.frontier.v1',
  product: 'Nolane Agent',
  productVersion: version,
  baselineVersion: '2.19.0',
  generatedAt: '2026-07-30T23:15:00+07:00',
  summary: counts(all),
  totalItems: all.length,
  sections,
  governance: {
    ...input.governance,
    releaseGate: releaseGates.join(' + '),
    honestFrontierCounts: true,
  },
};
await writeFile(path.join(root, `docs/feature-audit-${version}.json`), `${JSON.stringify(audit, null, 2)}\n`);
const table = sections.map((section) => `| ${section.number} | ${section.title} | ${section.items.length} | ${section.summary.verified_source_test} | ${section.summary.partial} | ${section.summary.external_gate} | ${section.summary.not_implemented} |`).join('\n');
const completeness = `# Nolane Agent ${version} — Kiểm toán 1.150 yêu cầu\n\n- Tổng mục: **${audit.totalItems}**\n- Source + test: **${audit.summary.verified_source_test}**\n- Một phần: **${audit.summary.partial}**\n- External gate: **${audit.summary.external_gate}**\n- Chưa triển khai: **${audit.summary.not_implemented}**\n\n> Trạng thái chỉ được nâng khi có source, test trực tiếp và release evidence. Interface hoặc fixture giả không tự đóng claim production.\n\n| # | Nhóm | Tổng | Source + test | Một phần | External | Chưa có |\n|---:|---|---:|---:|---:|---:|---:|\n${table}\n`;
await writeFile(path.join(root, `docs/FEATURE-COMPLETENESS-AUDIT-${version}.md`), completeness);
const gapsReport = buildRemainingGapsReport(audit);
await writeFile(path.join(root, `docs/REMAINING-GAPS-${version}.md`), renderRemainingGapsMarkdown(gapsReport));
process.stdout.write(`${JSON.stringify({ version, totalItems: audit.totalItems, summary: audit.summary })}\n`);
