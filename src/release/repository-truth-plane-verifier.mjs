import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { REPOSITORY_TRUTH_PLANE_REQUIREMENT_IDS } from '../../scripts/measure-repository-truth-plane.mjs';
import { expectedFrontierAuditCounts } from './frontier-audit-counts.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const releaseAtLeastFour = (version) => Number(String(version).split('.')[0]) >= 4;
const REQUIRED_FILES = Object.freeze([
  'src/repository/repository-fact-ledger.mjs',
  'src/repository/repository-truth-map-builder.mjs',
  'src/repository/repository-evidence-query-planner.mjs',
  'src/repository/repository-truth-viewer.mjs',
  'src/repository/repository-workspace-state-adapter.mjs',
  'src/repository/repository-digital-twin-service.mjs',
  'src/repository/repository-intelligence-fabric.mjs',
  'tests/repository-fact-ledger.test.mjs',
  'tests/repository-truth-map-builder.test.mjs',
  'tests/repository-evidence-query-planner.test.mjs',
  'tests/repository-truth-viewer.test.mjs',
  'tests/repository-truth-plane-integration.test.mjs',
  'tests/repository-truth-plane-release-gate.test.mjs',
  'scripts/measure-repository-truth-plane.mjs',
  'scripts/verify-repository-truth-plane.mjs',
]);

async function source(root, relative, failures) {
  try { return await readFile(path.join(root, relative), 'utf8'); }
  catch { failures.push(`missing ${relative}`); return ''; }
}
async function present(root, relative, failures) {
  try { await access(path.join(root, relative)); }
  catch { failures.push(`missing ${relative}`); }
}
function requireBehavior(text, pattern, label, failures) {
  if (!pattern.test(text)) failures.push(`missing behavior: ${label}`);
}
function statusMap(audit) {
  return new Map((audit?.sections ?? []).flatMap((section) => section.items ?? []).map((item) => [String(item.id), String(item.status)]));
}
function exactArray(left, right) { return JSON.stringify(left) === JSON.stringify(right); }

function verifyMeasurement(measurement, version, failures) {
  if (!measurement || measurement.schema !== 'forge.studio.repository-truth-plane-measurement.v1') failures.push('measurement schema invalid');
  if (measurement?.version !== version) failures.push('measurement version mismatch');
  if (!exactArray(measurement?.promotedRequirementIds, REPOSITORY_TRUTH_PLANE_REQUIREMENT_IDS)) failures.push('measurement requirement ids mismatch');
  if (!exactArray(measurement?.workspace, {
    realGitRepository: true,
    branchDetected: true,
    worktreeDetected: true,
    dirtyStateDetected: true,
    editorOverlayIsolated: true,
  })) failures.push('real repository workspace evidence invalid');
  for (const kind of ['public-api','internal-api','database-schema','configuration','build-target','external-dependency','service','layer','domain']) {
    if (!measurement?.architecture?.nodeKinds?.includes(kind)) failures.push(`architecture kind not measured: ${kind}`);
  }
  for (const kind of ['defines','references','calls','implements','verifies']) {
    if (!measurement?.symbols?.edgeKinds?.includes(kind)) failures.push(`symbol relation not measured: ${kind}`);
  }
  for (const kind of ['request','event','process','state','data-flow','reads','writes','controls']) {
    if (!measurement?.runtime?.edgeKinds?.includes(kind)) failures.push(`runtime relation not measured: ${kind}`);
  }
  if (measurement?.provenance?.allReturnedFactsCited !== true) failures.push('query returned an uncited fact');
  if (measurement?.provenance?.crossBranchFactRejected !== true) failures.push('cross-branch fact reuse was not rejected');
  if (measurement?.provenance?.sourceHashDriftInvalidated !== true) failures.push('source hash drift was not invalidated');
  if (!exactArray(measurement?.query?.stageOrder, ['exact','lexical','ast-lsp','graph','git','test','semantic','runtime'])) failures.push('query stage order invalid');
  if (measurement?.query?.unavailableStagesExplicit !== true) failures.push('unavailable evidence stages were not explicit');
  if (measurement?.viewer?.pageLoadedLessThanGraph !== true) failures.push('paged viewer loaded the full graph');
  if (measurement?.viewer?.corruptCursorRejected !== true) failures.push('corrupt viewer cursor was not rejected');
  for (const [key, value] of Object.entries(measurement?.boundaries ?? {})) {
    if (value !== false) failures.push(`inflated boundary claim: ${key}`);
  }
  const unsigned = { ...measurement };
  delete unsigned.receiptSha256;
  if (!SHA256.test(String(measurement?.receiptSha256 ?? '')) || canonicalSha256(unsigned) !== measurement.receiptSha256) failures.push('measurement receipt invalid');
}

export async function verifyRepositoryTruthPlane({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory);
  const releaseVersion = String(version ?? '');
  const failures = [];
  for (const relative of REQUIRED_FILES) await present(root, relative, failures);

  const ledger = await source(root, 'src/repository/repository-fact-ledger.mjs', failures);
  const maps = await source(root, 'src/repository/repository-truth-map-builder.mjs', failures);
  const planner = await source(root, 'src/repository/repository-evidence-query-planner.mjs', failures);
  const viewer = await source(root, 'src/repository/repository-truth-viewer.mjs', failures);
  const adapter = await source(root, 'src/repository/repository-workspace-state-adapter.mjs', failures);
  const twin = await source(root, 'src/repository/repository-digital-twin-service.mjs', failures);
  const fabric = await source(root, 'src/repository/repository-intelligence-fabric.mjs', failures);
  const app = await source(root, 'src/app.mjs', failures);
  const matrix = await source(root, 'src/release/full-release-matrix.mjs', failures);

  requireBehavior(ledger, /(?=[\s\S]*branch-context-mismatch)(?=[\s\S]*source-hash-mismatch)(?=[\s\S]*editorOverlayHash)(?=[\s\S]*invalidationKey)/, 'branch-scoped cited fact invalidation', failures);
  requireBehavior(maps, /(?=[\s\S]*public-api)(?=[\s\S]*internal-api)(?=[\s\S]*database-schema)(?=[\s\S]*build-target)(?=[\s\S]*external-dependency)/, 'architecture truth map', failures);
  requireBehavior(maps, /(?=[\s\S]*defines)(?=[\s\S]*references)(?=[\s\S]*implements)(?=[\s\S]*verifies)(?=[\s\S]*relationshipEdges)(?=[\s\S]*symbolByAlias)/, 'symbol truth map', failures);
  requireBehavior(maps, /(?=[\s\S]*runtimeEdges)(?=[\s\S]*addProviderEdge)(?=[\s\S]*\['reads', 'writes', 'controls'\])(?=[\s\S]*missing-citation)(?=[\s\S]*runtime-observation-unavailable)/, 'cited runtime truth map and uncited-edge rejection', failures);
  requireBehavior(planner, /\['exact','lexical','ast-lsp','graph','git','test','semantic','runtime'\]/, 'fixed evidence query order', failures);
  requireBehavior(planner, /status:\s*'unavailable'[\s\S]*missing-citation/, 'explicit unavailable and uncited result handling', failures);
  requireBehavior(viewer, /(?=[\s\S]*source-span)(?=[\s\S]*nextCursor)(?=[\s\S]*graphTotalNodeCount)(?=[\s\S]*does not match this query)/, 'paged source-span viewer with bound cursor', failures);
  requireBehavior(adapter, /(?=[\s\S]*branch[^\n]*--show-current)(?=[\s\S]*rev-parse)(?=[\s\S]*status)(?=[\s\S]*editorOverlays)/, 'real Git/worktree/editor-state adapter', failures);
  requireBehavior(twin, /(?=[\s\S]*forge\.repository-digital-twin\.v2)(?=[\s\S]*async query)(?=[\s\S]*zoom\()(?=[\s\S]*validateFacts)/, 'Repository Digital Twin v2 query, zoom, and validation', failures);
  requireBehavior(fabric, /(?=[\s\S]*repositoryTruth)(?=[\s\S]*queryRepositoryTruth)(?=[\s\S]*zoomRepositoryTruth)(?=[\s\S]*repositoryTruthStatus)/, 'lazy Repository Intelligence Fabric integration', failures);
  if (/RepositoryTruthMapBuilder|RepositoryDigitalTwinService|repository-truth-plane/.test(app)) failures.push('application bootstrap imports Repository Truth Plane directly');
  requireBehavior(matrix, /id:\s*'repository-truth-plane'[\s\S]*scripts\/verify-repository-truth-plane\.mjs/, 'required Repository Truth Plane matrix gate', failures);

  let measurement = null;
  try { measurement = JSON.parse(await source(root, `docs/repository-truth-plane-measurement-${releaseVersion}.json`, failures)); }
  catch { failures.push('measurement JSON invalid'); }
  verifyMeasurement(measurement, releaseVersion, failures);

  const initialRepositoryTruthRelease = releaseVersion.startsWith('3.3.');
  const baselineVersion = initialRepositoryTruthRelease ? '3.2.0' : '3.3.0';
  let previous = null;
  let audit = null;
  try { previous = JSON.parse(await source(root, `docs/feature-audit-${baselineVersion}.json`, failures)); }
  catch { failures.push(`${baselineVersion} audit JSON invalid`); }
  try { audit = JSON.parse(await source(root, `docs/feature-audit-${releaseVersion}.json`, failures)); }
  catch { failures.push('current audit JSON invalid'); }
  const expectedCounts = expectedFrontierAuditCounts(releaseVersion);
  if (!audit || audit.totalItems !== 1150 || !exactArray(audit.summary, expectedCounts)) failures.push('current 1,150-item audit counts invalid');
  if (!releaseAtLeastFour(releaseVersion) && previous?.summary?.external_gate !== audit?.summary?.external_gate) failures.push('external gate count changed');
  const before = statusMap(previous);
  const after = statusMap(audit);
  if (initialRepositoryTruthRelease) {
    const changed = [...after].filter(([id, status]) => before.get(id) !== status).map(([id]) => id).sort();
    const expectedChanged = [...REPOSITORY_TRUTH_PLANE_REQUIREMENT_IDS].sort();
    if (!exactArray(changed, expectedChanged)) failures.push('audit changed requirements outside the 11-item Repository Truth Plane set');
    for (const id of REPOSITORY_TRUTH_PLANE_REQUIREMENT_IDS) {
      if (before.get(id) !== 'partial' || after.get(id) !== 'verified_source_test') failures.push(`audit transition invalid for ${id}`);
    }
  } else {
    for (const id of REPOSITORY_TRUTH_PLANE_REQUIREMENT_IDS) {
      if (before.get(id) !== 'verified_source_test' || after.get(id) !== 'verified_source_test') failures.push(`Repository Truth Plane guarantee regressed for ${id}`);
    }
  }

  const limitations = await source(root, `docs/LIMITATIONS-${releaseVersion}.md`, failures);
  for (const [pattern, label] of [
    [/external gate|external_gate/i, 'external-gate non-claim'],
    [/không.*hiểu hoàn hảo mọi ngôn ngữ|does not.*perfectly understand every language/i, 'language-completeness non-claim'],
    [/không.*nhân quả.*observation citation|does not.*causal.*observation citation/i, 'runtime causality non-claim'],
    [/không.*vượt.*Cursor.*Codex.*Claude|does not.*outperform.*Cursor.*Codex.*Claude/i, 'comparative superiority non-claim'],
    [/không tải toàn bộ graph|does not load the entire graph/i, 'paged viewer boundary'],
  ]) requireBehavior(limitations, pattern, label, failures);

  const boundaries = Object.freeze({
    externalGateCountChanged: false,
    comparativeSuperiorityClaimed: false,
    uncitedInferencePromoted: false,
    fullGraphLoadedForPage: false,
  });
  const base = {
    schema: 'forge.studio.repository-truth-plane-verification.v1',
    version: releaseVersion,
    status: failures.length ? 'fail' : 'pass',
    promotedRequirementIds: REPOSITORY_TRUTH_PLANE_REQUIREMENT_IDS,
    auditCounts: audit?.summary ?? null,
    measurementReceiptSha256: measurement?.receiptSha256 ?? null,
    boundaries,
    failures: Object.freeze(failures),
  };
  const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  if (outputFile) {
    await mkdir(path.dirname(path.resolve(outputFile)), { recursive: true });
    await writeFile(path.resolve(outputFile), `${JSON.stringify(report, null, 2)}\n`);
  }
  if (failures.length) {
    const error = new Error(`Repository Truth Plane verification failed with ${failures.length} issue(s)`);
    error.code = 'REPOSITORY_TRUTH_PLANE_VERIFICATION_FAILED';
    error.report = report;
    throw error;
  }
  return report;
}
