import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { expectedFrontierAuditCounts } from './frontier-audit-counts.mjs';
import { INTELLIGENCE_COMPLETION_REQUIREMENT_IDS } from '../../scripts/measure-intelligence-completion.mjs';

const SHA = /^[a-f0-9]{64}$/;
const releaseAtLeastFour = (version) => Number(String(version).split('.')[0]) >= 4;
const REQUIRED_FILES = Object.freeze([
  'src/intelligence-completion/completion-utils.mjs',
  'src/intelligence-completion/context-learning-kernel.mjs',
  'src/intelligence-completion/paged-vector-store.mjs',
  'src/intelligence-completion/repository-intelligence-completion-service.mjs',
  'src/intelligence-completion/program-analysis-kernel.mjs',
  'src/intelligence-completion/variable-lineage-service.mjs',
  'src/intelligence-completion/counterfactual-patch-ablator.mjs',
  'src/repository/repository-intelligence-fabric.mjs',
  'tests/intelligence-completion-utils.test.mjs',
  'tests/context-learning-kernel.test.mjs',
  'tests/paged-vector-store.test.mjs',
  'tests/repository-intelligence-completion-service.test.mjs',
  'tests/program-analysis-kernel.test.mjs',
  'tests/variable-lineage-service.test.mjs',
  'tests/counterfactual-patch-ablator.test.mjs',
  'tests/repository-intelligence-completion-fabric.test.mjs',
  'tests/intelligence-completion-release-gate.test.mjs',
  'scripts/measure-intelligence-completion.mjs',
  'scripts/verify-intelligence-completion-kernel.mjs',
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
function verifyMeasurement(measurement, version, failures) {
  if (!measurement || measurement.schema !== 'forge.studio.intelligence-completion-measurement.v1') failures.push('measurement schema invalid');
  if (measurement?.version !== version) failures.push('measurement version mismatch');
  if (JSON.stringify(measurement?.promotedRequirementIds) !== JSON.stringify(INTELLIGENCE_COMPLETION_REQUIREMENT_IDS)) failures.push('measurement requirement ids mismatch');
  if (!measurement?.context?.expansionKinds?.includes('counter-evidence') || measurement.context.unverifiedOutcomeChangedLearning !== false) failures.push('verified-only context learning was not measured');
  if (JSON.stringify(measurement?.context?.ablationClassifications) !== JSON.stringify(['required','unnecessary','inconclusive']) || measurement.context.verificationContractChanged !== false) failures.push('context ablation boundaries were not measured');
  if (measurement?.vectors?.pages !== 3 || measurement.vectors.pagesRead !== 1 || !(measurement.vectors.peakLoadedBytes < measurement.vectors.totalVectorBytes) || measurement.vectors.fullIndexLoadedIntoMemory !== false || measurement.vectors.checksumsValid !== true) failures.push('paged-vector memory/checksum evidence invalid');
  if (measurement?.repository?.causalityProven !== false || measurement.repository.issueProvesDefectLocation !== false || !(measurement.repository.moduleCount >= 2) || !measurement.repository.zoneTypes?.includes('security-critical')) failures.push('repository enrichment evidence invalid');
  if (!(measurement?.program?.controlFlowEdges > 0) || !(measurement.program.dataFlowEdges > 0) || measurement.program.dynamicTargetsGuessed !== false || !(measurement.program.ambiguousCallEdges > 0)) failures.push('program analysis evidence invalid');
  if (measurement?.variables?.transitionCount !== 7 || measurement.variables.identityInferredWithoutEvidence !== false) failures.push('variable lineage evidence invalid');
  if (JSON.stringify(measurement?.patchAblation?.classifications) !== JSON.stringify(['required','unnecessary']) || measurement.patchAblation.patchAppliedToOriginalWorkspace !== false || measurement.patchAblation.mergeOrPublishAllowed !== false) failures.push('patch ablation boundaries invalid');
  if (measurement?.integration?.beforeCompletionServicesLoaded !== 0 || measurement.integration.fastPathCompletionServicesLoaded !== 0 || measurement.integration.servicesLoadedBySnapshot !== false || measurement.integration.applicationBootstrapModified !== false) failures.push('lazy integration evidence invalid');
  for (const [key, value] of Object.entries(measurement?.boundaries ?? {})) if (value !== false) failures.push(`inflated boundary claim: ${key}`);
  const unsigned = { ...measurement }; delete unsigned.receiptSha256;
  if (!SHA.test(measurement?.receiptSha256 ?? '') || canonicalSha256(unsigned) !== measurement.receiptSha256) failures.push('measurement receipt invalid');
}

export async function verifyIntelligenceCompletionKernel({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory);
  const releaseVersion = String(version ?? '');
  const failures = [];
  for (const relative of REQUIRED_FILES) await present(root, relative, failures);

  const context = await source(root, 'src/intelligence-completion/context-learning-kernel.mjs', failures);
  const vectors = await source(root, 'src/intelligence-completion/paged-vector-store.mjs', failures);
  const repository = await source(root, 'src/intelligence-completion/repository-intelligence-completion-service.mjs', failures);
  const program = await source(root, 'src/intelligence-completion/program-analysis-kernel.mjs', failures);
  const variables = await source(root, 'src/intelligence-completion/variable-lineage-service.mjs', failures);
  const ablator = await source(root, 'src/intelligence-completion/counterfactual-patch-ablator.mjs', failures);
  const fabric = await source(root, 'src/repository/repository-intelligence-fabric.mjs', failures);
  const app = await source(root, 'src/app.mjs', failures);
  requireBehavior(context, /recordVerifiedOutcome[\s\S]*verified === true[\s\S]*verificationStatus === 'passed'[\s\S]*runAblationReplay/, 'verified-only context learning and replay', failures);
  requireBehavior(vectors, /pageSize[\s\S]*pageSha256[\s\S]*peakLoadedBytes[\s\S]*fullIndexLoadedIntoMemory/, 'checksummed paged vectors and memory telemetry', failures);
  requireBehavior(repository, /recordCommitArchitecture[\s\S]*recordIssueCodeReference[\s\S]*buildModuleMap[\s\S]*detectArchitectureZones[\s\S]*buildGitRiskProfile/, 'repository-twin enrichment surface', failures);
  requireBehavior(program, /buildControlFlow[\s\S]*buildDataFlow[\s\S]*dynamicTargetsGuessed/, 'bounded CFG and DFG surface', failures);
  requireBehavior(variables, /registerBinding[\s\S]*transitionBinding[\s\S]*database-mapping[\s\S]*ambiguous/, 'temporal variable lineage surface', failures);
  requireBehavior(ablator, /createIsolatedCandidate[\s\S]*verificationContractSha256[\s\S]*dispose[\s\S]*mergeOrPublishAllowed/, 'isolated counterfactual patch ablation', failures);
  requireBehavior(fabric, /completionFactories[\s\S]*#completionService[\s\S]*completionSnapshot[\s\S]*fast|lexicalOnlySearch/, 'lazy fabric integration', failures);
  if (/intelligence-completion/.test(app)) failures.push('application bootstrap imports intelligence completion directly');

  let measurement = null;
  try { measurement = JSON.parse(await source(root, `docs/intelligence-completion-measurement-${releaseVersion}.json`, failures)); }
  catch { failures.push('measurement JSON invalid'); }
  verifyMeasurement(measurement, releaseVersion, failures);

  const initialCompletionRelease = releaseVersion.startsWith('3.1.');
  const baselineVersion = initialCompletionRelease ? '3.0.0' : '3.1.0';
  let previous = null; let audit = null;
  try { previous = JSON.parse(await source(root, `docs/feature-audit-${baselineVersion}.json`, failures)); }
  catch { failures.push(`${baselineVersion} audit JSON invalid`); }
  try { audit = JSON.parse(await source(root, `docs/feature-audit-${releaseVersion}.json`, failures)); }
  catch { failures.push('current audit JSON invalid'); }
  const expectedCounts = expectedFrontierAuditCounts(releaseVersion);
  if (!audit || audit.totalItems !== 1150 || JSON.stringify(audit.summary) !== JSON.stringify(expectedCounts)) failures.push('current 1,150-item audit counts invalid');
  if (!releaseAtLeastFour(releaseVersion) && previous?.summary?.external_gate !== audit?.summary?.external_gate) failures.push('external gate count changed');
  const before = statusMap(previous); const after = statusMap(audit);
  if (initialCompletionRelease) {
    const changed = [...after].filter(([id, status]) => before.get(id) !== status).map(([id]) => id).sort();
    const expectedChanged = [...INTELLIGENCE_COMPLETION_REQUIREMENT_IDS].sort();
    if (JSON.stringify(changed) !== JSON.stringify(expectedChanged)) failures.push('audit changed requirements outside the 13-item completion set');
    for (const id of INTELLIGENCE_COMPLETION_REQUIREMENT_IDS) if (before.get(id) !== 'not_implemented' || after.get(id) !== 'verified_source_test') failures.push(`audit transition invalid for ${id}`);
  } else {
    for (const id of INTELLIGENCE_COMPLETION_REQUIREMENT_IDS) {
      if (before.get(id) !== 'verified_source_test' || after.get(id) !== 'verified_source_test') failures.push(`intelligence completion guarantee regressed for ${id}`);
    }
  }

  const limitations = await source(root, `docs/LIMITATIONS-${releaseVersion}.md`, failures);
  for (const [pattern, label] of [
    [/external gate|external_gate/i, 'external-gate non-claim'],
    [/does not.*autonomous|không.*tự động.*merge|no autonomous/i, 'autonomous mutation non-claim'],
    [/does not.*outperform|không.*vượt.*Cursor|comparative superiority/i, 'comparative superiority non-claim'],
    [/measurement.*deterministic|deterministic.*measurement|synthetic.*measurement|đo.*tái lập/i, 'deterministic measurement boundary'],
  ]) requireBehavior(limitations, pattern, label, failures);

  const boundaries = Object.freeze({
    externalGateCountChanged: false,
    autonomousMutationClaimed: false,
    autonomousMergeOrPublishClaimed: false,
    cloudSandboxClaimed: false,
    comparativeSuperiorityClaimed: false,
    independentProductionBenchmarkClaimed: false,
  });
  const base = {
    schema: 'forge.studio.intelligence-completion-kernel-verification.v1',
    version: releaseVersion,
    status: failures.length ? 'fail' : 'pass',
    promotedRequirementIds: INTELLIGENCE_COMPLETION_REQUIREMENT_IDS,
    auditCounts: audit?.summary ?? null,
    measurement,
    boundaries,
    failures: Object.freeze(failures),
  };
  const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  if (outputFile) {
    await mkdir(path.dirname(path.resolve(outputFile)), { recursive: true });
    await writeFile(path.resolve(outputFile), `${JSON.stringify(report, null, 2)}\n`);
  }
  if (failures.length) {
    const error = new Error(`Intelligence Completion Kernel verification failed with ${failures.length} issue(s)`);
    error.code = 'INTELLIGENCE_COMPLETION_KERNEL_VERIFICATION_FAILED';
    error.report = report;
    throw error;
  }
  return report;
}
