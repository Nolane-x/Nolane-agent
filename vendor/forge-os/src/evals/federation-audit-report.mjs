import { canonicalSha256 } from '../core/canonical-json.mjs';
import { loadCapabilityCatalog } from '../federation/capability-catalog.mjs';
import { loadFederationSources } from '../federation/source-registry.mjs';
import { loadKnowledgePacks } from '../federation/knowledge-packs.mjs';
import { auditFederationGraph } from './federation-evaluator.mjs';
import { runFederationAdversarialCorpus } from './federation-adversarial.mjs';

function countBy(items, key) {
  const counts = {};
  for (const item of items) {
    const value = item?.[key] ?? 'unknown';
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

export async function buildFederationAuditReport({
  store,
  corpus,
  now = Date.now(),
  capabilityLoader = loadCapabilityCatalog,
  sourceLoader = loadFederationSources,
  knowledgeLoader = loadKnowledgePacks,
} = {}) {
  if (!store || typeof store.read !== 'function') throw new TypeError('Federation catalog store is required');
  if (!Array.isArray(corpus)) throw new TypeError('Federation adversarial corpus is required');

  const [state, capabilities, sources, knowledgePacks] = await Promise.all([
    store.read(), capabilityLoader(), sourceLoader(), knowledgeLoader(),
  ]);
  const graph = auditFederationGraph({ capabilities, providers: state.providers, sources, knowledgePacks, now });
  const adversarial = runFederationAdversarialCorpus(corpus);
  const firstParty = state.providers.filter((provider) => provider.builtIn === true && provider.kind === 'skill');
  const knowledgeMappings = state.providers.filter((provider) => provider.builtIn === true && provider.kind === 'knowledge');
  const external = state.providers.filter((provider) => provider.builtIn !== true);

  const body = {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    catalogRevision: state.revision,
    inventory: {
      capabilities: capabilities.length,
      sources: sources.length,
      knowledgePacks: knowledgePacks.length,
      providers: state.providers.length,
      firstPartyProcedural: firstParty.length,
      stableFirstPartyProcedural: firstParty.filter((provider) => provider.status === 'stable').length,
      candidateFirstPartyProcedural: firstParty.filter((provider) => provider.status === 'candidate').length,
      knowledgeProviderMappings: knowledgeMappings.length,
      builtInProviderMappings: state.providers.filter((provider) => provider.builtIn === true).length,
      externalProvidersImported: external.length,
    },
    coverage: {
      missingAnyProvider: graph.missingProviders.length,
      missingKnowledge: graph.missingKnowledgeProviders.length,
      missingProcedural: graph.missingProceduralProviders.length,
      missingStableProcedural: graph.missingStableProceduralProviders.length,
      unresolvedKnowledgePack: graph.missingKnowledge.length,
    },
    trust: {
      blockers: graph.blockers,
      staleProviders: graph.staleProviders,
      duplicateClusters: graph.duplicateClusters,
      unresolvedSources: graph.unresolvedSources,
      externalByStatus: countBy(external, 'status'),
    },
    sources: {
      byTrust: countBy(sources, 'trust'),
      byAuthority: countBy(sources, 'authority'),
      byKind: countBy(sources, 'kind'),
    },
    adversarial: {
      corpusSha256: adversarial.corpusSha256,
      total: adversarial.summary.total,
      passed: adversarial.summary.passed,
      failed: adversarial.summary.failed,
      failures: adversarial.failures,
    },
    claimsBoundary: {
      capabilityNodesAreContractsNotVendoredExpertPrompts: true,
      externalSourcesAreNotEnabledByDefault: true,
      knowledgeProvidersStoreReferencesNotRemoteContent: true,
      stableProceduralCoverageIsReportedSeparately: true,
    },
  };
  return Object.freeze({ ...body, reportSha256: canonicalSha256(body) });
}
