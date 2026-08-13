import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const VERIFIED_ITEMS = Object.freeze(['5.23', '7.5', '7.9', '7.18', '7.19', '9.8', '9.9', '9.10', '9.11', '9.16', '9.17', '9.19', '15.10', '15.11', '15.19', '15.23']);
const REQUIRED_FILES = Object.freeze([
  'src/orchestration/planning-evidence-governance-service.mjs',
  'src/orchestration/mission-planner.mjs',
  'src/repository/repository-index.mjs',
  'src/app.mjs',
  'tests/planning-evidence-governance-service.test.mjs',
  'tests/mission-planner.test.mjs',
  'tests/planning-evidence-app-wiring.test.mjs',
  'tests/planning-evidence-governance-release-gate.test.mjs',
  'scripts/audit-feature-checklist.mjs',
  'src/release/full-release-matrix.mjs',
]);

function auditItem(audit, id) { return audit?.sections?.flatMap((section) => section.items ?? []).find((item) => item.id === id) ?? null; }
async function source(root, relative, failures) { try { return await readFile(path.join(root, relative), 'utf8'); } catch { failures.push(`missing required source: ${relative}`); return ''; } }
function requirePattern(text, pattern, label, failures) { if (!pattern.test(text)) failures.push(`missing ${label}`); }

export async function verifyPlanningEvidenceGovernance({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory); const releaseVersion = String(version ?? '').trim(); const failures = [];
  if (!/^\d+\.\d+\.\d+$/.test(releaseVersion)) failures.push('stable semantic version is required');
  const contents = new Map(); for (const relative of REQUIRED_FILES) contents.set(relative, await source(root, relative, failures));
  const service = contents.get('src/orchestration/planning-evidence-governance-service.mjs') ?? '';
  const planner = contents.get('src/orchestration/mission-planner.mjs') ?? '';
  const app = contents.get('src/app.mjs') ?? '';
  const auditSource = contents.get('scripts/audit-feature-checklist.mjs') ?? '';
  const matrix = contents.get('src/release/full-release-matrix.mjs') ?? '';

  requirePattern(service, /(?=[\s\S]*preflight)(?=[\s\S]*OBJECTIVE_AMBIGUOUS)(?=[\s\S]*inputRequest)(?=[\s\S]*needs-input)/, 'missing-information detection and bounded user input request', failures);
  requirePattern(service, /(?=[\s\S]*scopeFrom)(?=[\s\S]*estimatedFiles)(?=[\s\S]*confidence)(?=[\s\S]*small)(?=[\s\S]*medium)(?=[\s\S]*large)/, 'scope estimation evidence', failures);
  requirePattern(service, /(?=[\s\S]*TEST_PATH)(?=[\s\S]*CONFIG_PATH)(?=[\s\S]*DOC_PATH)(?=[\s\S]*tests)(?=[\s\S]*configs)(?=[\s\S]*docs)(?=[\s\S]*sources)/, 'related test config documentation and source retrieval', failures);
  requirePattern(service, /(?=[\s\S]*riskFor)(?=[\s\S]*expectedFiles)(?=[\s\S]*requiredTools)(?=[\s\S]*subagent)(?=[\s\S]*evidence)/, 'per-step risk file tool subagent and evidence enrichment', failures);
  requirePattern(service, /(?=[\s\S]*maxSteps)(?=[\s\S]*ambiguous or vague)(?=[\s\S]*Plan detail must contain)/, 'bounded non-vague plan validation', failures);
  requirePattern(service, /(?=[\s\S]*recordRevision)(?=[\s\S]*plan revision reason)(?=[\s\S]*planning\.plan\.revised)(?=[\s\S]*receiptSha256)/, 'replanning reason and durable receipt', failures);
  requirePattern(planner, /(?=[\s\S]*evidenceGovernance\.preflight)(?=[\s\S]*PLANNING_INPUT_REQUIRED)(?=[\s\S]*router\.select)(?=[\s\S]*evidenceGovernance\.enrichPlan)/, 'MissionPlanner preflight and enrichment integration', failures);
  const preflightIndex = planner.indexOf('evidenceGovernance.preflight');
  const providerSelectionIndex = planner.indexOf('this.router.select');
  if (preflightIndex < 0 || providerSelectionIndex < 0 || preflightIndex > providerSelectionIndex) failures.push('planning preflight must run before provider selection');
  requirePattern(app, /new PlanningEvidenceGovernanceService\(\{ store, repositoryIndex \}\)[\s\S]*new MissionPlanner\(\{ router, evidenceGovernance: planningEvidenceGovernance \}\)/, 'application wiring', failures);
  requirePattern(auditSource, /planningEvidenceGovernance[\s\S]*Phát hiện thông tin thiếu[\s\S]*Tóm tắt kết quả/, 'item-level planning evidence audit rules', failures);
  requirePattern(matrix, /id:\s*'planning-evidence-governance'[\s\S]*scripts\/verify-planning-evidence-governance\.mjs/, 'full release matrix planning evidence gate', failures);
  if (/https?:\/\/|fetch\(|axios|undici/i.test(service)) failures.push('planning evidence governance must remain local-only');

  let audit = null;
  try { audit = JSON.parse(await readFile(path.join(root, 'docs', `feature-audit-${releaseVersion}.json`), 'utf8')); }
  catch { failures.push(`missing or invalid feature audit for ${releaseVersion}`); }
  for (const id of VERIFIED_ITEMS) if (auditItem(audit, id)?.status !== 'verified_source_test') failures.push(`feature audit item ${id} is not verified_source_test`);

  const limitationsText = await source(root, `docs/LIMITATIONS-${releaseVersion}.md`, failures);
  const scopeBoundary = /scope estimate.*heuristic|ước lượng phạm vi.*heuristic|không.*đảm bảo.*phạm vi.*hoàn hảo/i.test(limitationsText);
  const subagentBoundary = /does not spawn subagents|không.*tự.*khởi chạy.*agent con|subagent recommendation.*not execution/i.test(limitationsText);
  const externalSearchBoundary = /local repository evidence only|chỉ.*bằng chứng.*repository local|không gọi.*dịch vụ.*bên ngoài/i.test(limitationsText);
  const limitations = Object.freeze({
    perfectScopeEstimationClaimed: !scopeBoundary,
    automaticSubagentExecutionClaimed: !subagentBoundary,
    externalSearchClaimed: !externalSearchBoundary,
  });
  for (const [name, claimed] of Object.entries(limitations)) if (claimed) failures.push(`unsafe or unsupported claim remains: ${name}`);

  const fileDigests = {}; for (const [relative, text] of contents) if (text) fileDigests[relative] = canonicalSha256({ relative, text });
  const base = Object.freeze({ schema: 'forge.studio.planning-evidence-governance-verification.v1', version: releaseVersion, status: failures.length ? 'fail' : 'pass', verifiedItems: VERIFIED_ITEMS, limitations, failures: Object.freeze(failures), fileDigests: Object.freeze(fileDigests) });
  const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  if (outputFile) { const target = path.resolve(outputFile); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, `${JSON.stringify(report, null, 2)}\n`); }
  if (failures.length) { const error = new Error(`Planning evidence governance verification failed: ${failures.join('; ')}`); error.code = 'PLANNING_EVIDENCE_GOVERNANCE_VERIFICATION_FAILED'; error.report = report; throw error; }
  return report;
}
