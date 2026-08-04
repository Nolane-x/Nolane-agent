import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { defaultReleaseGates, runFullReleaseMatrix } from '../src/release/full-release-matrix.mjs';

test('full release matrix runs every gate, redacts logs, and fails when one required gate fails', async (t) => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'forge-matrix-'));
  t.after(() => rm(outputDirectory, { recursive: true, force: true }));
  const calls = [];
  const gates = [
    { id: 'one', label: 'One', command: 'node', args: ['one'], required: true },
    { id: 'two', label: 'Two', command: 'node', args: ['two'], required: true },
    { id: 'three', label: 'Three', command: 'node', args: ['three'], required: false },
  ];
  const report = await runFullReleaseMatrix({
    rootDirectory: process.cwd(),
    outputDirectory,
    version: '1.0.0',
    commit: 'a'.repeat(40),
    gates,
    now: (() => { let tick = 0; return () => new Date(1_700_000_000_000 + tick++ * 10); })(),
    executor: async (gate) => {
      calls.push(gate.id);
      if (gate.id === 'two') return { exitCode: 2, signal: null, stdout: 'token=abcdefghijklmnop', stderr: 'failure', durationMs: 12 };
      return { exitCode: 0, signal: null, stdout: `${gate.id} ok`, stderr: '', durationMs: 5 };
    },
  });
  assert.deepEqual(calls, ['one', 'two', 'three']);
  assert.equal(report.status, 'fail');
  assert.equal(report.gates.length, 3);
  assert.equal(report.gates[1].status, 'fail');
  assert.match(report.gates[1].receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(report.gates[2].status, 'pass');
  assert.equal(report.requiredPassed, 1);
  assert.equal(report.requiredTotal, 2);
  const log = await readFile(path.join(outputDirectory, 'logs', 'two.log'), 'utf8');
  assert.doesNotMatch(log, /abcdefghijklmnop/);
  assert.match(log, /REDACTED/);
  const persisted = JSON.parse(await readFile(path.join(outputDirectory, 'full-release-matrix.json'), 'utf8'));
  assert.equal(persisted.status, 'fail');
  assert.match(await readFile(path.join(outputDirectory, 'full-release-matrix.md'), 'utf8'), /Required gates: 1\/2 passed/);
});

test('default release gates cover source, runtime, ForgeOS, SDK, IDE, audit, benchmark, and packaging', () => {
  const gates = defaultReleaseGates({ rootDirectory: process.cwd(), version: '1.0.0' });
  const ids = new Set(gates.map((gate) => gate.id));
  for (const id of [
    'source-clean', 'version-coherence', 'nolane-runtime-purity', 'electron-installer-config', 'signed-update-contract', 'electron-update-wiring', 'github-release-workflow', 'update-trust-bootstrap', 'beta1-release-docs', 'workspace-trust-governance', 'diff-review-governance', 'agent-operations-governance', 'context-memory-governance', 'trace-evidence-governance', 'repository-discovery-intelligence', 'codebase-knowledge-graph', 'local-semantic-dependency-intelligence', 'local-ast-intelligence', 'local-resource-sandbox', 'local-worktree-handoff', 'code-relationship-intelligence', 'remaining-completion', 'git-completion-governance', 'atomic-patch-governance', 'adaptive-microkernel', 'adaptive-work-fabric', 'adaptive-harness-lab', 'mission-resource-fabric', 'decision-efficiency-loop', 'context-engine-v3', 'repository-intelligence-fabric', 'intelligence-completion-kernel', 'polyglot-runtime-intelligence', 'cognitive-decision-kernel', 'frontier-safety-and-self-healing', 'instruction-policy-governance', 'agent-modes-governance', 'context-orchestration-governance', 'mission-state-progress-governance', 'local-context-semantic-completion', 'local-polyglot-evidence-completion', 'local-memory-resource-collaboration-completion', 'local-product-security-experience-completion', 'local-benchmark-completion', 'node-suite', 'node-syntax', 'runtime-smoke', 'eval-suite',
    'vscode-build', 'go-modules', 'python-sdk', 'forgeos-validate', 'forgeos-smoke',
    'forgeos-adapter-tck', 'forgeos-v06-audit', 'forgeos-certification', 'forgeos-mutation-critical',
    'feature-audit', 'remaining-gaps-report', 'nolane-requirement-registry', 'nolane-remaining-gaps-report', 'nolane-evidence-freshness', 'nolane-evidence-quality', 'nolane-ui-capability-audit', 'small-model-foundation', 'alpha4-distillation-verification', 'alpha4-recursive-symbolic', 'alpha4-plasticity-curriculum', 'alpha4-specialist-compute', 'alpha4-operational-boundaries', 'alpha4-http-control-plane', 'alpha5-scientific-benchmarks', 'alpha5-symbolic-constraints', 'alpha5-specialist-plasticity', 'alpha5-native-capability-pack', 'alpha5-brand-ui-static-quality', 'alpha5-production-wiring', 'self-benchmark', 'self-benchmark-claim-gate', 'project-manifest',
    'windows-bootstrap', 'release-artifacts', 'published-source-clean-room', 'fresh-source-reconstruction', 'archive-integrity',
  ]) assert.ok(ids.has(id), id);
  const trust = gates.find((gate) => gate.id === 'workspace-trust-governance');
  assert.equal(trust.command, process.execPath);
  assert.deepEqual(trust.args, ['--test', 'tests/workspace-trust-service.test.mjs', 'tests/workspace-trust-gates.test.mjs', 'tests/workspace-trust-http-api.test.mjs', 'tests/workspace-trust-center-ui.test.mjs', 'tests/workspace-trust-app-wiring.test.mjs']);
  const diffReview = gates.find((gate) => gate.id === 'diff-review-governance');
  assert.equal(diffReview.command, process.execPath);
  assert.deepEqual(diffReview.args, ['--test', 'tests/diff-review-service.test.mjs', 'tests/diff-review-http-api.test.mjs', 'tests/diff-review-center-ui.test.mjs', 'tests/diff-review-app-wiring.test.mjs']);
  const operations = gates.find((gate) => gate.id === 'agent-operations-governance');
  assert.equal(operations.command, process.execPath);
  assert.deepEqual(operations.args, ['--test', 'tests/agent-operations-service.test.mjs', 'tests/agent-operations-http-api.test.mjs', 'tests/agent-operations-center-ui.test.mjs', 'tests/agent-operations-app-wiring.test.mjs']);
  const contextMemory = gates.find((gate) => gate.id === 'context-memory-governance');
  assert.equal(contextMemory.command, process.execPath);
  assert.deepEqual(contextMemory.args, ['--test', 'tests/context-memory-center-service.test.mjs', 'tests/context-memory-center-http-api.test.mjs', 'tests/context-memory-center-ui.test.mjs', 'tests/context-memory-center-app-wiring.test.mjs']);
  const repositoryDiscovery = gates.find((gate) => gate.id === 'repository-discovery-intelligence');
  assert.equal(repositoryDiscovery.command, process.execPath);
  assert.deepEqual(repositoryDiscovery.args, ['scripts/verify-repository-discovery.mjs', '.']);
  const codebaseKnowledge = gates.find((gate) => gate.id === 'codebase-knowledge-graph');
  assert.equal(codebaseKnowledge.command, process.execPath);
  assert.deepEqual(codebaseKnowledge.args, ['scripts/verify-codebase-knowledge.mjs', '.']);
  const semanticDependency = gates.find((gate) => gate.id === 'local-semantic-dependency-intelligence');
  assert.equal(semanticDependency.command, process.execPath);
  assert.deepEqual(semanticDependency.args, ['scripts/verify-semantic-dependency.mjs', '.']);
  const astIntelligence = gates.find((gate) => gate.id === 'local-ast-intelligence');
  assert.equal(astIntelligence.command, process.execPath);
  assert.deepEqual(astIntelligence.args, ['scripts/verify-ast-intelligence.mjs', '.']);
  const resourceSandbox = gates.find((gate) => gate.id === 'local-resource-sandbox');
  assert.equal(resourceSandbox.command, process.execPath);
  assert.deepEqual(resourceSandbox.args, ['scripts/verify-local-resource-sandbox.mjs', '.']);
  const worktreeHandoff = gates.find((gate) => gate.id === 'local-worktree-handoff');
  assert.equal(worktreeHandoff.command, process.execPath);
  assert.deepEqual(worktreeHandoff.args, ['scripts/verify-local-worktree-handoff.mjs', '.']);
  const intelligenceCompletion = gates.find((gate) => gate.id === 'intelligence-completion-kernel');
  assert.equal(intelligenceCompletion.command, process.execPath);
  assert.deepEqual(intelligenceCompletion.args, ['scripts/verify-intelligence-completion-kernel.mjs', '.']);
  const codeRelationships = gates.find((gate) => gate.id === 'code-relationship-intelligence');
  assert.equal(codeRelationships.command, process.execPath);
  assert.deepEqual(codeRelationships.args, ['scripts/verify-code-relationships.mjs', '.']);
  const gitCompletionGovernance = gates.find((gate) => gate.id === 'git-completion-governance');
  assert.equal(gitCompletionGovernance.command, process.execPath);
  assert.deepEqual(gitCompletionGovernance.args, ['scripts/verify-git-completion-governance.mjs', '.']);
  const atomicPatchGovernance = gates.find((gate) => gate.id === 'atomic-patch-governance');
  assert.equal(atomicPatchGovernance.command, process.execPath);
  assert.deepEqual(atomicPatchGovernance.args, ['scripts/verify-atomic-patch-governance.mjs', '.']);
  const remainingCompletion = gates.find((gate) => gate.id === 'remaining-completion');
  assert.equal(remainingCompletion.command, process.execPath);
  assert.deepEqual(remainingCompletion.args, ['scripts/verify-remaining-completion.mjs', '.']);
  const adaptiveMicrokernel = gates.find((gate) => gate.id === 'adaptive-microkernel');
  assert.equal(adaptiveMicrokernel.command, process.execPath);
  assert.deepEqual(adaptiveMicrokernel.args, ['scripts/verify-adaptive-microkernel.mjs', '.']);
  const adaptiveWorkFabric = gates.find((gate) => gate.id === 'adaptive-work-fabric');
  assert.equal(adaptiveWorkFabric.command, process.execPath);
  assert.deepEqual(adaptiveWorkFabric.args, ['scripts/verify-adaptive-work-fabric.mjs', '.']);
  const adaptiveHarnessLab = gates.find((gate) => gate.id === 'adaptive-harness-lab');
  assert.equal(adaptiveHarnessLab.command, process.execPath);
  assert.deepEqual(adaptiveHarnessLab.args, ['scripts/verify-adaptive-harness-lab.mjs', '.']);
  const instructionPolicy = gates.find((gate) => gate.id === 'instruction-policy-governance');
  assert.equal(instructionPolicy.command, process.execPath);
  assert.deepEqual(instructionPolicy.args, ['scripts/verify-instruction-policy.mjs', '.']);
  const agentModes = gates.find((gate) => gate.id === 'agent-modes-governance');
  assert.equal(agentModes.command, process.execPath);
  assert.deepEqual(agentModes.args, ['scripts/verify-agent-modes.mjs', '.']);
  const contextOrchestration = gates.find((gate) => gate.id === 'context-orchestration-governance');
  assert.equal(contextOrchestration.command, process.execPath);
  assert.deepEqual(contextOrchestration.args, ['scripts/verify-context-orchestration.mjs', '.']);
  const localOperations = gates.find((gate) => gate.id === 'local-operations-human-control');
  assert.equal(localOperations.command, process.execPath);
  assert.deepEqual(localOperations.args, ['scripts/verify-local-operations-human-control.mjs', '.']);
  const runtimeReadiness = gates.find((gate) => gate.id === 'mission-completion-runtime-readiness');
  assert.equal(runtimeReadiness.command, process.execPath);
  assert.deepEqual(runtimeReadiness.args, ['scripts/verify-mission-completion-runtime-readiness.mjs', '.']);
  const missionState = gates.find((gate) => gate.id === 'mission-state-progress-governance');
  assert.equal(missionState.command, process.execPath);
  assert.deepEqual(missionState.args, ['scripts/verify-mission-state-progress.mjs', '.']);
  const remainingGaps = gates.find((gate) => gate.id === 'remaining-gaps-report');
  assert.equal(remainingGaps.command, process.execPath);
  assert.deepEqual(remainingGaps.args, ['scripts/generate-remaining-gaps-report.mjs', 'verify', '.']);
  const identity = gates.find((gate) => gate.id === 'version-coherence');
  assert.equal(identity.command, process.execPath);
  assert.deepEqual(identity.args, ['scripts/verify-version-coherence.mjs', '.']);
  const manifest = gates.find((gate) => gate.id === 'project-manifest');
  assert.equal(manifest.command, process.execPath);
  assert.deepEqual(manifest.args, ['scripts/generate-manifest.mjs', '.', 'release/project-manifest-1.0.0.json']);
  const goModules = gates.find((gate) => gate.id === 'go-modules');
  const windowsBootstrap = gates.find((gate) => gate.id === 'windows-bootstrap');
  const expectedGoCache = path.join(process.cwd(), 'release', '.cache', 'go-build');
  const expectedGoModCache = path.join(process.cwd(), 'release', '.cache', 'go-mod');
  assert.equal(goModules.env.GOCACHE, expectedGoCache);
  assert.equal(goModules.env.GOMODCACHE, expectedGoModCache);
  assert.equal(windowsBootstrap.env.GOCACHE, expectedGoCache);
  assert.equal(windowsBootstrap.env.GOMODCACHE, expectedGoModCache);
  const adapterTck = gates.find((gate) => gate.id === 'forgeos-adapter-tck');
  assert.equal(adapterTck.env.FORGEOS_ADAPTER_TCK_OUTPUT, path.join(process.cwd(), 'release', 'forgeos', 'adapter-tck.json'));
});



test('Nolane 5.x matrix runs historical frontier capability gates through a 4.0.0 retention overlay', () => {
  const gates = defaultReleaseGates({ rootDirectory: process.cwd(), version: '5.0.0-alpha.4' });
  const repository = gates.find((gate) => gate.id === 'repository-discovery-intelligence');
  const missionState = gates.find((gate) => gate.id === 'mission-state-progress-governance');
  const nodeSuite = gates.find((gate) => gate.id === 'node-suite');
  assert.deepEqual(repository.args, ['scripts/run-legacy-retention-gate.mjs', 'scripts/verify-repository-discovery.mjs', '.', '4.0.0', '{root}']);
  assert.match(repository.label, /4\.0\.0 retention/);
  assert.deepEqual(missionState.args, ['scripts/run-legacy-retention-gate.mjs', 'scripts/verify-mission-state-progress.mjs', '.', '4.0.0', '{root}']);
  assert.deepEqual(gates.find((gate) => gate.id === 'feature-audit').args, ['scripts/run-legacy-retention-gate.mjs', 'scripts/generate-frontier-feature-audit.mjs', '.', '4.0.0', '{root}', '{version}']);
  assert.deepEqual(gates.find((gate) => gate.id === 'remaining-gaps-report').args, ['scripts/run-legacy-retention-gate.mjs', 'scripts/generate-remaining-gaps-report.mjs', '.', '4.0.0', 'verify', '{root}']);
  assert.deepEqual(nodeSuite.args, ['test']);
});

test('full release matrix emits lifecycle callbacks without changing gate receipts', async (t) => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'forge-matrix-events-'));
  t.after(() => rm(outputDirectory, { recursive: true, force: true }));
  const events = [];
  const report = await runFullReleaseMatrix({
    rootDirectory: process.cwd(),
    outputDirectory,
    version: '1.0.0',
    commit: 'b'.repeat(40),
    gates: [{ id: 'only', label: 'Only', command: 'node', args: [] }],
    executor: async () => ({ exitCode: 0, signal: null, stdout: 'ok', stderr: '', durationMs: 1 }),
    onGateStart: (gate) => events.push(['start', gate.id]),
    onGateFinish: (gate) => events.push(['finish', gate.id, gate.status, gate.receiptSha256]),
  });
  assert.equal(report.status, 'pass');
  assert.deepEqual(events.map((event) => event.slice(0, 3)), [['start', 'only'], ['finish', 'only', 'pass']]);
  assert.match(events[1][3], /^[a-f0-9]{64}$/);
});

test('repository ignores only root release artifacts and keeps release source modules trackable', async () => {
  const rules = await readFile('.gitignore', 'utf8');
  assert.match(rules, /^\/release\/$/m);
  assert.doesNotMatch(rules, /^release\/$/m);
});
