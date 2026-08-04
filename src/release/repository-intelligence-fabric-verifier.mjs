import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { expectedFrontierAuditCounts } from './frontier-audit-counts.mjs';

const SHA = /^[a-f0-9]{64}$/;
async function source(root, relative, failures) { try { return await readFile(path.join(root, relative), 'utf8'); } catch { failures.push(`missing ${relative}`); return ''; } }
async function present(root, relative, failures) { try { await access(path.join(root, relative)); } catch { failures.push(`missing ${relative}`); } }
function requirePattern(text, pattern, label, failures) { if (!pattern.test(text)) failures.push(`missing behavior: ${label}`); }

export async function verifyRepositoryIntelligenceFabric({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory); const releaseVersion = String(version ?? ''); const failures = [];
  for (const file of [
    'src/repository/embedding-provider.mjs','src/repository/embedding-model-pack.mjs','src/repository/onnx-code-embedding-provider.mjs','src/repository/quantized-vector-codec.mjs','src/repository/hybrid-code-reranker.mjs','src/repository/merkle-index.mjs','src/repository/secure-semantic-index.mjs','src/repository/repository-digital-twin-service.mjs','src/repository/repository-intelligence-fabric.mjs',
    'tests/embedding-provider-registry.test.mjs','tests/onnx-code-embedding-provider.test.mjs','tests/quantized-vector-codec.test.mjs','tests/hybrid-code-reranker.test.mjs','tests/merkle-chunk-index.test.mjs','tests/repository-digital-twin-service.test.mjs','tests/repository-intelligence-fabric.test.mjs','tests/repository-intelligence-fabric-app-wiring.test.mjs',
  ]) await present(root, file, failures);
  const providers = await source(root, 'src/repository/embedding-provider.mjs', failures);
  const semantic = await source(root, 'src/repository/secure-semantic-index.mjs', failures);
  const twin = await source(root, 'src/repository/repository-digital-twin-service.mjs', failures);
  const fabric = await source(root, 'src/repository/repository-intelligence-fabric.mjs', failures);
  requirePattern(providers, /(?=[\s\S]*EmbeddingProviderRegistry)(?=[\s\S]*degraded)(?=[\s\S]*modelSha256)(?=[\s\S]*forge\.embedding-provider-registry\.v1)/, 'explicit provider registry and degraded fallback', failures);
  requirePattern(semantic, /maxSearchCandidates[\s\S]*semantic_vector_cache[\s\S]*buildChunkMerkleTree[\s\S]*branchFingerprint/, 'candidate narrowing, quantized cache, chunk Merkle, and branch provenance', failures);
  requirePattern(twin, /(?=[\s\S]*forge\.repository-digital-twin\.v1)(?=[\s\S]*runtime-observation-unavailable)(?=[\s\S]*citation)/, 'citation-bound digital twin with explicit runtime unknowns', failures);
  requirePattern(fabric, /runtimeFactory[\s\S]*semanticIndexing[\s\S]*lexicalOnlySearch[\s\S]*digitalTwin/, 'lazy pressure-aware fabric preserving lexical evidence', failures);
  let measurement = null; try { measurement = JSON.parse(await source(root, `docs/repository-intelligence-fabric-measurement-${releaseVersion}.json`, failures)); } catch { failures.push('measurement JSON is invalid'); }
  if (measurement) {
    if (measurement.version !== releaseVersion) failures.push('measurement version mismatch');
    if (measurement.lifecycle?.beforeActivation !== 'inactive' || measurement.lifecycle?.afterActivation !== 'active') failures.push('lazy activation was not measured');
    if (!(measurement.retrieval?.candidateCount > 0) || measurement.retrieval.candidateCount > 300 || measurement.retrieval.scannedChunks < measurement.retrieval.candidateCount) failures.push('two-stage candidate narrowing was not measured');
    if (measurement.retrieval?.topPath !== 'src/session.mjs' || measurement.retrieval?.degraded !== false) failures.push('injected semantic reranking did not select the conceptual target');
    if (!(measurement.indexing?.secondReusedEmbeddings > 0) || !(measurement.indexing?.secondGeneratedEmbeddings < measurement.indexing?.firstGeneratedEmbeddings)) failures.push('chunk-level incremental reuse was not measured');
    if (measurement.digitalTwin?.citationsValid !== true || !(measurement.digitalTwin?.nodes > 0) || !(measurement.digitalTwin?.edges > 0)) failures.push('digital twin citations were not measured');
    if (measurement.fallback?.degraded !== true || measurement.fallback?.kind !== 'feature-hash') failures.push('degraded Core fallback was not measured');
    if (measurement.composition?.appStaticImports > 160 || measurement.composition?.appConstructors > 180) failures.push('app composition budget exceeded');
    if (measurement.boundaries?.operatedOnnxModelClaimed !== false || measurement.boundaries?.comparativeSuperiorityClaimed !== false || measurement.boundaries?.realRepositoryBenchmarkClaimed !== false) failures.push('measurement boundaries are inflated');
    const unsigned = { ...measurement }; delete unsigned.receiptSha256;
    if (!SHA.test(measurement.receiptSha256 ?? '') || canonicalSha256(unsigned) !== measurement.receiptSha256) failures.push('measurement receipt invalid');
  }
  let audit = null; try { audit = JSON.parse(await source(root, `docs/feature-audit-${releaseVersion}.json`, failures)); } catch { failures.push('frontier audit JSON invalid'); }
  const expected = expectedFrontierAuditCounts(releaseVersion);
  if (!audit || audit.totalItems !== 1150 || JSON.stringify(audit.summary) !== JSON.stringify(expected)) failures.push('1,150-item audit counts are not honest');
  const limitations = await source(root, `docs/LIMITATIONS-${releaseVersion}.md`, failures);
  for (const [pattern, label] of [
    [/does not include|không.*đóng gói.*ONNX|operated ONNX/i, 'operated ONNX non-claim'],
    [/measurement adapter|adapter.*đo.*không.*production|synthetic.*adapter/i, 'measurement adapter limitation'],
    [/does not claim.*outperform|không.*vượt.*Cursor|comparative superiority/i, 'comparative non-claim'],
    [/runtime.*unknown|runtime-observation-unavailable|không.*suy diễn.*runtime/i, 'runtime twin non-claim'],
  ]) requirePattern(limitations, pattern, label, failures);
  const boundaries = Object.freeze({ operatedOnnxModelClaimed: false, productionNeuralPackBundled: false, comparativeSuperiorityClaimed: false, independentRepositoryBenchmarkClaimed: false, runtimeDigitalTwinEdgesClaimed: false });
  const base = { schema: 'forge.studio.repository-intelligence-fabric-verification.v1', version: releaseVersion, status: failures.length ? 'fail' : 'pass', auditCounts: audit?.summary ?? null, measurement, boundaries, failures: Object.freeze(failures) };
  const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  if (outputFile) { await mkdir(path.dirname(path.resolve(outputFile)), { recursive: true }); await writeFile(path.resolve(outputFile), `${JSON.stringify(report, null, 2)}\n`); }
  if (failures.length) { const error = new Error(`Repository Intelligence Fabric verification failed with ${failures.length} issue(s)`); error.code = 'REPOSITORY_INTELLIGENCE_FABRIC_VERIFICATION_FAILED'; error.report = report; throw error; }
  return report;
}
