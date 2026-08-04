import { HarnessBpeTokenizer } from './harness-bpe-tokenizer.mjs';
import { ContextCacheCoherence } from './context-cache-coherence.mjs';
import { SemanticIndexRuntime } from './semantic-index-runtime.mjs';
import { PolyglotEvidenceRuntime } from './polyglot-evidence-runtime.mjs';
import {
  GovernedMemoryActionLearner, UserMemoryControl, RepositoryCausalMemory, ProcessTreeBudgetGovernor,
  ResourceLeaseManager, BrowserContextPool, DemandAwareResourceCoordinator, StartupRssBudget,
  ReviewerContextIsolation, GraphOwnershipResolver, CoalitionCommunicationGovernor, CoordinationMetrics,
} from './memory-resource-collaboration-runtime.mjs';
import {
  ProductArtifactRecorder, VisualRegressionOracle, JourneyContextReuse, AccessibilityAcceptance,
  ArtifactPlayback, FailureInjectionLab, UnifiedWorkSurface, VsCodeEvidenceBridge,
} from './product-security-experience-runtime.mjs';
import { ReproducibleBenchmarkPack } from './reproducible-benchmark-pack.mjs';

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

export class LocalFrontierCompletionPlane {
  constructor(options = {}) {
    this.options = options; this.closed = false;
    this._contextSemantic = null; this._polyglot = null; this._memoryResourceCollaboration = null; this._productSecurityExperience = null; this._benchmark = null;
  }
  #open() { if (this.closed) throw new Error('Local Frontier Completion Plane is closed'); }
  get contextSemantic() {
    this.#open();
    return this._contextSemantic ??= freeze({
      createTokenizer: (options) => new HarnessBpeTokenizer(options),
      createCache: (options) => new ContextCacheCoherence(options),
      createSemanticIndex: (options) => new SemanticIndexRuntime(options),
    });
  }
  get polyglot() { this.#open(); return this._polyglot ??= freeze({ runtime: new PolyglotEvidenceRuntime() }); }
  get memoryResourceCollaboration() {
    this.#open();
    return this._memoryResourceCollaboration ??= freeze({
      createMemoryLearner: () => new GovernedMemoryActionLearner(), createUserMemoryControl: () => new UserMemoryControl(), createCausalMemory: () => new RepositoryCausalMemory(),
      createProcessGovernor: (options) => new ProcessTreeBudgetGovernor(options), createResourceLeases: (options) => new ResourceLeaseManager(options), createBrowserPool: (options) => new BrowserContextPool(options),
      createDemandCoordinator: () => new DemandAwareResourceCoordinator(), createStartupBudget: (options) => new StartupRssBudget(options), createReviewerIsolation: () => new ReviewerContextIsolation(),
      createOwnershipResolver: () => new GraphOwnershipResolver(), createCoalitionGovernor: (options) => new CoalitionCommunicationGovernor(options), coordinationMetrics: CoordinationMetrics,
    });
  }
  get productSecurityExperience() {
    this.#open();
    return this._productSecurityExperience ??= freeze({
      artifacts: new ProductArtifactRecorder(), visuals: new VisualRegressionOracle(), accessibility: new AccessibilityAcceptance(), playback: new ArtifactPlayback(), failures: new FailureInjectionLab(),
      createJourneyReuse: (options) => new JourneyContextReuse(options), createWorkSurface: (options) => new UnifiedWorkSurface(options), vscode: new VsCodeEvidenceBridge(),
    });
  }
  get benchmark() { this.#open(); return this._benchmark ??= freeze({ pack: new ReproducibleBenchmarkPack(this.options.benchmark ?? {}) }); }
  snapshot() {
    return freeze({ schema: 'forge.local-frontier-completion-plane-snapshot.v1', lifecycle: { closed: this.closed, contextSemanticLoaded: this._contextSemantic !== null, polyglotLoaded: this._polyglot !== null, memoryResourceCollaborationLoaded: this._memoryResourceCollaboration !== null, productSecurityExperienceLoaded: this._productSecurityExperience !== null, benchmarkLoaded: this._benchmark !== null }, claims: { productionOnnxBundled: false, productionGrammarPackBundled: false, productionLspRuntimeBundled: false, competitorComparisonCertified: false, localCompletionEvidenceOnly: true } });
  }
  close() { this.closed = true; return this.snapshot(); }
}
