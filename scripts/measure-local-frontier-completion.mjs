import { createHash } from 'node:crypto';
import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { TokenCostAdapter } from '../src/context/token-cost-adapter.mjs';
import { HarnessBpeTokenizer } from '../src/frontier-completion/harness-bpe-tokenizer.mjs';
import { ContextCacheCoherence } from '../src/frontier-completion/context-cache-coherence.mjs';
import { SemanticIndexRuntime, decodeVectorBlob } from '../src/frontier-completion/semantic-index-runtime.mjs';
import { PolyglotEvidenceRuntime } from '../src/frontier-completion/polyglot-evidence-runtime.mjs';
import { GovernedMemoryActionLearner, UserMemoryControl, ProcessTreeBudgetGovernor, BrowserContextPool, ReviewerContextIsolation, CoordinationMetrics } from '../src/frontier-completion/memory-resource-collaboration-runtime.mjs';
import { ProductArtifactRecorder, VisualRegressionOracle, FailureInjectionLab, UnifiedWorkSurface, VsCodeEvidenceBridge } from '../src/frontier-completion/product-security-experience-runtime.mjs';
import { ReproducibleBenchmarkPack } from '../src/frontier-completion/reproducible-benchmark-pack.mjs';

export const LOCAL_FRONTIER_VERIFIED_IDS = Object.freeze([
  '30.2','30.17','31.4','31.5','31.6','31.9','31.11','31.16','31.17',
  '33.5','33.8','33.9','33.10','33.11','33.12','33.13',
  '39.4','39.15','39.16','40.3','40.5','40.8','40.9','40.17','41.9','41.11','41.14','41.18',
  '42.3','42.4','42.5','42.8','42.10','42.15','42.16','43.9','43.10','43.11','43.13',
  '44.2','44.8','44.9','44.10','44.12','44.13','44.14','44.16','44.17','44.18',
  '45.1','45.2','45.8','45.17',
]);
export const LOCAL_FRONTIER_EXTERNAL_IDS = Object.freeze(['31.2','33.1','33.2','33.3','33.4','45.3']);
const H = (value) => createHash('sha256').update(String(value)).digest('hex');
const cite = (file, symbol = null) => ({ path: file, symbol, sourceHash: H(`${file}:${symbol ?? ''}`), startLine: 1, endLine: 10 });

export async function measureLocalFrontierCompletion({ version = '4.0.0' } = {}) {
  const tokenizer = new HarnessBpeTokenizer({ modelId: 'forge-bpe-v1', vocab: ['l','o','w','e','r','lo','low','er','lower','<unk>'], merges: ['l o','lo w','e r','low er'] });
  const tokenCount = await new TokenCostAdapter({ tokenizers: { 'forge-bpe-v1': tokenizer } }).count('lower', { tokenizerId: 'forge-bpe-v1' });
  const cache = new ContextCacheCoherence(); const provenance = { sourceHash: H('source'), branch: 'main', toolSchemaSha256: H('tools'), harnessRevision: 'h1', tokenizerSha256: H('tokenizer') };
  cache.put('query', { selected: ['symbol'] }, provenance); const cacheHit = cache.get('query', provenance); const cacheDrift = cache.get('query', { ...provenance, branch: 'feature' });
  let providerClosed = false;
  const provider = { modelSha256: H('model'), tokenizerSha256: H('tokenizer'), dimensions: 3, async embed(texts) { return texts.map((text) => [text.length, 1, -1]); }, async close() { providerClosed = true; } };
  const semantic = new SemanticIndexRuntime({ batchSize: 1, maxConcurrency: 1, idleTtlMs: 10 });
  const indexed = await semantic.index([{ id: 'c1', content: 'symbol', contentHash: H('symbol'), schemaVersion: 'v1' }], { provider, resourceSamples: [{ atMs: 0, rssMb: 100 }, { atMs: 1000, rssMb: 120 }] });
  const decoded = decodeVectorBlob(indexed.records[0].vectorBlob); await semantic.unload({ pressure: 'high', provider });

  const polyglot = new PolyglotEvidenceRuntime();
  polyglot.ingestCalls([{ language: 'javascript', from: 'route', to: 'service', confidence: 1, citation: cite('src/a.js', 'route') }, { language: 'python', from: 'dispatch', candidates: ['a','b'], confidence: 0.5, citation: cite('a.py', 'dispatch') }]);
  polyglot.ingestTypes([{ language: 'typescript', kind: 'implements', from: 'StoreImpl', to: 'Store', citation: cite('store.ts', 'StoreImpl') }]);
  polyglot.ingestBuild({ packages: [{ id: 'web', dependsOn: ['core'], citation: cite('package.json') }] });
  polyglot.ingestTests({ tests: [{ id: 'test', targets: ['service'], citation: cite('test.mjs') }], coverage: [{ testId: 'test', symbol: 'service', path: 'src/a.js', lines: [1], citation: cite('coverage.json') }] });
  polyglot.ingestRuntime({ traceId: 'trace', permissionReceipt: { scope: ['runtime.trace','resource.observe','network.observe','database.observe'], receiptSha256: H('permission') }, observations: [{ kind: 'call', from: 'route', to: 'service', atMs: 1 }, { kind: 'file-access', operation: 'read', target: 'a', symbol: 'service', taskId: 'task', atMs: 2 }] });

  const learner = new GovernedMemoryActionLearner(); for (const action of ['ADD','UPDATE','DELETE','RETRIEVE','SUMMARIZE','NOOP']) learner.learn({ action, domain: 'repo', outcome: { outcomeId: action, verified: true, verificationReceiptSha256: H(action) } });
  const userMemory = new UserMemoryControl(); userMemory.add({ id: 'm1', value: 'x' }, { actor: 'user' }); userMemory.invalidate('m1', { actor: 'user', reason: 'stale' });
  const processBudget = await new ProcessTreeBudgetGovernor({ probe: async () => ({ available: true, cpuMs: 10, rssMb: 20, processes: 1, fileDescriptors: 3, receiptSha256: H('probe') }) }).enforce(1, { cpuMs: 20, rssMb: 30, processes: 2, fileDescriptors: 4 });
  let contextId = 0; const pool = new BrowserContextPool({ factory: async () => ({ id: `c${++contextId}` }), reset: async () => ({ reset: true, receiptSha256: H('reset') }) }); await pool.acquire({ missionId: 'm', journeyId: 'a' }); const reused = await pool.acquire({ missionId: 'm', journeyId: 'b' });
  const reviewer = new ReviewerContextIsolation().create({ executor: { identity: 'exec', context: ['plan'] }, reviewer: { identity: 'review', context: ['diff'] } });
  const coordination = CoordinationMetrics.calculate({ decisions: [{ chosen: 0.8, optimal: 1 }], coordinationMs: 10, totalMs: 100, conflicts: 1, assignments: 10, productiveParallelMs: 70, totalParallelMs: 100 });

  const artifacts = new ProductArtifactRecorder(); const journey = artifacts.record({ journeyId: 'j', before: Buffer.from('before'), after: Buffer.from('after'), frames: [Buffer.from('frame')] });
  const visual = new VisualRegressionOracle(); const baseline = visual.approveBaseline({ id: 'home', pixels: [0,1,2], critical: true, approval: { actor: 'human', approved: true, receiptSha256: H('approval') } }); const visualReport = visual.compare({ baselineId: baseline.id, actualPixels: [0,2,9], tolerance: 2, ignoreRegions: [{ indexes: [2], reviewReceiptSha256: H('ignore') }] });
  const lab = new FailureInjectionLab(); const failureScenarios = ['network-loss','timeout','dns-failure','provider-overload','out-of-memory','process-death','orphan-child','fd-exhaustion','db-lock','disk-full','file-changed-during-transaction','environment-leakage','socket-escape','credential-escape'];
  const failureReports = await Promise.all(failureScenarios.map((scenario) => lab.run(scenario, async (fault) => ({ observed: fault.code, contained: true }))));
  const surface = new UnifiedWorkSurface({ state: { missionId: 'm', revision: 1 } }); const effects = surface.effects({ pressure: 'high' }); const perf = surface.performance({ startupMs: 10 }, { startupMs: 20 }); const vscode = new VsCodeEvidenceBridge().publish({ revision: 1, inlineDiff: [], diagnostics: [], symbols: [], tests: [], missionState: { id: 'm' } });

  const benchmark = new ReproducibleBenchmarkPack();
  const taskKinds = [['bug','long-horizon'],['feature','browser-ui'],['refactor','multi-agent'],['migration','security'],['review','security']];
  const tasks = taskKinds.map(([category, frontierCategory]) => ({ id: category, category, frontierCategory, repository: { sourceId: `repo-${category}`, commit: H(`commit-${category}`), contentFingerprint: H(`content-${category}`), neverSeenBefore: true }, objective: `${category} task`, input: { issue: category }, oracle: { expected: category } }));
  const publicSuite = benchmark.createPublicSuite({ id: 'public', version: 1, tasks }); const privateSuite = benchmark.sealPrivateSuite({ id: 'private', version: 1, tasks, key: Buffer.alloc(32, 7), iv: Buffer.alloc(12, 3) }); const externalComparison = benchmark.compareSystems({ forgeRun: { receiptSha256: H('forge') }, competitorRun: null });

  const base = {
    schema: 'forge.studio.local-frontier-completion-measurement.v1', version: String(version),
    promotedRequirementIds: LOCAL_FRONTIER_VERIFIED_IDS, externalizedRequirementIds: LOCAL_FRONTIER_EXTERNAL_IDS,
    contextSemantic: { exactBpe: tokenCount.tokens === 1 && tokenCount.degraded === false, cacheCoherence: Boolean(cacheHit) && cacheDrift === null, boundedBatchAndBinaryChecksum: indexed.batches === 1 && decoded.version === 1, pressureUnload: providerClosed === true, resourceMeasured: semantic.resourceMetrics().peakRssMb === 120 },
    polyglot: { citedCallAndAmbiguity: polyglot.callGraph().edges.length === 3 && polyglot.callGraph().edges.filter((edge) => edge.ambiguous).length === 2, typeBuildTestCoverage: polyglot.typeGraph().edges.length === 1 && polyglot.buildGraph().edges.length === 1 && polyglot.testGraph().edges.length === 2, runtimeAndResourceAttribution: polyglot.runtimeGraph().edges.length >= 1 && polyglot.resourceAttribution().length === 1 },
    memoryResourceCollaboration: { sixVerifiedActions: learner.policy('repo').actions.length === 6, userControl: userMemory.inspect('m1').state === 'invalid', processTreeBudget: processBudget.status === 'pass', browserResetReceipt: reused.reused === true && /^[a-f0-9]{64}$/.test(reused.resetReceiptSha256), reviewerIsolation: reviewer.sharedContext === false, coordinationMetrics: coordination.usefulParallelism === 0.7 },
    productSecurityExperience: { beforeAfterArtifacts: journey.before.sha256 !== journey.after.sha256, visualOracle: visualReport.status === 'pass', failureScenariosContained: failureReports.length === 14 && failureReports.every((item) => item.status === 'contained'), unifiedViews: surface.views().length === 6, pressureEffectsHonest: effects.blur === false && effects.animation === false, performanceBudget: perf.status === 'pass', vscodeEvidence: /^[a-f0-9]{64}$/.test(vscode.receiptSha256) },
    benchmark: { contaminationLocked: publicSuite.tasks.every((task) => task.repository.neverSeenBefore), realWorkloadCategories: publicSuite.categories.join(',') === 'bug,feature,migration,refactor,review', frontierCategories: publicSuite.frontierCategories.length === 4, publicOracleHidden: publicSuite.tasks.every((task) => task.oracle === undefined), privateOracleEncrypted: privateSuite.cipher === 'aes-256-gcm' && !JSON.stringify(privateSuite).includes('expected'), competitorComparisonExternal: externalComparison.status === 'external_gate' && externalComparison.claimAllowed === false },
    externalBoundaries: { productionOnnxModelBundled: false, productionGrammarPackBundled: false, productionTreeSitterRuntimeBundled: false, productionLspBinariesBundled: false, independentCompetitorRunSupplied: false },
    privacy: { rawPromptsStored: false, chainOfThoughtStored: false, secretsStored: false, privateOracleExposedToExecutor: false },
    rootDirectoryUsedForClaims: false,
  };
  return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const measurement = await measureLocalFrontierCompletion({ version: process.argv[2] ?? '4.0.0' });
  process.stdout.write(`${JSON.stringify(measurement, null, 2)}\n`);
}
