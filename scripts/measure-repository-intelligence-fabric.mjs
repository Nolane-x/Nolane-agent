import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { createRepositoryIntelligenceFabric } from '../src/repository/repository-intelligence-fabric.mjs';
import { ResourceGovernor } from '../src/runtime/resource-governor.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';

function normalized(values) {
  const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  return norm ? values.map((value) => value / norm) : values;
}

class DeterministicMeasurementEmbeddingProvider {
  constructor() {
    this.id = 'measurement-code-embedding-v1'; this.kind = 'neural'; this.degraded = false; this.dimensions = 4;
    this.modelSha256 = canonicalSha256({ model: 'measurement-code-embedding-v1' }); this.calls = 0; this.texts = 0;
  }
  async available() { return true; }
  async embed(texts) {
    this.calls += 1; this.texts += texts.length;
    return texts.map((text) => {
      const value = String(text).toLowerCase();
      return normalized([
        ['session','credential','token','expire','renew','refresh','auth'].reduce((n, term) => n + (value.includes(term) ? 1 : 0), 0),
        ['invoice','billing','payment','charge','card'].reduce((n, term) => n + (value.includes(term) ? 1 : 0), 0),
        ['test','assert','verify'].reduce((n, term) => n + (value.includes(term) ? 1 : 0), 0),
        0.1,
      ]);
    });
  }
  async close() {}
}

export async function measureRepositoryIntelligenceFabric({ rootDirectory = process.cwd(), version } = {}) {
  const root = path.resolve(rootDirectory);
  const releaseVersion = String(version ?? JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version);
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'forge-repository-intelligence-measurement-'));
  try {
    await mkdir(path.join(fixtureRoot, 'src'), { recursive: true });
    await mkdir(path.join(fixtureRoot, 'tests'), { recursive: true });
    await writeFile(path.join(fixtureRoot, 'src', 'session.mjs'), 'export function renewSession(credential) { if (credential.expired) return refreshToken(credential); return credential; }\nexport function refreshToken(value) { return {...value, expired:false}; }\n');
    await writeFile(path.join(fixtureRoot, 'src', 'billing.mjs'), 'export function renewInvoice(invoice) { return {...invoice, renewed:true}; }\nexport function chargeCard(card) { return Boolean(card); }\n');
    await writeFile(path.join(fixtureRoot, 'tests', 'session.test.mjs'), "import { renewSession } from '../src/session.mjs';\nassert.equal(renewSession({expired:false}).expired, false);\n");
    await writeFile(path.join(fixtureRoot, 'package.json'), JSON.stringify({ name: 'unseen-repository-fixture', scripts: { test: 'node --test', build: 'node build.mjs' }, dependencies: { zod: '^4.0.0' } }));
    const store = new StudioStore(path.join(fixtureRoot, 'studio.db'));
    const provider = new DeterministicMeasurementEmbeddingProvider();
    const governor = new ResourceGovernor();
    const fabric = createRepositoryIntelligenceFabric({ store, governor, embeddingProvider: provider, maxWorkers: 1 });
    const project = store.createProject({ id: 'unseen_repository', name: 'Unseen Repository', workspaceRoot: fixtureRoot });
    const before = await fabric.status();
    const branchContext = { branch: 'feature/repository-intelligence', headSha: 'a'.repeat(40), dirtyHash: 'clean' };
    const firstIndex = await fabric.index(project, { branchContext, priority: 'interactive' });
    const searchStarted = performance.now();
    const search = await fabric.search(project.id, 'renew expired credential', { limit: 5 });
    const searchLatencyMs = Number((performance.now() - searchStarted).toFixed(3));
    const first = search.items[0];
    const firstTexts = provider.texts;
    const secondSearch = await fabric.search(project.id, 'renew expired credential', { limit: 5 });
    const secondTexts = provider.texts - firstTexts;
    const twin = fabric.digitalTwin(project.id, { branchContext, maxNodes: 500, maxEdges: 1_000 });
    const previousChunkRoot = firstIndex.semantic?.chunkRootSha256 ?? null;
    await writeFile(path.join(fixtureRoot, 'src', 'session.mjs'), 'export function renewSession(credential) { if (credential.expired === true) return refreshToken(credential); return credential; }\nexport function refreshToken(value) { return {...value, expired:false}; }\n');
    const secondIndex = await fabric.index(project, { branchContext: { ...branchContext, dirtyHash: 'session-changed' }, priority: 'interactive' });
    const after = await fabric.status();
    const fallbackStore = new StudioStore(path.join(fixtureRoot, 'fallback.db'));
    const fallbackFabric = createRepositoryIntelligenceFabric({ store: fallbackStore, governor: new ResourceGovernor(), maxWorkers: 1 });
    const fallbackStatus = await fallbackFabric.status();
    await fallbackFabric.close(); fallbackStore.close();
    await fabric.close(); store.close();
    const app = await readFile(path.join(root, 'src/app.mjs'), 'utf8');
    const citations = twin.edges.filter((edge) => edge.citation).map((edge) => edge.citation.sourceHash);
    const base = {
      schema: 'forge.studio.repository-intelligence-fabric-measurement.v1', version: releaseVersion,
      lifecycle: { beforeActivation: before.lifecycle, afterActivation: after.lifecycle },
      retrieval: {
        query: 'renew expired credential', topPath: first?.path ?? null, topSymbol: first?.symbol ?? null,
        candidateCount: search.retrieval?.candidateCount ?? 0, scannedChunks: search.retrieval?.scannedChunks ?? 0,
        embeddedCandidates: search.retrieval?.embeddedCandidates ?? 0, maxCandidates: search.retrieval?.maxCandidates ?? null,
        providerId: search.retrieval?.providerId ?? null, modelSha256: search.retrieval?.modelSha256 ?? null,
        degraded: search.retrieval?.degraded ?? null, searchLatencyMs, secondSearchAdditionalEmbeddedTexts: secondTexts,
        stableTopResult: secondSearch.items[0]?.path === first?.path,
      },
      indexing: {
        firstGeneratedEmbeddings: firstIndex.semantic?.generatedEmbeddings ?? 0, firstReusedEmbeddings: firstIndex.semantic?.reusedEmbeddings ?? 0,
        secondGeneratedEmbeddings: secondIndex.semantic?.generatedEmbeddings ?? 0, secondReusedEmbeddings: secondIndex.semantic?.reusedEmbeddings ?? 0,
        previousChunkRoot, currentChunkRoot: secondIndex.semantic?.chunkRootSha256 ?? null,
        branch: secondIndex.semantic?.provenance?.branch ?? null, dirtyHash: secondIndex.semantic?.provenance?.dirtyHash ?? null,
      },
      digitalTwin: {
        nodes: twin.nodes.length, edges: twin.edges.length, totalNodes: twin.totalNodes, totalEdges: twin.totalEdges,
        kinds: [...new Set(twin.nodes.map((node) => node.kind))].sort(), unknowns: twin.unknowns,
        citationsValid: citations.length > 0 && citations.every((digest) => /^[a-f0-9]{64}$/.test(digest)), twinSha256: twin.twinSha256,
      },
      fallback: fallbackStatus.embedding.providers[0] ?? null,
      composition: { appStaticImports: (app.match(/^import\s.+$/gm) ?? []).length, appConstructors: (app.match(/\bnew\s+[A-Z][A-Za-z0-9_$]*/g) ?? []).length },
      boundaries: { operatedOnnxModelClaimed: false, productionNeuralPackBundled: false, comparativeSuperiorityClaimed: false, realRepositoryBenchmarkClaimed: false, runtimeDigitalTwinEdgesClaimed: false },
    };
    return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  } finally { await rm(fixtureRoot, { recursive: true, force: true }); }
}

async function main() {
  const root = path.resolve(process.argv[2] ?? '.');
  const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const output = path.resolve(root, process.argv[3] ?? `docs/repository-intelligence-fabric-measurement-${metadata.version}.json`);
  const report = await measureRepositoryIntelligenceFabric({ rootDirectory: root, version: metadata.version });
  await mkdir(path.dirname(output), { recursive: true }); await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ output: path.relative(root, output).replaceAll('\\', '/'), receiptSha256: report.receiptSha256 })}\n`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
