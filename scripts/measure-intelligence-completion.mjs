import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { ContextLearningKernel } from '../src/intelligence-completion/context-learning-kernel.mjs';
import { CounterfactualPatchAblator } from '../src/intelligence-completion/counterfactual-patch-ablator.mjs';
import { PagedVectorStore } from '../src/intelligence-completion/paged-vector-store.mjs';
import { ProgramAnalysisKernel } from '../src/intelligence-completion/program-analysis-kernel.mjs';
import { RepositoryIntelligenceCompletionService } from '../src/intelligence-completion/repository-intelligence-completion-service.mjs';
import { VariableLineageService } from '../src/intelligence-completion/variable-lineage-service.mjs';
import { RepositoryIntelligenceFabric } from '../src/repository/repository-intelligence-fabric.mjs';

export const INTELLIGENCE_COMPLETION_REQUIREMENT_IDS = Object.freeze(['30.13','30.14','30.15','31.12','32.5','32.8','32.13','32.16','33.6','33.7','36.12','36.13','36.17']);
const H = (character) => String(character).repeat(64);
const citation = (filePath, line = 1, character = 'a') => ({ path: filePath, startLine: line, endLine: line, sourceHash: H(character) });

async function measureContext() {
  const kernel = new ContextLearningKernel({
    dependencyNeighbors: async () => [{ symbol: 'parseConfig', path: 'src/config.mjs', relation: 'calls' }],
    gitSignals: async () => [{ path: 'src/app.mjs', commit: 'a'.repeat(40), kind: 'recent-change' }],
    testSignals: async () => [{ testId: 'config rejects null', path: 'tests/config.test.mjs' }],
  });
  const expansion = await kernel.expandQueries({
    taskType: 'bugfix', objective: 'Fix parseConfig after TypeError from null configuration', symbols: ['parseConfig'],
    stackFrames: [{ symbol: 'loadConfig', path: 'src/config.mjs', line: 42 }], hypothesis: 'null reaches parseConfig', maxQueries: 20,
  });
  kernel.recordVerifiedOutcome({ taskType: 'bugfix', evidenceType: 'stack', useful: true, verified: false, verificationStatus: 'passed', verificationReceiptSha256: H('1') });
  const beforeVerified = kernel.rankEvidenceTypes({ taskType: 'bugfix' });
  kernel.recordVerifiedOutcome({ taskType: 'bugfix', evidenceType: 'stack', useful: true, verified: true, verificationStatus: 'passed', verificationReceiptSha256: H('2') });
  const afterVerified = kernel.rankEvidenceTypes({ taskType: 'bugfix' });
  const contract = H('3');
  const ablation = await kernel.runAblationReplay({
    verificationContractSha256: contract,
    evidenceCards: [{ cardId: 'required', tokenCost: 10 }, { cardId: 'extra', tokenCost: 20 }, { cardId: 'unstable', tokenCost: 5 }],
    verifier: async ({ evidenceCards, removedCardId, verificationContractSha256 }) => {
      if (verificationContractSha256 !== contract) throw new Error('contract drift');
      if (removedCardId === 'unstable') throw new Error('deterministic unavailable adapter');
      return {
        verified: true, verificationStatus: 'passed',
        score: evidenceCards.some((card) => card.cardId === 'required') ? 10 : 3,
        verificationReceiptSha256: H(removedCardId === null ? '4' : removedCardId === 'required' ? '5' : '6'),
      };
    },
  });
  return {
    expansionKinds: [...new Set(expansion.queries.map((query) => query.counterEvidence ? 'counter-evidence' : query.kind))].sort(),
    queryCount: expansion.queries.length,
    verifiedStackUtility: afterVerified.scores.stack,
    unverifiedOutcomeChangedLearning: (beforeVerified.scores.stack ?? 0) !== 0,
    ablationClassifications: ablation.items.map((item) => item.classification),
    verificationContractChanged: ablation.claims.verificationContractChanged,
  };
}

async function measureVectors() {
  const store = new PagedVectorStore({ pageSize: 2, maxLoadedBytes: 4096, defaultMaxPages: 1 });
  try {
    const records = Array.from({ length: 6 }, (_, index) => ({
      id: `r${index + 1}`, vector: [index + 1, 0, index % 2 ? 1 : -1, 2], metadata: { path: `src/f${index + 1}.mjs` }, contentSha256: H((index + 1) % 10),
    }));
    const built = await store.build({ indexId: 'measurement', records });
    const selectedPageId = built.manifest.pages[1].pageId;
    const searched = await store.search({ indexId: 'measurement', queryVector: [3, 0, 1, 2], pageIds: [selectedPageId], limit: 5 });
    return {
      pages: built.manifest.pages.length,
      dimensions: built.manifest.dimension,
      pagesRead: searched.telemetry.pagesRead,
      bytesRead: searched.telemetry.bytesRead,
      peakLoadedBytes: searched.telemetry.peakLoadedBytes,
      totalVectorBytes: searched.telemetry.totalVectorBytes,
      fullIndexLoadedIntoMemory: searched.claims.fullIndexLoadedIntoMemory,
      checksumsValid: store.verify().claims.pageChecksumsRequired === true,
    };
  } finally { await store.close(); }
}

function measureRepository() {
  const service = new RepositoryIntelligenceCompletionService({ maximumHistory: 10 });
  const commit = service.recordCommitArchitecture({ repositoryId: 'repo', branch: 'main', commitSha: 'a'.repeat(40), architectureIds: ['layer:runtime'], evidenceKind: 'observed', confidence: 0.9, citations: [citation('src/runtime/main.mjs')] });
  const issue = service.recordIssueCodeReference({ repositoryId: 'repo', branch: 'main', issueId: 'GH-42', codeIds: ['symbol:parseConfig'], evidenceKind: 'inferred', confidence: 0.6, citations: [citation('src/config.mjs', 1, 'b')] });
  const modules = service.buildModuleMap({ repositoryId: 'repo', branch: 'main', modules: [
    { moduleId: 'context', path: 'src/context', responsibility: 'build bounded context', owner: 'core-team', publicSurface: ['ContextLearningKernel'], dependencies: [{ targetModuleId: 'repository', direction: 'outbound', kind: 'reads' }], citations: [citation('src/context/index.mjs')] },
    { moduleId: 'repository', path: 'src/repository', responsibility: 'index code', owner: 'repo-team', publicSurface: ['RepositoryIntelligenceFabric'], dependencies: [], citations: [citation('src/repository/index.mjs', 1, 'b')] },
  ] });
  const zones = service.detectArchitectureZones({ repositoryId: 'repo', branch: 'main', files: [
    { path: 'src/security/token-vault.mjs', imports: ['node:crypto'], annotations: ['@critical'], sourceHash: H('a') },
    { path: 'legacy/adapter.js', imports: [], annotations: [], sourceHash: H('b') },
    { path: 'src/services/user-service.mjs', imports: ['./repository.mjs'], annotations: [], sourceHash: H('c') },
  ], rules: [
    { ruleId: 'security-path', zoneType: 'security-critical', pathPattern: 'security|token', confidence: 0.95 },
    { ruleId: 'legacy-path', zoneType: 'legacy', pathPattern: '^legacy/', confidence: 0.9 },
    { ruleId: 'service-convention', zoneType: 'convention', pathPattern: '-service\\.mjs$', confidence: 0.8 },
    { ruleId: 'repository-pattern', zoneType: 'architecture-pattern', importPattern: 'repository', confidence: 0.75 },
  ] });
  const risk = service.buildGitRiskProfile({ repositoryId: 'repo', branch: 'main', expectedBranch: 'main', nowMs: Date.parse('2026-07-31T00:00:00Z'), history: [
    { commitSha: 'a'.repeat(40), author: 'alice', path: 'src/a.mjs', linesChanged: 100, regression: true, timestamp: '2026-07-30T00:00:00Z', sourceHash: H('a') },
    { commitSha: 'b'.repeat(40), author: 'alice', path: 'src/a.mjs', linesChanged: 20, regression: false, timestamp: '2026-07-20T00:00:00Z', sourceHash: H('b') },
    { commitSha: 'c'.repeat(40), author: 'bob', path: 'src/b.mjs', linesChanged: 5, regression: false, timestamp: '2026-07-29T00:00:00Z', sourceHash: H('c') },
  ] });
  return {
    commitRelation: commit.relation,
    issueRelation: issue.relation,
    causalityProven: commit.claims.causalityProven,
    issueProvesDefectLocation: issue.claims.issueProvesDefectLocation,
    moduleCount: modules.modules.length,
    zoneTypes: [...new Set(zones.findings.map((finding) => finding.zoneType))].sort(),
    riskPathCount: risk.paths.length,
    hottestPath: risk.paths[0]?.path ?? null,
  };
}

function measurementProgram() {
  return {
    repositoryId: 'repo', branch: 'main', functions: [
      { id: 'main', entry: 'n1', nodes: [
        { id: 'n1', kind: 'statement', next: ['n2'], reads: [], writes: ['x'], citation: citation('src/main.mjs', 1) },
        { id: 'n2', kind: 'branch', next: ['n3', 'n4'], reads: ['x'], writes: [], citation: citation('src/main.mjs', 2) },
        { id: 'n3', kind: 'call', next: ['n2'], reads: ['x'], writes: [], citation: citation('src/main.mjs', 3) },
        { id: 'n4', kind: 'return', next: [], reads: [], writes: [], citation: citation('src/main.mjs', 4) },
        { id: 'n5', kind: 'statement', next: [], reads: [], writes: ['dead'], citation: citation('src/main.mjs', 5) },
      ], calls: [
        { fromNodeId: 'n3', targetFunctionId: 'helper', dynamic: false, confidence: 1, citation: citation('src/main.mjs', 3) },
        { fromNodeId: 'n2', targetFunctionId: null, dynamic: true, confidence: 0.2, citation: citation('src/main.mjs', 2) },
      ] },
      { id: 'helper', entry: 'h1', nodes: [
        { id: 'h1', kind: 'statement', next: ['h2'], reads: ['x'], writes: ['y'], citation: citation('src/helper.mjs', 1, 'b') },
        { id: 'h2', kind: 'return', next: [], reads: ['y'], writes: [], citation: citation('src/helper.mjs', 2, 'b') },
      ], calls: [] },
    ],
  };
}

function measureProgram() {
  const kernel = new ProgramAnalysisKernel({ maximumInterproceduralDepth: 2 });
  const control = kernel.buildControlFlow(measurementProgram());
  const data = kernel.buildDataFlow(measurementProgram());
  return {
    controlFlowNodes: control.nodeCount,
    controlFlowEdges: control.edgeCount,
    unreachableNodes: control.functions.reduce((sum, fn) => sum + fn.unreachableNodeIds.length, 0),
    ambiguousCallEdges: control.callEdges.filter((edge) => edge.ambiguous).length,
    dataFlowEdges: data.edges.length,
    ambiguousFlows: data.ambiguousFlows.length,
    dynamicTargetsGuessed: data.claims.dynamicTargetsGuessed,
  };
}

function measureVariables() {
  const service = new VariableLineageService();
  service.registerBinding({ repositoryId: 'repo', branch: 'main', bindingId: 'user-name', symbol: 'userName', path: 'src/model.mjs', type: 'string', nullable: false, scope: 'module', serializationName: 'user_name', databaseMapping: 'users.user_name', citation: citation('src/model.mjs') });
  const steps = [
    ['rename', { symbol: 'displayName' }],
    ['move', { path: 'src/profile.mjs' }],
    ['type', { type: 'DisplayName', compatible: true, compatibilityEvidence: [citation('src/types.mjs', 1, 'd')] }],
    ['nullability', { nullable: true }],
    ['scope', { scope: 'class' }],
    ['serialization', { serializationName: 'display_name' }],
    ['database-mapping', { databaseMapping: 'profiles.display_name' }],
  ];
  const hashes = ['a','b','c','d','e','f','1','2'];
  let final;
  steps.forEach(([kind, fields], index) => {
    final = service.transitionBinding('user-name', {
      transitionId: `t${index + 1}`, branch: 'main', kind,
      beforeSourceHash: H(hashes[index]), afterSourceHash: H(hashes[index + 1]),
      citation: citation(index >= 1 ? 'src/profile.mjs' : 'src/model.mjs', 1, hashes[index + 1]), ...fields,
    });
  });
  return {
    transitionCount: final.transitions.length,
    currentSymbol: final.current.symbol,
    currentPath: final.current.path,
    currentType: final.current.type,
    currentNullable: final.current.nullable,
    identityInferredWithoutEvidence: final.claims.identityInferredWithoutEvidence,
  };
}

async function measurePatchAblation() {
  const contract = H('a');
  let creates = 0; let disposals = 0;
  const result = await new CounterfactualPatchAblator().run({
    candidateId: 'measurement-candidate', verificationContractSha256: contract,
    hunks: [{ hunkId: 'required', path: 'src/a.mjs' }, { hunkId: 'extra', path: 'src/b.mjs' }],
    adapter: {
      async createIsolatedCandidate({ hunkId }) { creates += 1; return { workspaceId: `measurement-${hunkId ?? 'baseline'}`, isolated: true }; },
      async removeHunk({ hunk }) { return { removed: true, patchReceiptSha256: H(hunk.hunkId === 'required' ? 'b' : 'c') }; },
      async verify({ workspaceId, verificationContractSha256 }) { return { verified: true, verificationStatus: 'passed', score: workspaceId.endsWith('required') ? 7 : 10, verificationContractSha256, verificationReceiptSha256: H(workspaceId.endsWith('required') ? 'd' : 'e') }; },
      async dispose() { disposals += 1; },
    },
  });
  return {
    classifications: result.items.map((item) => item.classification),
    isolatedCandidatesCreated: creates,
    disposedCandidates: disposals,
    patchAppliedToOriginalWorkspace: result.claims.patchAppliedToOriginalWorkspace,
    mergeOrPublishAllowed: result.claims.mergeOrPublishAllowed,
  };
}

async function measureIntegration() {
  let runtimeLoads = 0;
  const fabric = new RepositoryIntelligenceFabric({
    runtimeFactory: () => { runtimeLoads += 1; return { repository: {}, lexicalIndex: { search: () => [] }, digitalTwin: {}, async close() {} }; },
    embeddingRegistry: { async status() { return { providers: [] }; }, async close() {} },
    polyglotPlane: { async status() { return { state: 'inactive' }; }, async close() {} },
  });
  await fabric.status();
  const before = fabric.completionSnapshot();
  fabric.lexicalSearch('repo', 'needle');
  const afterFastPath = fabric.completionSnapshot();
  await fabric.close();
  return {
    runtimeLoads,
    beforeCompletionServicesLoaded: Object.values(before.loaded).filter(Boolean).length,
    fastPathCompletionServicesLoaded: Object.values(afterFastPath.loaded).filter(Boolean).length,
    servicesLoadedBySnapshot: afterFastPath.claims.servicesLoadedBySnapshot,
    applicationBootstrapModified: afterFastPath.claims.applicationBootstrapModified,
  };
}

export async function measureIntelligenceCompletion({ rootDirectory = process.cwd(), version } = {}) {
  const root = path.resolve(rootDirectory);
  const releaseVersion = String(version ?? JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version);
  const base = {
    schema: 'forge.studio.intelligence-completion-measurement.v1',
    version: releaseVersion,
    promotedRequirementIds: INTELLIGENCE_COMPLETION_REQUIREMENT_IDS,
    context: await measureContext(),
    vectors: await measureVectors(),
    repository: measureRepository(),
    program: measureProgram(),
    variables: measureVariables(),
    patchAblation: await measurePatchAblation(),
    integration: await measureIntegration(),
    boundaries: {
      externalGateCountChanged: false,
      autonomousMutationClaimed: false,
      autonomousMergeOrPublishClaimed: false,
      cloudSandboxClaimed: false,
      comparativeSuperiorityClaimed: false,
      productionBenchmarkClaimed: false,
    },
  };
  return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
}

async function main() {
  const root = path.resolve(process.argv[2] ?? '.');
  const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const output = path.resolve(root, process.argv[3] ?? `docs/intelligence-completion-measurement-${metadata.version}.json`);
  const report = await measureIntelligenceCompletion({ rootDirectory: root, version: metadata.version });
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ output: path.relative(root, output).replaceAll('\\', '/'), receiptSha256: report.receiptSha256 })}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
}
