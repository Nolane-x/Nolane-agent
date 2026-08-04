import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const REQUIRED = Object.freeze([
  'src/context/evidence-graph-runtime-service.mjs',
  'src/context/hybrid-evidence-retrieval-service.mjs',
  'src/context/context-packet-runtime-service.mjs',
  'src/context/evidence-context-runtime.mjs',
  'src/agent/agent-loop.mjs',
  'src/agents/subagent-orchestrator.mjs',
  'src/app.mjs',
  'src/server/routes.mjs',
  'src/server/http-server.mjs',
  'ui/evidence-runtime-center.js',
  'ui/evidence-runtime-center.css',
  'tests/evidence-graph-runtime-service.test.mjs',
  'tests/hybrid-evidence-retrieval-service.test.mjs',
  'tests/context-packet-runtime-service.test.mjs',
  'tests/agent-loop-evidence-runtime.test.mjs',
  'tests/subagent-structured-handoff.test.mjs',
  'tests/evidence-runtime-http-api.test.mjs',
  'tests/evidence-runtime-ui.test.mjs',
  'tests/evidence-context-runtime-release-gate.test.mjs',
  'src/release/full-release-matrix.mjs',
]);

async function source(root, relative, failures) {
  try { return await readFile(path.join(root, relative), 'utf8'); }
  catch { failures.push(`missing required source: ${relative}`); return ''; }
}
function requirePattern(text, pattern, label, failures) { if (!pattern.test(text)) failures.push(`missing ${label}`); }
function counts(audit) {
  const output = { verified_source_test: 0, partial: 0, external_gate: 0, not_implemented: 0 };
  for (const section of audit?.sections ?? []) { if (Number(section.number) > 28) continue; for (const item of section.items ?? []) if (Object.hasOwn(output, item.status)) output[item.status] += 1; }
  return Object.freeze(output);
}

export async function verifyEvidenceContextRuntime({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory); const releaseVersion = String(version ?? '').trim(); const failures = []; const contents = new Map();
  for (const relative of REQUIRED) contents.set(relative, await source(root, relative, failures));
  const graph = contents.get('src/context/evidence-graph-runtime-service.mjs') ?? '';
  const retrieval = contents.get('src/context/hybrid-evidence-retrieval-service.mjs') ?? '';
  const packets = contents.get('src/context/context-packet-runtime-service.mjs') ?? '';
  const facade = contents.get('src/context/evidence-context-runtime.mjs') ?? '';
  const loop = contents.get('src/agent/agent-loop.mjs') ?? '';
  const subagents = contents.get('src/agents/subagent-orchestrator.mjs') ?? '';
  const app = contents.get('src/app.mjs') ?? '';
  const routes = contents.get('src/server/routes.mjs') ?? '';
  const ui = contents.get('ui/evidence-runtime-center.js') ?? '';
  const matrix = contents.get('src/release/full-release-matrix.mjs') ?? '';

  requirePattern(graph, /(?=[\s\S]*evidence_graph_nodes)(?=[\s\S]*evidence_graph_edges)(?=[\s\S]*Requirement)(?=[\s\S]*contradicts)(?=[\s\S]*valid_until)(?=[\s\S]*receipt_sha256)/, 'typed durable evidence graph with provenance and leases', failures);
  requirePattern(graph, /(?=[\s\S]*file_changed)(?=[\s\S]*test_rerun)(?=[\s\S]*plan_revised)(?=[\s\S]*dependency_updated)(?=[\s\S]*artifactize)(?=[\s\S]*validateSubagentResult)/, 'lease invalidation, lossless compaction, and structured subagent validation', failures);
  requirePattern(retrieval, /(?=[\s\S]*lexical)(?=[\s\S]*semantic)(?=[\s\S]*structural)(?=[\s\S]*runtime)(?=[\s\S]*historical)(?=[\s\S]*1\s*\/\s*\(60\s*\+\s*rank\))(?=[\s\S]*counterEvidence)/, 'five-source RRF retrieval with counter-evidence', failures);
  requirePattern(packets, /(?=[\s\S]*forge\.structured-context-packet\.v1)(?=[\s\S]*completionCriteria)(?=[\s\S]*leaseSummary)(?=[\s\S]*COUNTER_EVIDENCE_MISSING)(?=[\s\S]*executed:\s*false)(?=[\s\S]*hypothesesRejected)/, 'structured packet, lease audit, and non-mutating recovery', failures);
  requirePattern(facade, /(?=[\s\S]*graphIndexReceiptSha256)(?=[\s\S]*supports)(?=[\s\S]*refutes)(?=[\s\S]*governed-evidence-context-packet)(?=[\s\S]*priority:\s*995)/, 'evidence graph indexing and governed AgentLoop reference', failures);
  requirePattern(loop, /(?=[\s\S]*evidenceContextRuntime)(?=[\s\S]*agentReference)(?=[\s\S]*agent\.evidence-context\.selected)(?=[\s\S]*buildContextPack)/, 'AgentLoop packet selection before model routing', failures);
  requirePattern(subagents, /(?=[\s\S]*resultValidator)(?=[\s\S]*structuredResult)(?=[\s\S]*structuredResultReceiptSha256)(?=[\s\S]*SUBAGENT_RESULT_VALIDATOR_REQUIRED)/, 'structured subagent result validation', failures);
  requirePattern(app, /(?=[\s\S]*new EvidenceGraphRuntimeService)(?=[\s\S]*new HybridEvidenceRetrievalService)(?=[\s\S]*new ContextPacketRuntimeService)(?=[\s\S]*new EvidenceContextRuntime)(?=[\s\S]*lexical:)(?=[\s\S]*semantic:)(?=[\s\S]*structural:)(?=[\s\S]*runtime:)(?=[\s\S]*historical:)/, 'shared local runtime and five app retriever adapters', failures);
  requirePattern(routes, /(?=[\s\S]*\/api\/evidence-runtime\/graph)(?=[\s\S]*\/api\/evidence-runtime\/retrieve)(?=[\s\S]*\/api\/evidence-runtime\/packet)(?=[\s\S]*\/api\/evidence-runtime\/invalidate)(?=[\s\S]*req\.forgePrincipal\?\.subject)/, 'authenticated bounded evidence runtime API', failures);
  requirePattern(ui, /(?=[\s\S]*Graph)(?=[\s\S]*Retrieval)(?=[\s\S]*Context Packet)(?=[\s\S]*Leases)(?=[\s\S]*Recovery)(?=[\s\S]*textContent)(?=[\s\S]*replaceChildren)/, 'lazy Evidence Runtime Center', failures);
  requirePattern(matrix, /id:\s*'evidence-context-runtime'[\s\S]*verify-evidence-context-runtime\.mjs/, 'required Full Release Matrix gate', failures);

  let audit = null;
  try { audit = JSON.parse(await readFile(path.join(root, 'docs', `feature-audit-${releaseVersion}.json`), 'utf8')); }
  catch { failures.push(`missing or invalid feature audit for ${releaseVersion}`); }
  const auditCounts = counts(audit);
  const expected = { verified_source_test: 734, partial: 0, external_gate: 56, not_implemented: 0 };
  for (const [status, value] of Object.entries(expected)) if (auditCounts[status] !== value) failures.push(`audit count ${status} expected ${value} but found ${auditCounts[status]}`);

  const limitations = await source(root, `docs/LIMITATIONS-${releaseVersion}.md`, failures);
  const boundaries = Object.freeze({
    hiddenReasoningPersisted: !/(?:does not|không).*(?:chain[- ]of[- ]thought|hidden reasoning|suy luận ẩn)/i.test(limitations),
    recoveryAutoExecutes: !/(?:recovery|phục hồi).*(?:recommend|đề xuất).*(?:does not|không).*(?:execute|thực thi)/i.test(limitations),
    remoteDependencyAdded: !/(?:local-only|chỉ chạy local|không thêm dịch vụ từ xa|no new remote)/i.test(limitations),
    vectorOnlyClaimed: !/(?:not vector-only|không chỉ.*vector|five-source|năm nguồn)/i.test(limitations),
    legacySubagentsBroken: !/(?:legacy|cũ).*(?:compatible|tương thích)/i.test(limitations),
  });
  for (const [name, claimed] of Object.entries(boundaries)) if (claimed) failures.push(`unsupported boundary remains: ${name}`);

  const fileDigests = {}; for (const [relative, text] of contents) if (text) fileDigests[relative] = canonicalSha256({ relative, text });
  const base = Object.freeze({ schema: 'forge.studio.evidence-context-runtime-verification.v1', version: releaseVersion, status: failures.length ? 'fail' : 'pass', auditCounts, boundaries, failures: Object.freeze(failures), fileDigests: Object.freeze(fileDigests) });
  const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  if (outputFile) { const target = path.resolve(outputFile); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, `${JSON.stringify(report, null, 2)}\n`); }
  if (failures.length) { const error = new Error(`Evidence context runtime verification failed: ${failures.join('; ')}`); error.code = 'EVIDENCE_CONTEXT_RUNTIME_VERIFICATION_FAILED'; error.report = report; throw error; }
  return report;
}
