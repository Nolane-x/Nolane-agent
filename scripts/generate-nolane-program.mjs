#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyNolaneRuntimePurity } from './lib/nolane-runtime-purity-verifier.mjs';
import { REQUIREMENT_DEFINITIONS } from '../requirements/nolane-requirement-definitions.mjs';
import { validateCapabilityStatusRecord } from '../src/audit/capability-status-policy.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
async function writeJsonAtomic(file, value) {
  const target = path.resolve(file);
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  const content = `${JSON.stringify(value, null, 2)}
`;
  await writeFile(temporary, content, { flag: 'wx' });
  try { await rename(temporary, target); }
  finally { await rm(temporary, { force: true }).catch(() => {}); }
}
const VERIFIED_REQUIREMENTS = new Set([
  'NOL-BRAND-001', 'NOL-BRAND-002', 'NOL-BRAND-003', 'NOL-BRAND-004', 'NOL-BRAND-005', 'NOL-BRAND-006', 'NOL-BRAND-007', 'NOL-BRAND-008', 'NOL-BRAND-009', 'NOL-BRAND-010', 'NOL-BRAND-012', 'NOL-BRAND-013', 'NOL-BRAND-014', 'NOL-UI-001', 'NOL-UI-003', 'NOL-UI-004', 'NOL-UI-005', 'NOL-UI-006', 'NOL-UI-007', 'NOL-UI-008', 'NOL-UI-009',
  'NOL-UI-010', 'NOL-UI-011', 'NOL-UI-012', 'NOL-UI-013', 'NOL-UI-014', 'NOL-UI-015', 'NOL-UI-016', 'NOL-UI-017', 'NOL-UI-018', 'NOL-UI-019', 'NOL-UI-020', 'NOL-UI-021', 'NOL-UI-022', 'NOL-UI-023', 'NOL-UI-024', 'NOL-UI-025', 'NOL-UI-026', 'NOL-UI-027', 'NOL-UI-028', 'NOL-UI-029',
  'NOL-NOLANE_NATIVE-002', 'NOL-NOLANE_NATIVE-040', 'NOL-NOLANE_NATIVE-031', 'NOL-AUDIT-016', 'NOL-SMALL-DISTILL-01', 'NOL-SMALL-DISTILL-04', 'NOL-SMALL-DISTILL-06', 'NOL-SMALL-DISTILL-10', 'NOL-SMALL-DISTILL-12', 'NOL-SMALL-VERIFY-01', 'NOL-SMALL-VERIFY-02', 'NOL-SMALL-VERIFY-03', 'NOL-SMALL-VERIFY-04', 'NOL-SMALL-VERIFY-06', 'NOL-SMALL-VERIFY-08', 'NOL-SMALL-VERIFY-09', 'NOL-SMALL-VERIFY-10', 'NOL-SMALL-VERIFY-11', 'NOL-SMALL-VERIFY-12', 'NOL-SMALL-SPECIALIST-01', 'NOL-SMALL-SPECIALIST-02', 'NOL-SMALL-SPECIALIST-04', 'NOL-SMALL-SPECIALIST-07', 'NOL-SMALL-SPECIALIST-08', 'NOL-SMALL-SPECIALIST-11', 'NOL-SMALL-SPECIALIST-12', 'NOL-SMALL-COMPUTE-01', 'NOL-SMALL-COMPUTE-02', 'NOL-SMALL-COMPUTE-03', 'NOL-SMALL-COMPUTE-05', 'NOL-SMALL-COMPUTE-06', 'NOL-SMALL-COMPUTE-07', 'NOL-SMALL-COMPUTE-08', 'NOL-SMALL-COMPUTE-09', 'NOL-SMALL-COMPUTE-10', 'NOL-SMALL-COMPUTE-11',
  'NOL-NOLANE_NATIVE-001', 'NOL-NOLANE_NATIVE-003', 'NOL-NOLANE_NATIVE-004', 'NOL-NOLANE_NATIVE-005', 'NOL-NOLANE_NATIVE-006', 'NOL-NOLANE_NATIVE-007', 'NOL-NOLANE_NATIVE-008', 'NOL-NOLANE_NATIVE-009', 'NOL-NOLANE_NATIVE-012', 'NOL-NOLANE_NATIVE-017', 'NOL-NOLANE_NATIVE-018', 'NOL-NOLANE_NATIVE-019', 'NOL-NOLANE_NATIVE-020', 'NOL-NOLANE_NATIVE-021', 'NOL-NOLANE_NATIVE-022', 'NOL-NOLANE_NATIVE-024', 'NOL-NOLANE_NATIVE-013', 'NOL-NOLANE_NATIVE-014', 'NOL-NOLANE_NATIVE-015', 'NOL-NOLANE_NATIVE-023', 'NOL-NOLANE_NATIVE-034', 'NOL-NOLANE_NATIVE-035', 'NOL-NOLANE_NATIVE-036', 'NOL-AUDIT-001', 'NOL-AUDIT-002', 'NOL-AUDIT-005', 'NOL-AUDIT-006', 'NOL-AUDIT-007', 'NOL-AUDIT-008', 'NOL-AUDIT-004', 'NOL-AUDIT-010', 'NOL-AUDIT-011', 'NOL-AUDIT-003', 'NOL-AUDIT-009', 'NOL-AUDIT-014', 'NOL-AUDIT-015',
]);
const ALPHA4_EVIDENCE = Object.freeze({
  'NOL-SMALL-DISTILL-02': Object.freeze({ entrypoint: 'src/small-model/distillation-orchestrator.mjs', exactTest: 'tests/small-model-distillation-orchestrator.test.mjs' }),
  'NOL-SMALL-DISTILL-03': Object.freeze({ entrypoint: 'src/small-model/distillation-orchestrator.mjs', exactTest: 'tests/small-model-distillation-orchestrator.test.mjs' }),
  'NOL-SMALL-DISTILL-05': Object.freeze({ entrypoint: 'src/small-model/distillation-orchestrator.mjs', exactTest: 'tests/small-model-distillation-orchestrator.test.mjs' }),
  'NOL-SMALL-DISTILL-07': Object.freeze({ entrypoint: 'src/small-model/distillation-orchestrator.mjs', exactTest: 'tests/small-model-distillation-orchestrator.test.mjs' }),
  'NOL-SMALL-DISTILL-08': Object.freeze({ entrypoint: 'src/small-model/distillation-orchestrator.mjs', exactTest: 'tests/small-model-distillation-orchestrator.test.mjs' }),
  'NOL-SMALL-DISTILL-09': Object.freeze({ entrypoint: 'src/small-model/distillation-orchestrator.mjs', exactTest: 'tests/small-model-distillation-orchestrator.test.mjs' }),
  'NOL-SMALL-DISTILL-11': Object.freeze({ entrypoint: 'src/small-model/distillation-orchestrator.mjs', exactTest: 'tests/small-model-distillation-orchestrator.test.mjs' }),
  'NOL-SMALL-VERIFY-05': Object.freeze({ entrypoint: 'src/small-model/hidden-verification-suite.mjs', exactTest: 'tests/small-model-hidden-verification.test.mjs' }),
  'NOL-SMALL-VERIFY-07': Object.freeze({ entrypoint: 'src/small-model/verifier-red-team.mjs', exactTest: 'tests/small-model-hidden-verification.test.mjs' }),
  'NOL-SMALL-RECURSIVE-01': Object.freeze({ entrypoint: 'src/small-model/recursive-policy-sidecar.mjs', exactTest: 'tests/small-model-recursive-policy.test.mjs' }),
  'NOL-SMALL-RECURSIVE-02': Object.freeze({ entrypoint: 'src/small-model/recursive-policy-sidecar.mjs', exactTest: 'tests/small-model-recursive-policy.test.mjs' }),
  'NOL-SMALL-RECURSIVE-03': Object.freeze({ entrypoint: 'src/small-model/recursive-policy-sidecar.mjs', exactTest: 'tests/small-model-recursive-policy.test.mjs' }),
  'NOL-SMALL-RECURSIVE-04': Object.freeze({ entrypoint: 'src/small-model/recursive-policy-sidecar.mjs', exactTest: 'tests/small-model-recursive-policy.test.mjs' }),
  'NOL-SMALL-RECURSIVE-07': Object.freeze({ entrypoint: 'src/small-model/recursive-graph-solver-pack.mjs', exactTest: 'tests/small-model-recursive-policy.test.mjs' }),
  'NOL-SMALL-RECURSIVE-08': Object.freeze({ entrypoint: 'src/small-model/recursive-policy-sidecar.mjs', exactTest: 'tests/small-model-recursive-policy.test.mjs' }),
  'NOL-SMALL-RECURSIVE-09': Object.freeze({ entrypoint: 'src/small-model/recursive-policy-sidecar.mjs', exactTest: 'tests/small-model-recursive-policy.test.mjs' }),
  'NOL-SMALL-RECURSIVE-10': Object.freeze({ entrypoint: 'src/small-model/recursive-policy-sidecar.mjs', exactTest: 'tests/small-model-recursive-policy.test.mjs' }),
  'NOL-SMALL-RECURSIVE-12': Object.freeze({ entrypoint: 'src/small-model/recursive-graph-solver-pack.mjs', exactTest: 'tests/small-model-recursive-policy.test.mjs' }),
  'NOL-SMALL-SYMBOLIC-01': Object.freeze({ entrypoint: 'src/small-model/symbolic-solver-compiler.mjs', exactTest: 'tests/small-model-symbolic-solver.test.mjs' }),
  'NOL-SMALL-SYMBOLIC-02': Object.freeze({ entrypoint: 'src/small-model/symbolic-solver-compiler.mjs', exactTest: 'tests/small-model-symbolic-solver.test.mjs' }),
  'NOL-SMALL-SYMBOLIC-05': Object.freeze({ entrypoint: 'src/small-model/symbolic-solver-compiler.mjs', exactTest: 'tests/small-model-symbolic-solver.test.mjs' }),
  'NOL-SMALL-SYMBOLIC-06': Object.freeze({ entrypoint: 'src/small-model/symbolic-solver-compiler.mjs', exactTest: 'tests/small-model-symbolic-solver.test.mjs' }),
  'NOL-SMALL-SYMBOLIC-07': Object.freeze({ entrypoint: 'src/small-model/symbolic-solver-compiler.mjs', exactTest: 'tests/small-model-symbolic-solver.test.mjs' }),
  'NOL-SMALL-SYMBOLIC-08': Object.freeze({ entrypoint: 'src/small-model/symbolic-solver-compiler.mjs', exactTest: 'tests/small-model-symbolic-solver.test.mjs' }),
  'NOL-SMALL-SYMBOLIC-09': Object.freeze({ entrypoint: 'src/small-model/solver-sandbox.mjs', exactTest: 'tests/small-model-symbolic-solver.test.mjs' }),
  'NOL-SMALL-SYMBOLIC-10': Object.freeze({ entrypoint: 'src/small-model/symbolic-solver-compiler.mjs', exactTest: 'tests/small-model-symbolic-solver.test.mjs' }),
  'NOL-SMALL-SYMBOLIC-11': Object.freeze({ entrypoint: 'src/small-model/symbolic-solver-compiler.mjs', exactTest: 'tests/small-model-symbolic-solver.test.mjs' }),
  'NOL-SMALL-SYMBOLIC-12': Object.freeze({ entrypoint: 'src/small-model/symbolic-solver-compiler.mjs', exactTest: 'tests/small-model-symbolic-solver.test.mjs' }),
  'NOL-SMALL-SPECIALIST-03': Object.freeze({ entrypoint: 'src/small-model/specialist-model-fabric.mjs', exactTest: 'tests/small-model-specialist-alpha4.test.mjs' }),
  'NOL-SMALL-SPECIALIST-09': Object.freeze({ entrypoint: 'src/small-model/model-state-serializer.mjs', exactTest: 'tests/small-model-specialist-alpha4.test.mjs' }),
  'NOL-SMALL-SPECIALIST-10': Object.freeze({ entrypoint: 'src/small-model/specialist-model-fabric.mjs', exactTest: 'tests/small-model-specialist-alpha4.test.mjs' }),
  'NOL-SMALL-PLASTICITY-01': Object.freeze({ entrypoint: 'src/small-model/plasticity-plane.mjs', exactTest: 'tests/small-model-plasticity-plane.test.mjs' }),
  'NOL-SMALL-PLASTICITY-02': Object.freeze({ entrypoint: 'src/small-model/plasticity-plane.mjs', exactTest: 'tests/small-model-plasticity-plane.test.mjs' }),
  'NOL-SMALL-PLASTICITY-03': Object.freeze({ entrypoint: 'src/small-model/plasticity-plane.mjs', exactTest: 'tests/small-model-plasticity-plane.test.mjs' }),
  'NOL-SMALL-PLASTICITY-04': Object.freeze({ entrypoint: 'src/small-model/plasticity-plane.mjs', exactTest: 'tests/small-model-plasticity-plane.test.mjs' }),
  'NOL-SMALL-PLASTICITY-06': Object.freeze({ entrypoint: 'src/small-model/plasticity-plane.mjs', exactTest: 'tests/small-model-plasticity-plane.test.mjs' }),
  'NOL-SMALL-PLASTICITY-07': Object.freeze({ entrypoint: 'src/small-model/plasticity-plane.mjs', exactTest: 'tests/small-model-plasticity-plane.test.mjs' }),
  'NOL-SMALL-PLASTICITY-08': Object.freeze({ entrypoint: 'src/small-model/plasticity-plane.mjs', exactTest: 'tests/small-model-plasticity-plane.test.mjs' }),
  'NOL-SMALL-PLASTICITY-10': Object.freeze({ entrypoint: 'src/small-model/plasticity-plane.mjs', exactTest: 'tests/small-model-plasticity-plane.test.mjs' }),
  'NOL-SMALL-PLASTICITY-11': Object.freeze({ entrypoint: 'src/small-model/plasticity-plane.mjs', exactTest: 'tests/small-model-plasticity-plane.test.mjs' }),
  'NOL-SMALL-PLASTICITY-12': Object.freeze({ entrypoint: 'src/small-model/plasticity-plane.mjs', exactTest: 'tests/small-model-plasticity-plane.test.mjs' }),
  'NOL-SMALL-CURRICULUM-01': Object.freeze({ entrypoint: 'src/small-model/curriculum-factory.mjs', exactTest: 'tests/small-model-curriculum-factory.test.mjs' }),
  'NOL-SMALL-CURRICULUM-02': Object.freeze({ entrypoint: 'src/small-model/curriculum-factory.mjs', exactTest: 'tests/small-model-curriculum-factory.test.mjs' }),
  'NOL-SMALL-CURRICULUM-03': Object.freeze({ entrypoint: 'src/small-model/curriculum-factory.mjs', exactTest: 'tests/small-model-curriculum-factory.test.mjs' }),
  'NOL-SMALL-CURRICULUM-04': Object.freeze({ entrypoint: 'src/small-model/curriculum-factory.mjs', exactTest: 'tests/small-model-curriculum-factory.test.mjs' }),
  'NOL-SMALL-CURRICULUM-05': Object.freeze({ entrypoint: 'src/small-model/curriculum-factory.mjs', exactTest: 'tests/small-model-curriculum-factory.test.mjs' }),
  'NOL-SMALL-CURRICULUM-06': Object.freeze({ entrypoint: 'src/small-model/curriculum-factory.mjs', exactTest: 'tests/small-model-curriculum-factory.test.mjs' }),
  'NOL-SMALL-CURRICULUM-07': Object.freeze({ entrypoint: 'src/small-model/curriculum-factory.mjs', exactTest: 'tests/small-model-curriculum-factory.test.mjs' }),
  'NOL-SMALL-CURRICULUM-08': Object.freeze({ entrypoint: 'src/small-model/curriculum-factory.mjs', exactTest: 'tests/small-model-curriculum-factory.test.mjs' }),
  'NOL-SMALL-CURRICULUM-09': Object.freeze({ entrypoint: 'src/small-model/curriculum-factory.mjs', exactTest: 'tests/small-model-curriculum-factory.test.mjs' }),
  'NOL-SMALL-CURRICULUM-10': Object.freeze({ entrypoint: 'src/small-model/curriculum-factory.mjs', exactTest: 'tests/small-model-curriculum-factory.test.mjs' }),
  'NOL-SMALL-CURRICULUM-11': Object.freeze({ entrypoint: 'src/small-model/curriculum-factory.mjs', exactTest: 'tests/small-model-curriculum-factory.test.mjs' }),
  'NOL-SMALL-CURRICULUM-12': Object.freeze({ entrypoint: 'src/small-model/curriculum-factory.mjs', exactTest: 'tests/small-model-curriculum-factory.test.mjs' }),
  'NOL-SMALL-COMPUTE-04': Object.freeze({ entrypoint: 'src/small-model/adaptive-compute-governor.mjs', exactTest: 'tests/small-model-compute-calibration.test.mjs' }),
  'NOL-NOLANE_NATIVE-025': Object.freeze({ entrypoint: 'cli/nolane-agent.mjs', exactTest: 'tests/client-sdk-cli.test.mjs' }),
  'NOL-NOLANE_NATIVE-027': Object.freeze({ entrypoint: 'src/nolane-native/operational-boundary-service.mjs', exactTest: 'tests/nolane-native-operational-boundaries.test.mjs' }),
  'NOL-NOLANE_NATIVE-028': Object.freeze({ entrypoint: 'src/nolane-native/operational-boundary-service.mjs', exactTest: 'tests/nolane-native-operational-boundaries.test.mjs' }),
  'NOL-NOLANE_NATIVE-032': Object.freeze({ entrypoint: 'src/security/secret-access-service.mjs', exactTest: 'tests/secret-access-service.test.mjs' }),
  'NOL-NOLANE_NATIVE-033': Object.freeze({ entrypoint: 'src/nolane-native/operational-boundary-service.mjs', exactTest: 'tests/nolane-native-operational-boundaries.test.mjs' }),
  'NOL-NOLANE_NATIVE-037': Object.freeze({ entrypoint: 'src/nolane-native/operational-boundary-service.mjs', exactTest: 'tests/nolane-native-differential-contract.test.mjs' }),
  'NOL-NOLANE_NATIVE-038': Object.freeze({ entrypoint: 'src/release/clean-room-certification.mjs', exactTest: 'tests/clean-room-certification.test.mjs' }),
  'NOL-NOLANE_NATIVE-039': Object.freeze({ entrypoint: 'THIRD_PARTY_NOTICES.md', exactTest: 'tests/nolane-native-differential-contract.test.mjs' }),
  'NOL-AUDIT-013': Object.freeze({ entrypoint: 'src/release/dependency-preflight-service.mjs', exactTest: 'tests/nolane-native-operational-boundaries.test.mjs' }),
});
for (const id of Object.keys(ALPHA4_EVIDENCE)) VERIFIED_REQUIREMENTS.add(id);

const ALPHA5_EVIDENCE = Object.freeze({
  'NOL-BRAND-011': Object.freeze({ entrypoint: 'src/branding/brand-migration-auditor.mjs', exactTest: 'tests/brand-migration-alpha5.test.mjs' }),
  'NOL-NOLANE_NATIVE-010': Object.freeze({ entrypoint: 'src/nolane-native/web-browser-tools.mjs', exactTest: 'tests/nolane-native-capability-pack.test.mjs' }),
  'NOL-NOLANE_NATIVE-011': Object.freeze({ entrypoint: 'src/nolane-native/code-notebook-tools.mjs', exactTest: 'tests/nolane-native-capability-pack.test.mjs' }),
  'NOL-NOLANE_NATIVE-016': Object.freeze({ entrypoint: 'src/nolane-native/cross-session-memory.mjs', exactTest: 'tests/nolane-native-capability-pack.test.mjs' }),
  'NOL-NOLANE_NATIVE-026': Object.freeze({ entrypoint: 'src/nolane-native/terminal-ui.mjs', exactTest: 'tests/nolane-native-capability-pack.test.mjs' }),
  'NOL-NOLANE_NATIVE-029': Object.freeze({ entrypoint: 'src/nolane-native/media-provider-registry.mjs', exactTest: 'tests/nolane-native-capability-pack.test.mjs' }),
  'NOL-NOLANE_NATIVE-030': Object.freeze({ entrypoint: 'src/nolane-native/audio-provider-registry.mjs', exactTest: 'tests/nolane-native-capability-pack.test.mjs' }),
  'NOL-SMALL-RECURSIVE-05': Object.freeze({ entrypoint: 'src/small-model/scientific-benchmark-harness.mjs', exactTest: 'tests/small-model-scientific-benchmark.test.mjs' }),
  'NOL-SMALL-RECURSIVE-06': Object.freeze({ entrypoint: 'src/small-model/scientific-benchmark-harness.mjs', exactTest: 'tests/small-model-scientific-benchmark.test.mjs' }),
  'NOL-SMALL-RECURSIVE-11': Object.freeze({ entrypoint: 'src/small-model/scientific-benchmark-harness.mjs', exactTest: 'tests/small-model-scientific-benchmark.test.mjs' }),
  'NOL-SMALL-SYMBOLIC-03': Object.freeze({ entrypoint: 'src/small-model/ast-codemod-engine.mjs', exactTest: 'tests/small-model-symbolic-alpha5.test.mjs' }),
  'NOL-SMALL-SYMBOLIC-04': Object.freeze({ entrypoint: 'src/small-model/constraint-adapters.mjs', exactTest: 'tests/small-model-symbolic-alpha5.test.mjs' }),
  'NOL-SMALL-SPECIALIST-05': Object.freeze({ entrypoint: 'src/small-model/specialist-model-fabric.mjs', exactTest: 'tests/small-model-specialist-alpha5.test.mjs' }),
  'NOL-SMALL-SPECIALIST-06': Object.freeze({ entrypoint: 'src/small-model/multi-agent-policy-distiller.mjs', exactTest: 'tests/small-model-specialist-alpha5.test.mjs' }),
  'NOL-SMALL-PLASTICITY-05': Object.freeze({ entrypoint: 'src/small-model/adaptation-policy-learner.mjs', exactTest: 'tests/small-model-plasticity-alpha5.test.mjs' }),
  'NOL-SMALL-PLASTICITY-09': Object.freeze({ entrypoint: 'src/small-model/latent-memory-router.mjs', exactTest: 'tests/small-model-plasticity-alpha5.test.mjs' }),
  'NOL-SMALL-COMPUTE-12': Object.freeze({ entrypoint: 'src/small-model/scientific-benchmark-harness.mjs', exactTest: 'tests/small-model-scientific-benchmark.test.mjs' }),
});
for (const id of Object.keys(ALPHA5_EVIDENCE)) VERIFIED_REQUIREMENTS.add(id);

const IMPLEMENTED_NOT_WIRED_REQUIREMENTS = new Set([
]);

const EXTERNAL_GATE_REQUIREMENTS = new Set([
  'NOL-UI-002', 'NOL-UI-030', 'NOL-UI-031', 'NOL-UI-032', 'NOL-AUDIT-012',
]);

const EXTERNAL_GATE_EVIDENCE = Object.freeze({
  'NOL-UI-002': Object.freeze({ entrypoint: 'src/superiority/deep/local-ui-certification-lab.mjs', exactTest: 'tests/deep-superiority-ui-dogfood.test.mjs' }),
  'NOL-UI-030': Object.freeze({ entrypoint: 'src/superiority/deep/local-ui-certification-lab.mjs', exactTest: 'tests/deep-superiority-ui-dogfood.test.mjs' }),
  'NOL-UI-031': Object.freeze({ entrypoint: 'src/superiority/deep/local-ui-certification-lab.mjs', exactTest: 'tests/deep-superiority-ui-dogfood.test.mjs' }),
  'NOL-UI-032': Object.freeze({ entrypoint: 'src/superiority/deep/local-ui-certification-lab.mjs', exactTest: 'tests/deep-superiority-ui-dogfood.test.mjs' }),
  'NOL-AUDIT-012': Object.freeze({ entrypoint: 'src/superiority/deep/provider-dogfood-replay-lab.mjs', exactTest: 'tests/deep-superiority-ui-dogfood.test.mjs' }),
});

function requirements(productVersion) {
  return REQUIREMENT_DEFINITIONS.map((definition) => {
    const verified = VERIFIED_REQUIREMENTS.has(definition.id);
    const implementedNotWired = IMPLEMENTED_NOT_WIRED_REQUIREMENTS.has(definition.id);
    const externalGate = EXTERNAL_GATE_REQUIREMENTS.has(definition.id);
    const status = verified ? 'verified_source_test' : implementedNotWired ? 'implemented_not_wired' : externalGate ? 'external_gate' : 'not_implemented';
    const hasEvidence = status !== 'not_implemented';
    return {
      ...definition,
      status,
      acceptance: {
        observableBehavior: definition.title,
        sourceCountIsProof: false,
        proofObligations: status === 'verified_source_test' ? ['production-entrypoint', 'exact-test', 'evidence-sha256', 'replay-receipt'] : status === 'implemented_not_wired' ? ['implementation-entrypoint', 'exact-test', 'production-wiring-pending'] : status === 'external_gate' ? ['production-entrypoint', 'exact-test', 'evidence-sha256', 'replay-receipt', 'external-machine-or-provider-receipt'] : ['implementation-and-proof-pending'],
        entrypoint: hasEvidence ? ({
          'NOL-BRAND-001': 'src/product-identity.mjs', 'NOL-BRAND-002': 'scripts/build-portable.mjs', 'NOL-BRAND-004': 'src/release/release-naming.mjs', 'NOL-BRAND-003': 'src/config/nolane-environment.mjs', 'NOL-BRAND-005': 'scripts/scan-product-surface-leakage.mjs', 'NOL-BRAND-006': 'src/client/nolane-agent-client.mjs', 'NOL-BRAND-007': 'scripts/stage-update-payload.mjs', 'NOL-BRAND-008': 'extensions/vscode/src/legacy-migration.ts', 'NOL-BRAND-009': 'src/config/nolane-data-migration.mjs', 'NOL-BRAND-010': 'src/release/version-coherence.mjs', 'NOL-BRAND-012': 'extensions/vscode/src/extension.ts', 'NOL-BRAND-013': 'src/update/update-service.mjs', 'NOL-BRAND-014': 'scripts/scan-product-surface-leakage.mjs', 'NOL-UI-001': 'src/ui/capability-registry.mjs', 'NOL-UI-003': 'scripts/build-ui-v3.mjs', 'NOL-UI-004': 'scripts/validate-ui-tokens.mjs', 'NOL-UI-005': 'ui-v3/shell/app-shell.mjs',
          'NOL-UI-006': 'ui-v3/shell/session-sidebar.mjs', 'NOL-UI-007': 'ui-v3/views/home/home-view.mjs', 'NOL-UI-008': 'ui-v3/views/mission/mission-view.mjs', 'NOL-UI-009': 'ui-v3/views/mission/attention-card.mjs',
          'NOL-UI-010': 'ui-v3/views/mission/artifact-dock.mjs', 'NOL-UI-011': 'ui-v3/views/review/review-view.mjs', 'NOL-UI-012': 'ui-v3/views/review/review-view.mjs', 'NOL-UI-013': 'ui-v3/views/review/ship-actions.mjs',
          'NOL-UI-014': 'ui-v3/views/workroom/workroom-view.mjs', 'NOL-UI-015': 'ui-v3/views/workroom/editor-host.mjs', 'NOL-UI-016': 'ui-v3/views/workroom/terminal-host.mjs', 'NOL-UI-017': 'ui-v3/views/mission/artifact-dock.mjs',
          'NOL-UI-018': 'ui-v3/views/review-queue/review-queue.mjs', 'NOL-UI-019': 'ui-v3/views/projects/project-view.mjs', 'NOL-UI-020': 'ui-v3/views/settings/settings-view.mjs', 'NOL-UI-021': 'ui-v3/control-plane/control-plane-shell.mjs',
          'NOL-UI-022': 'ui-v3/control-plane/domains/operations.mjs', 'NOL-UI-023': 'ui-v3/control-plane/domains/runtime.mjs', 'NOL-UI-024': 'ui-v3/control-plane/domains/context-memory.mjs', 'NOL-UI-025': 'ui-v3/control-plane/domains/evidence.mjs',
          'NOL-UI-026': 'ui-v3/control-plane/domains/intelligence.mjs', 'NOL-UI-027': 'ui-v3/control-plane/domains/trust-security.mjs', 'NOL-UI-028': 'ui-v3/control-plane/domains/governance.mjs', 'NOL-UI-029': 'ui-v3/control-plane/domains/platform.mjs',
          'NOL-NOLANE_NATIVE-002': 'scripts/lib/nolane-runtime-purity-verifier.mjs', 'NOL-NOLANE_NATIVE-040': 'scripts/lib/nolane-runtime-purity-verifier.mjs', 'NOL-NOLANE_NATIVE-031': 'src/agent/agent-loop.mjs', 'NOL-AUDIT-016': 'src/release/non-claim-manifest.mjs', 'NOL-SMALL-DISTILL-01': 'src/small-model/trajectory-schema.mjs', 'NOL-SMALL-DISTILL-04': 'src/small-model/trajectory-schema.mjs', 'NOL-SMALL-DISTILL-06': 'src/small-model/trajectory-lab.mjs', 'NOL-SMALL-DISTILL-10': 'src/small-model/trajectory-lab.mjs', 'NOL-SMALL-DISTILL-12': 'src/small-model/trajectory-lab.mjs', 'NOL-SMALL-VERIFY-01': 'src/small-model/verifier-mesh.mjs', 'NOL-SMALL-VERIFY-02': 'src/small-model/verifier-mesh.mjs', 'NOL-SMALL-VERIFY-03': 'src/small-model/verifier-reliability-ledger.mjs', 'NOL-SMALL-VERIFY-04': 'src/small-model/candidate-ranker.mjs', 'NOL-SMALL-VERIFY-06': 'src/small-model/verifier-mesh.mjs', 'NOL-SMALL-VERIFY-08': 'src/small-model/verifier-mesh.mjs', 'NOL-SMALL-VERIFY-09': 'src/small-model/verifier-mesh.mjs', 'NOL-SMALL-VERIFY-10': 'src/small-model/verifier-mesh.mjs', 'NOL-SMALL-VERIFY-11': 'src/small-model/verifier-mesh.mjs', 'NOL-SMALL-VERIFY-12': 'src/small-model/verifier-mesh.mjs', 'NOL-SMALL-SPECIALIST-01': 'src/small-model/specialist-model-fabric.mjs', 'NOL-SMALL-SPECIALIST-02': 'src/small-model/specialist-model-fabric.mjs', 'NOL-SMALL-SPECIALIST-04': 'src/small-model/specialist-model-fabric.mjs', 'NOL-SMALL-SPECIALIST-07': 'src/small-model/specialist-model-fabric.mjs', 'NOL-SMALL-SPECIALIST-08': 'src/small-model/model-state-serializer.mjs', 'NOL-SMALL-SPECIALIST-11': 'src/small-model/specialist-model-fabric.mjs', 'NOL-SMALL-SPECIALIST-12': 'src/small-model/specialist-model-fabric.mjs', 'NOL-SMALL-COMPUTE-01': 'src/small-model/adaptive-compute-governor.mjs', 'NOL-SMALL-COMPUTE-02': 'src/small-model/adaptive-compute-governor.mjs', 'NOL-SMALL-COMPUTE-03': 'src/small-model/adaptive-compute-governor.mjs', 'NOL-SMALL-COMPUTE-05': 'src/small-model/adaptive-compute-governor.mjs', 'NOL-SMALL-COMPUTE-06': 'src/small-model/speculative-branch-ledger.mjs', 'NOL-SMALL-COMPUTE-07': 'src/small-model/adaptive-compute-governor.mjs', 'NOL-SMALL-COMPUTE-08': 'src/small-model/adaptive-compute-governor.mjs', 'NOL-SMALL-COMPUTE-09': 'src/small-model/adaptive-compute-governor.mjs', 'NOL-SMALL-COMPUTE-10': 'src/small-model/adaptive-compute-governor.mjs', 'NOL-SMALL-COMPUTE-11': 'src/small-model/adaptive-compute-governor.mjs',
          'NOL-NOLANE_NATIVE-001': 'scripts/generate-nolane-program.mjs',
          'NOL-NOLANE_NATIVE-003': 'src/nolane-native/agent-service.mjs', 'NOL-NOLANE_NATIVE-004': 'src/nolane-native/agent-state.mjs', 'NOL-NOLANE_NATIVE-005': 'src/nolane-native/agent-service.mjs', 'NOL-NOLANE_NATIVE-006': 'src/nolane-native/provider-adapters.mjs', 'NOL-NOLANE_NATIVE-007': 'src/nolane-native/tool-registry.mjs',
          'NOL-NOLANE_NATIVE-008': 'src/nolane-native/shell-tool.mjs', 'NOL-NOLANE_NATIVE-009': 'src/nolane-native/file-tools.mjs', 'NOL-NOLANE_NATIVE-012': 'src/nolane-native/orchestration-service.mjs', 'NOL-NOLANE_NATIVE-013': 'src/nolane-native/session-store.mjs', 'NOL-NOLANE_NATIVE-014': 'src/nolane-native/session-store.mjs', 'NOL-NOLANE_NATIVE-015': 'src/nolane-native/session-store.mjs',
          'NOL-NOLANE_NATIVE-017': 'src/nolane-native/orchestration-service.mjs', 'NOL-NOLANE_NATIVE-018': 'src/nolane-native/orchestration-service.mjs', 'NOL-NOLANE_NATIVE-019': 'src/nolane-native/orchestration-service.mjs', 'NOL-NOLANE_NATIVE-020': 'src/nolane-native/orchestration-service.mjs', 'NOL-NOLANE_NATIVE-021': 'src/nolane-native/orchestration-service.mjs', 'NOL-NOLANE_NATIVE-022': 'src/nolane-native/orchestration-service.mjs', 'NOL-NOLANE_NATIVE-024': 'src/nolane-native/orchestration-service.mjs',
          'NOL-NOLANE_NATIVE-023': 'src/nolane-native/runtime-service.mjs', 'NOL-NOLANE_NATIVE-034': 'src/nolane-native/agent-service.mjs', 'NOL-NOLANE_NATIVE-035': 'src/nolane-native/agent-service.mjs', 'NOL-NOLANE_NATIVE-036': 'config/nolane-native-runtime.json', 'NOL-AUDIT-001': 'scripts/generate-nolane-program.mjs', 'NOL-AUDIT-002': 'src/security/content-ingress-pipeline.mjs', 'NOL-AUDIT-005': 'src/repository/repository-file-enumerator.mjs', 'NOL-AUDIT-006': 'src/server/http-server.mjs', 'NOL-AUDIT-007': 'scripts/verify-nolane-evidence-freshness.mjs', 'NOL-AUDIT-008': 'src/security/route-security-telemetry.mjs', 'NOL-AUDIT-004': 'src/eval/eval-lane-policy.mjs', 'NOL-AUDIT-010': 'src/eval/eval-runner.mjs', 'NOL-AUDIT-011': 'src/eval/eval-lane-policy.mjs', 'NOL-AUDIT-003': 'scripts/certify-published-source.mjs', 'NOL-AUDIT-009': 'scripts/generate-nolane-program.mjs', 'NOL-AUDIT-014': 'scripts/verify-nolane-evidence-quality.mjs', 'NOL-AUDIT-015': 'src/audit/capability-status-policy.mjs',
        })[definition.id] ?? EXTERNAL_GATE_EVIDENCE[definition.id]?.entrypoint ?? ALPHA5_EVIDENCE[definition.id]?.entrypoint ?? ALPHA4_EVIDENCE[definition.id]?.entrypoint : null,
        exactTest: hasEvidence ? ({
          'NOL-BRAND-001': 'tests/nolane-product-identity.test.mjs', 'NOL-BRAND-002': 'tests/packaging.test.mjs', 'NOL-BRAND-004': 'tests/nolane-release-naming.test.mjs', 'NOL-BRAND-003': 'tests/nolane-environment-brand-leakage.test.mjs', 'NOL-BRAND-005': 'tests/nolane-environment-brand-leakage.test.mjs', 'NOL-BRAND-006': 'tests/client-sdk-cli.test.mjs', 'NOL-BRAND-007': 'tests/update-payload.test.mjs', 'NOL-BRAND-008': 'tests/vscode-legacy-migration.test.mjs', 'NOL-BRAND-009': 'tests/nolane-data-release-migration.test.mjs', 'NOL-BRAND-010': 'tests/version-coherence.test.mjs', 'NOL-BRAND-012': 'tests/vscode-legacy-migration.test.mjs', 'NOL-BRAND-013': 'tests/nolane-data-release-migration.test.mjs', 'NOL-BRAND-014': 'tests/nolane-environment-brand-leakage.test.mjs', 'NOL-UI-001': 'tests/ui-capability-registry.test.mjs', 'NOL-UI-003': 'tests/ui-v3-module-build.test.mjs', 'NOL-UI-004': 'tests/ui-v3-tokens.test.mjs', 'NOL-UI-005': 'tests/ui-v3-router.test.mjs',
          'NOL-UI-006': 'tests/ui-v3-session-sidebar.test.mjs', 'NOL-UI-007': 'tests/ui-v3-home.test.mjs', 'NOL-UI-008': 'tests/ui-v3-mission-incremental.test.mjs', 'NOL-UI-009': 'tests/ui-v3-attention-cards.test.mjs',
          'NOL-UI-010': 'tests/ui-v3-artifact-dock.test.mjs', 'NOL-UI-011': 'tests/ui-v3-review.test.mjs', 'NOL-UI-012': 'tests/ui-v3-review.test.mjs', 'NOL-UI-013': 'tests/ui-v3-review.test.mjs',
          'NOL-UI-014': 'tests/ui-v3-workroom.test.mjs', 'NOL-UI-015': 'tests/ui-v3-workroom.test.mjs', 'NOL-UI-016': 'tests/ui-v3-workroom.test.mjs', 'NOL-UI-017': 'tests/ui-v3-artifact-dock.test.mjs',
          'NOL-UI-018': 'tests/ui-v3-secondary-views.test.mjs', 'NOL-UI-019': 'tests/ui-v3-secondary-views.test.mjs', 'NOL-UI-020': 'tests/ui-v3-secondary-views.test.mjs', 'NOL-UI-021': 'tests/ui-v3-control-plane.test.mjs',
          'NOL-UI-022': 'tests/ui-v3-control-plane-domains.test.mjs', 'NOL-UI-023': 'tests/ui-v3-control-plane-domains.test.mjs', 'NOL-UI-024': 'tests/ui-v3-control-plane-domains.test.mjs', 'NOL-UI-025': 'tests/ui-v3-control-plane-domains.test.mjs',
          'NOL-UI-026': 'tests/ui-v3-control-plane-domains.test.mjs', 'NOL-UI-027': 'tests/ui-v3-control-plane-domains.test.mjs', 'NOL-UI-028': 'tests/ui-v3-control-plane-domains.test.mjs', 'NOL-UI-029': 'tests/ui-v3-control-plane-domains.test.mjs',
          'NOL-NOLANE_NATIVE-002': 'tests/nolane-runtime-purity.test.mjs', 'NOL-NOLANE_NATIVE-040': 'tests/nolane-runtime-purity.test.mjs', 'NOL-NOLANE_NATIVE-031': 'tests/content-ingress-agent-loop.test.mjs', 'NOL-AUDIT-016': 'tests/release-non-claim-manifest.test.mjs', 'NOL-SMALL-DISTILL-01': 'tests/small-model-trajectory-lab.test.mjs', 'NOL-SMALL-DISTILL-04': 'tests/small-model-trajectory-lab.test.mjs', 'NOL-SMALL-DISTILL-06': 'tests/small-model-trajectory-lab.test.mjs', 'NOL-SMALL-DISTILL-10': 'tests/small-model-trajectory-lab.test.mjs', 'NOL-SMALL-DISTILL-12': 'tests/small-model-trajectory-lab.test.mjs', 'NOL-SMALL-VERIFY-01': 'tests/small-model-verifier-mesh.test.mjs', 'NOL-SMALL-VERIFY-02': 'tests/small-model-verifier-mesh.test.mjs', 'NOL-SMALL-VERIFY-03': 'tests/small-model-verifier-mesh.test.mjs', 'NOL-SMALL-VERIFY-04': 'tests/small-model-verifier-mesh.test.mjs', 'NOL-SMALL-VERIFY-06': 'tests/small-model-verifier-mesh.test.mjs', 'NOL-SMALL-VERIFY-08': 'tests/small-model-verifier-mesh.test.mjs', 'NOL-SMALL-VERIFY-09': 'tests/small-model-verifier-mesh.test.mjs', 'NOL-SMALL-VERIFY-10': 'tests/small-model-verifier-mesh.test.mjs', 'NOL-SMALL-VERIFY-11': 'tests/small-model-verifier-mesh.test.mjs', 'NOL-SMALL-VERIFY-12': 'tests/small-model-verifier-mesh.test.mjs', 'NOL-SMALL-SPECIALIST-01': 'tests/small-model-specialist-fabric.test.mjs', 'NOL-SMALL-SPECIALIST-02': 'tests/small-model-specialist-fabric.test.mjs', 'NOL-SMALL-SPECIALIST-04': 'tests/small-model-specialist-fabric.test.mjs', 'NOL-SMALL-SPECIALIST-07': 'tests/small-model-specialist-fabric.test.mjs', 'NOL-SMALL-SPECIALIST-08': 'tests/small-model-specialist-fabric.test.mjs', 'NOL-SMALL-SPECIALIST-11': 'tests/small-model-specialist-fabric.test.mjs', 'NOL-SMALL-SPECIALIST-12': 'tests/small-model-specialist-fabric.test.mjs', 'NOL-SMALL-COMPUTE-01': 'tests/small-model-adaptive-compute.test.mjs', 'NOL-SMALL-COMPUTE-02': 'tests/small-model-adaptive-compute.test.mjs', 'NOL-SMALL-COMPUTE-03': 'tests/small-model-adaptive-compute.test.mjs', 'NOL-SMALL-COMPUTE-05': 'tests/small-model-adaptive-compute.test.mjs', 'NOL-SMALL-COMPUTE-06': 'tests/small-model-adaptive-compute.test.mjs', 'NOL-SMALL-COMPUTE-07': 'tests/small-model-adaptive-compute.test.mjs', 'NOL-SMALL-COMPUTE-08': 'tests/small-model-adaptive-compute.test.mjs', 'NOL-SMALL-COMPUTE-09': 'tests/small-model-adaptive-compute.test.mjs', 'NOL-SMALL-COMPUTE-10': 'tests/small-model-adaptive-compute.test.mjs', 'NOL-SMALL-COMPUTE-11': 'tests/small-model-adaptive-compute.test.mjs',
          'NOL-NOLANE_NATIVE-001': 'tests/nolane-program-registry.test.mjs',
          'NOL-NOLANE_NATIVE-003': 'tests/nolane-native-agent-service.test.mjs', 'NOL-NOLANE_NATIVE-004': 'tests/nolane-native-agent-service.test.mjs', 'NOL-NOLANE_NATIVE-005': 'tests/nolane-native-agent-service.test.mjs', 'NOL-NOLANE_NATIVE-006': 'tests/nolane-native-agent-service.test.mjs', 'NOL-NOLANE_NATIVE-007': 'tests/nolane-native-agent-service.test.mjs',
          'NOL-NOLANE_NATIVE-008': 'tests/nolane-native-agent-service.test.mjs', 'NOL-NOLANE_NATIVE-009': 'tests/nolane-native-agent-service.test.mjs', 'NOL-NOLANE_NATIVE-012': 'tests/nolane-native-orchestration-service.test.mjs', 'NOL-NOLANE_NATIVE-013': 'tests/nolane-session-http-wiring.test.mjs', 'NOL-NOLANE_NATIVE-014': 'tests/nolane-session-http-wiring.test.mjs', 'NOL-NOLANE_NATIVE-015': 'tests/nolane-session-http-wiring.test.mjs',
          'NOL-NOLANE_NATIVE-017': 'tests/nolane-native-orchestration-service.test.mjs', 'NOL-NOLANE_NATIVE-018': 'tests/nolane-native-orchestration-service.test.mjs', 'NOL-NOLANE_NATIVE-019': 'tests/nolane-native-orchestration-service.test.mjs', 'NOL-NOLANE_NATIVE-020': 'tests/nolane-native-orchestration-service.test.mjs', 'NOL-NOLANE_NATIVE-021': 'tests/nolane-native-orchestration-service.test.mjs', 'NOL-NOLANE_NATIVE-022': 'tests/nolane-native-orchestration-service.test.mjs', 'NOL-NOLANE_NATIVE-024': 'tests/nolane-native-orchestration-service.test.mjs',
          'NOL-NOLANE_NATIVE-023': 'tests/nolane-native-runtime-http-wiring.test.mjs', 'NOL-NOLANE_NATIVE-034': 'tests/nolane-native-agent-service.test.mjs', 'NOL-NOLANE_NATIVE-035': 'tests/nolane-native-agent-service.test.mjs', 'NOL-NOLANE_NATIVE-036': 'tests/nolane-native-runtime-session-tools.test.mjs', 'NOL-AUDIT-001': 'tests/nolane-program-registry.test.mjs', 'NOL-AUDIT-002': 'tests/content-ingress-agent-loop.test.mjs', 'NOL-AUDIT-005': 'tests/repository-gitless-discovery.test.mjs', 'NOL-AUDIT-006': 'tests/http-boundary-errors.test.mjs', 'NOL-AUDIT-007': 'tests/nolane-evidence-freshness.test.mjs', 'NOL-AUDIT-008': 'tests/route-security-telemetry.test.mjs', 'NOL-AUDIT-004': 'tests/eval-lane-policy.test.mjs', 'NOL-AUDIT-010': 'tests/eval-lane-policy.test.mjs', 'NOL-AUDIT-011': 'tests/eval-lane-policy.test.mjs', 'NOL-AUDIT-003': 'tests/clean-room-certification.test.mjs', 'NOL-AUDIT-009': 'tests/nolane-program-registry.test.mjs', 'NOL-AUDIT-014': 'tests/nolane-evidence-quality.test.mjs', 'NOL-AUDIT-015': 'tests/capability-status-policy.test.mjs',
        })[definition.id] ?? EXTERNAL_GATE_EVIDENCE[definition.id]?.exactTest ?? ALPHA5_EVIDENCE[definition.id]?.exactTest ?? ALPHA4_EVIDENCE[definition.id]?.exactTest : null,
        cleanRoomReceipt: null,
        provenanceRequired: definition.id.startsWith('NOL-NOLANE_NATIVE-'),
      },
    };
  });
}

export async function generateNolaneProgram({ projectRoot = process.cwd() } = {}) {
  const root = path.resolve(projectRoot); const requirementsRoot = path.join(root, 'requirements'); await mkdir(requirementsRoot, { recursive: true });
  const packageMetadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const productVersion = String(packageMetadata.version);
  const historicalLedgerPath = path.join(requirementsRoot, 'nolane-native-transformation-ledger.jsonl');
  const historicalSummaryPath = path.join(requirementsRoot, 'nolane-native-transformation-summary.json');
  const [historicalLedger, historicalSummaryBytes, runtimePurity] = await Promise.all([
    readFile(historicalLedgerPath, 'utf8'),
    readFile(historicalSummaryPath),
    verifyNolaneRuntimePurity({ rootDirectory: root }),
  ]);
  if (runtimePurity.status !== 'pass') throw new Error('Nolane runtime purity verification must pass before generating the Nolane registry');
  const historicalSummary = JSON.parse(historicalSummaryBytes.toString('utf8'));
  const ledgerEntries = historicalLedger.trim() ? historicalLedger.trim().split('\n').length : 0;
  if (ledgerEntries !== Number(historicalSummary.totalEntries) || historicalSummary.accountedEntries !== historicalSummary.totalEntries) throw new Error('Historical NolaneNative transformation evidence is incomplete');
  const runtimePuritySummary = {
    schema: 'nolane.agent.runtime-purity-summary.v1', product: 'Nolane Agent', version: productVersion,
    runtime: 'nolane-native', externalRuntimeBundled: false, externalExecutablePaths: 0, historicalLedgerEntries: ledgerEntries,
    historicalLedgerSha256: sha256(historicalLedger), historicalSummarySha256: sha256(historicalSummaryBytes),
    pathFindings: runtimePurity.pathFindings.length, contentFindings: runtimePurity.contentFindings.length, archiveFindings: runtimePurity.archiveFindings.length,
    runtimePurityReceiptSha256: runtimePurity.receiptSha256,
  };
  await writeJsonAtomic(path.join(requirementsRoot, 'runtime-purity-summary.json'), runtimePuritySummary);
  const reqs = requirements(productVersion);
  for (const item of reqs) {
    if (item.status === 'not_implemented') continue;
    const [entrypointBytes, testBytes] = await Promise.all([readFile(path.join(root, item.acceptance.entrypoint)), readFile(path.join(root, item.acceptance.exactTest))]);
    const evidence = { environment: 'node>=22.12', entrypointSha256: sha256(entrypointBytes), exactTestSha256: sha256(testBytes) };
    item.acceptance.evidence = evidence;
    item.acceptance.replayReceiptSha256 = sha256(JSON.stringify({ id: item.id, ...evidence }));
  }
  for (const item of reqs) validateCapabilityStatusRecord(item);
  const statusCounts = reqs.reduce((acc, item) => (acc[item.status] = (acc[item.status] ?? 0) + 1, acc), {});
  const registry = { schema: 'nolane.agent.requirements.v5', product: 'Nolane Agent', version: productVersion, productVersion, generatedFrom: ['docs/reference/Nolane-Agent-UI-UX-Master-Plan.md', 'docs/reference/Nolane-Agent-Independent-Audit.md', 'docs/reference/Nolane-Agent-Small-Model-Research.md'], total: reqs.length, totalItems: reqs.length, statusCounts, summary: statusCounts, requirements: reqs };
  await writeJsonAtomic(path.join(requirementsRoot, 'nolane-agent-v5-requirements.json'), registry);
  await mkdir(path.join(root, 'docs'), { recursive: true });
  await writeJsonAtomic(path.join(root, 'docs', `feature-audit-${productVersion}.json`), registry);
  return { product: 'Nolane Agent', requirements: { total: reqs.length, notImplemented: statusCounts.not_implemented ?? 0, verified: statusCounts.verified_source_test ?? 0 }, retirement: runtimePuritySummary, historicalNolaneNativeTransformation: historicalSummary };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) generateNolaneProgram().then((result) => console.log(JSON.stringify(result))).catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
