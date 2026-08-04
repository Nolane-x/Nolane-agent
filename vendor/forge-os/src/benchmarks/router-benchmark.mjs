import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalSha256 } from '../core/canonical-json.mjs';
import { loadCapabilityGraphV2 } from '../capabilities/v2/compiler.mjs';
import { loadBuiltInProviders } from '../federation/local-provider-seed.mjs';
import { routeSkillIntelligence } from '../intelligence/router.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_CORPUS = path.join(ROOT, 'benchmarks/router/public-corpus.json');
const DEFAULT_GRAPH = path.join(ROOT, 'capabilities-v2/graph.json');
const DEFAULT_PROVIDERS = path.join(ROOT, 'providers/built-in-providers.json');

const round = (value) => Number(value.toFixed(6));

function selectedTechniqueIds(plan, limit = 6) {
  const ordered = [];
  for (const item of plan.inclusions ?? []) {
    if (!ordered.includes(item.id)) ordered.push(item.id);
    if (ordered.length >= limit) break;
  }
  return ordered;
}

function hit(expected, selected, k) {
  const accepted = new Set(expected);
  return selected.slice(0, k).some((id) => accepted.has(id));
}

function unsafeSelection(plan, providerMap) {
  for (const step of plan.steps ?? []) {
    const provider = providerMap.get(step.providerId);
    if (!provider || provider.status !== 'stable' || provider.trust?.blockers?.length) return true;
  }
  return false;
}

export async function runRouterBenchmark({ corpusFile = DEFAULT_CORPUS, graphFile = DEFAULT_GRAPH, providersFile = DEFAULT_PROVIDERS } = {}) {
  const [corpus, graph, providers] = await Promise.all([
    readFile(corpusFile, 'utf8').then(JSON.parse),
    loadCapabilityGraphV2(graphFile),
    loadBuiltInProviders(providersFile),
  ]);
  const providerMap = new Map(providers.map((provider) => [provider.providerId, provider]));
  const rows = [];
  let p1 = 0;
  let p3 = 0;
  let r6 = 0;
  let unsafe = 0;
  let deterministic = 0;

  for (const testCase of corpus) {
    const args = {
      graph,
      providers,
      intent: {
        query: testCase.query,
        domains: testCase.domains ?? [],
        targetOutcomeIds: testCase.targetOutcomeIds ?? [],
        taskClass: testCase.taskClass ?? 'generic',
        maxOutcomes: testCase.maxOutcomes ?? Math.max(1, testCase.targetOutcomeIds?.length ?? 1),
      },
      context: {
        model: testCase.model ?? 'gpt-5.6',
        tools: testCase.tools ?? [],
        assurance: testCase.assurance ?? 'A1',
        operation: testCase.operation ?? 'routine',
        allowExternal: false,
      },
    };
    const first = routeSkillIntelligence(args);
    const second = routeSkillIntelligence(args);
    const selected = selectedTechniqueIds(first, 6);
    const at1 = hit(testCase.expected, selected, 1);
    const at3 = hit(testCase.expected, selected, 3);
    const at6 = hit(testCase.expected, selected, 6);
    const isUnsafe = unsafeSelection(first, providerMap);
    const isDeterministic = first.routePlanSha256 === second.routePlanSha256;
    if (at1) p1++;
    if (at3) p3++;
    if (at6) r6++;
    if (isUnsafe) unsafe++;
    if (isDeterministic) deterministic++;
    rows.push({
      id: testCase.id,
      expected: [...testCase.expected],
      selected,
      precisionAt1: at1,
      precisionAt3: at3,
      recallAt6: at6,
      unsafe: isUnsafe,
      deterministic: isDeterministic,
      blockers: [...(first.blockers ?? [])],
      routePlanSha256: first.routePlanSha256,
    });
  }

  const count = corpus.length;
  const payload = {
    schemaVersion: 1,
    benchmarkId: 'forgeos-router-public-v1',
    cases: count,
    metrics: {
      precisionAt1: round(p1 / count),
      precisionAt3: round(p3 / count),
      recallAt6: round(r6 / count),
      unsafeActivationRate: round(unsafe / count),
      determinism: round(deterministic / count),
    },
    rows,
    corpusSha256: canonicalSha256(corpus),
    graphSha256: graph.graphSha256,
    providerCatalogSha256: canonicalSha256(providers),
  };
  return Object.freeze({ ...payload, reportSha256: canonicalSha256(payload) });
}
