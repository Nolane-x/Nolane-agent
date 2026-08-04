import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { expectedFrontierAuditCounts } from './frontier-audit-counts.mjs';
import { VERIFIED_MISSION_RUNTIME_REQUIREMENT_IDS } from '../../scripts/measure-verified-mission-runtime.mjs';

const SHA = /^[a-f0-9]{64}$/;
const releaseAtLeastFour = (version) => Number(String(version).split('.')[0]) >= 4;
const REQUIRED_FILES = Object.freeze([
  'src/decision/verified-outcome-ledger.mjs',
  'src/decision/correctness-first-objective.mjs',
  'src/cognition/tool-effect-verifier.mjs',
  'src/cognition/confidence-calibration-service.mjs',
  'src/cognition/decision-state-machine.mjs',
  'src/cognition/semantic-progress-detector.mjs',
  'src/runtime/resource-attribution-ledger.mjs',
  'src/runtime/disk-backed-raw-log.mjs',
  'src/runtime/process-leak-reaper.mjs',
  'src/runtime/verified-mission-runtime.mjs',
  'src/decision/decision-plane.mjs',
  'src/runtime/mission-resource-fabric.mjs',
  'tests/verified-outcome-ledger.test.mjs',
  'tests/correctness-first-objective.test.mjs',
  'tests/tool-effect-verifier.test.mjs',
  'tests/confidence-calibration-service.test.mjs',
  'tests/decision-state-machine.test.mjs',
  'tests/semantic-progress-detector.test.mjs',
  'tests/resource-attribution-ledger.test.mjs',
  'tests/disk-backed-raw-log.test.mjs',
  'tests/process-leak-reaper.test.mjs',
  'tests/verified-mission-runtime.test.mjs',
  'tests/verified-mission-runtime-integration.test.mjs',
  'tests/verified-mission-runtime-release-gate.test.mjs',
  'scripts/measure-verified-mission-runtime.mjs',
  'scripts/verify-verified-mission-runtime.mjs',
]);

async function source(root, relative, failures) {
  try { return await readFile(path.join(root, relative), 'utf8'); }
  catch { failures.push(`missing ${relative}`); return ''; }
}
async function present(root, relative, failures) {
  try { await access(path.join(root, relative)); }
  catch { failures.push(`missing ${relative}`); }
}
function requireBehavior(text, pattern, label, failures) { if (!pattern.test(text)) failures.push(`missing behavior: ${label}`); }
function statusMap(audit) { return new Map((audit?.sections ?? []).flatMap((section) => section.items ?? []).map((item) => [String(item.id), String(item.status)])); }

function verifyMeasurement(measurement, version, failures) {
  if (!measurement || measurement.schema !== 'forge.studio.verified-mission-runtime-measurement.v1') failures.push('measurement schema invalid');
  if (measurement?.version !== version) failures.push('measurement version mismatch');
  if (JSON.stringify(measurement?.promotedRequirementIds) !== JSON.stringify(VERIFIED_MISSION_RUNTIME_REQUIREMENT_IDS)) failures.push('measurement requirement ids mismatch');
  if (JSON.stringify(measurement?.outcomes?.scopeScores) !== JSON.stringify({ task: 3, milestone: 3, mission: 3 })) failures.push('hierarchical verified criteria scores not measured');
  if (measurement?.outcomes?.contextTokensActuallyUseful !== 120 || measurement.outcomes.costBoundToDecision !== true) failures.push('context utility or decision cost attribution not measured');
  if (measurement?.objective?.correctnessFirst !== true || measurement.objective.rewardHackingBlocked !== true) failures.push('correctness-first objective boundary not measured');
  if (measurement?.effects?.falseSuccessDetected !== true || measurement.effects.commitAllowed !== false) failures.push('tool effect false-success boundary not measured');
  if (JSON.stringify(measurement?.confidence?.lanes) !== JSON.stringify(['execution','hypothesis','patch','plan','requirement','retrieval','verification'])) failures.push('confidence lanes not measured');
  if (measurement?.confidence?.weakestLaneControlsBase !== true || measurement.confidence.correlatedEvidenceDeduplicated !== true) failures.push('confidence aggregation boundaries not measured');
  if (measurement?.stateMachine?.observationRequiredBeforeCommit !== true || measurement.stateMachine.finalState !== 'committed') failures.push('verified state-machine sequence not measured');
  if (measurement?.progress?.churnOnlyDetected !== true || measurement.progress.status !== 'stalled') failures.push('semantic no-progress evidence invalid');
  if (measurement?.resources?.taskRssMbSeconds !== 150 || measurement.resources.missionRssMbSeconds !== 150) failures.push('hierarchical rssMbSeconds evidence invalid');
  if (measurement?.logs?.rawRecordsStoredInMemory !== false || measurement.logs.redactionVerified !== true || measurement.logs.restartRecoveryVerified !== true) failures.push('disk-backed raw-log evidence invalid');
  if (process.platform === 'linux' && measurement?.processes?.realTreeCleanupVerified !== true) failures.push('real Linux process-tree cleanup not measured');
  if (measurement?.processes?.unregisteredProcessKillAllowed !== false) failures.push('unregistered process kill boundary violated');
  for (const [key, value] of Object.entries(measurement?.boundaries ?? {})) if (value !== false) failures.push(`inflated boundary claim: ${key}`);
  const unsigned = { ...measurement }; delete unsigned.receiptSha256;
  if (!SHA.test(measurement?.receiptSha256 ?? '') || canonicalSha256(unsigned) !== measurement.receiptSha256) failures.push('measurement receipt invalid');
}

export async function verifyVerifiedMissionRuntime({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory);
  const releaseVersion = String(version ?? '');
  const failures = [];
  for (const relative of REQUIRED_FILES) await present(root, relative, failures);

  const outcomes = await source(root, 'src/decision/verified-outcome-ledger.mjs', failures);
  const objective = await source(root, 'src/decision/correctness-first-objective.mjs', failures);
  const effects = await source(root, 'src/cognition/tool-effect-verifier.mjs', failures);
  const confidence = await source(root, 'src/cognition/confidence-calibration-service.mjs', failures);
  const states = await source(root, 'src/cognition/decision-state-machine.mjs', failures);
  const progress = await source(root, 'src/cognition/semantic-progress-detector.mjs', failures);
  const resources = await source(root, 'src/runtime/resource-attribution-ledger.mjs', failures);
  const logs = await source(root, 'src/runtime/disk-backed-raw-log.mjs', failures);
  const reaper = await source(root, 'src/runtime/process-leak-reaper.mjs', failures);
  const runtime = await source(root, 'src/runtime/verified-mission-runtime.mjs', failures);
  const plane = await source(root, 'src/decision/decision-plane.mjs', failures);
  const app = await source(root, 'src/app.mjs', failures);

  requireBehavior(outcomes, /(?=[\s\S]*recordVerification)(?=[\s\S]*verifiedCriteriaScore)(?=[\s\S]*contextTokensActuallyUseful)(?=[\s\S]*recordCost)/, 'verified outcome hierarchy, context utility, and decision cost', failures);
  requireBehavior(objective, /(?=[\s\S]*detectRewardHacking)(?=[\s\S]*rankCandidates)(?=[\s\S]*regression)(?=[\s\S]*verification)/, 'correctness-first objective and reward-hacking guard', failures);
  requireBehavior(effects, /false_success[\s\S]*independentEvidenceRequired/, 'independent actual-effect verification', failures);
  requireBehavior(confidence, /requirement[\s\S]*retrieval[\s\S]*hypothesis[\s\S]*plan[\s\S]*execution[\s\S]*patch[\s\S]*verification[\s\S]*weakestLane/, 'seven-lane confidence calibration', failures);
  requireBehavior(states, /specified[\s\S]*proposed[\s\S]*verified[\s\S]*authorized[\s\S]*executed[\s\S]*observed[\s\S]*committed/, 'verified decision state machine', failures);
  requireBehavior(progress, /verifiedCriteriaScore[\s\S]*testsPassed[\s\S]*semanticDiff[\s\S]*informationGain[\s\S]*churnOnly/, 'semantic no-progress detector', failures);
  requireBehavior(resources, /rssMbSeconds[\s\S]*decisionId[\s\S]*taskId[\s\S]*milestoneId[\s\S]*missionId/, 'hierarchical RSS-time attribution', failures);
  requireBehavior(logs, /(?=[\s\S]*appendFileSync)(?=[\s\S]*offset)(?=[\s\S]*rawRecordsStoredInMemory:\s*false)(?=[\s\S]*receiptSha256)/, 'disk-backed bounded raw logs', failures);
  requireBehavior(reaper, /(?=[\s\S]*registeredPids)(?=[\s\S]*rootIdentity)(?=[\s\S]*SIGTERM)(?=[\s\S]*SIGKILL)(?=[\s\S]*safety_blocked)/, 'identity-safe process-tree cleanup', failures);
  requireBehavior(runtime, /VerifiedOutcomeLedger[\s\S]*ToolEffectVerifier|recordVerification[\s\S]*calibrateConfidence[\s\S]*observeProgress[\s\S]*reapMission/, 'verified mission runtime composition', failures);
  requireBehavior(plane, /_verifiedMission[\s\S]*get verifiedMission[\s\S]*verifiedMissionSnapshot/, 'lazy Decision Plane integration', failures);
  if (/VerifiedMissionRuntime|verified-mission-runtime/.test(app)) failures.push('application bootstrap imports Verified Mission Runtime directly');

  let measurement = null;
  try { measurement = JSON.parse(await source(root, `docs/verified-mission-runtime-measurement-${releaseVersion}.json`, failures)); }
  catch { failures.push('measurement JSON invalid'); }
  verifyMeasurement(measurement, releaseVersion, failures);

  const initialVerifiedMissionRelease = releaseVersion.startsWith('3.2.');
  const baselineVersion = initialVerifiedMissionRelease ? '3.1.0' : '3.2.0';
  let previous = null; let audit = null;
  try { previous = JSON.parse(await source(root, `docs/feature-audit-${baselineVersion}.json`, failures)); }
  catch { failures.push(`${baselineVersion} audit JSON invalid`); }
  try { audit = JSON.parse(await source(root, `docs/feature-audit-${releaseVersion}.json`, failures)); }
  catch { failures.push('current audit JSON invalid'); }
  const expectedCounts = expectedFrontierAuditCounts(releaseVersion);
  if (!audit || audit.totalItems !== 1150 || JSON.stringify(audit.summary) !== JSON.stringify(expectedCounts)) failures.push('current 1,150-item audit counts invalid');
  if (!releaseAtLeastFour(releaseVersion) && previous?.summary?.external_gate !== audit?.summary?.external_gate) failures.push('external gate count changed');
  const before = statusMap(previous); const after = statusMap(audit);
  if (initialVerifiedMissionRelease) {
    const changed = [...after].filter(([id, status]) => before.get(id) !== status).map(([id]) => id).sort();
    const expectedChanged = [...VERIFIED_MISSION_RUNTIME_REQUIREMENT_IDS].sort();
    if (JSON.stringify(changed) !== JSON.stringify(expectedChanged)) failures.push('audit changed requirements outside the 13-item verified mission set');
    for (const id of VERIFIED_MISSION_RUNTIME_REQUIREMENT_IDS) if (before.get(id) !== 'partial' || after.get(id) !== 'verified_source_test') failures.push(`audit transition invalid for ${id}`);
  } else {
    for (const id of VERIFIED_MISSION_RUNTIME_REQUIREMENT_IDS) {
      if (before.get(id) !== 'verified_source_test' || after.get(id) !== 'verified_source_test') failures.push(`verified mission runtime guarantee regressed for ${id}`);
    }
  }

  const limitations = await source(root, `docs/LIMITATIONS-${releaseVersion}.md`, failures);
  for (const [pattern, label] of [
    [/external gate|external_gate/i, 'external-gate non-claim'],
    [/does not.*autonomous|no autonomous|không.*tự động/i, 'autonomous mutation non-claim'],
    [/does not.*outperform|comparative superiority|không.*vượt/i, 'comparative superiority non-claim'],
    [/unverified outcome.*does not|unverified.*không.*value|verified outcomes only/i, 'unverified-outcome non-claim'],
    [/unregistered process.*not killed|does not kill unregistered|không.*process.*chưa đăng ký/i, 'unregistered-process safety boundary'],
    [/deterministic.*measurement|measurement.*deterministic|đo.*tái lập/i, 'deterministic measurement boundary'],
  ]) requireBehavior(limitations, pattern, label, failures);

  const boundaries = Object.freeze({
    externalGateCountChanged: false,
    unverifiedOutcomeCreatesValue: false,
    unregisteredProcessKillAllowed: false,
    autonomousMergeOrPublishClaimed: false,
    comparativeSuperiorityClaimed: false,
    independentProductionBenchmarkClaimed: false,
  });
  const base = {
    schema: 'forge.studio.verified-mission-runtime-verification.v1', version: releaseVersion,
    status: failures.length ? 'fail' : 'pass', promotedRequirementIds: VERIFIED_MISSION_RUNTIME_REQUIREMENT_IDS,
    auditCounts: audit?.summary ?? null, measurement, boundaries, failures: Object.freeze(failures),
  };
  const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  if (outputFile) {
    await mkdir(path.dirname(path.resolve(outputFile)), { recursive: true });
    await writeFile(path.resolve(outputFile), `${JSON.stringify(report, null, 2)}\n`);
  }
  if (failures.length) {
    const error = new Error(`Verified Mission Runtime verification failed with ${failures.length} issue(s)`);
    error.code = 'VERIFIED_MISSION_RUNTIME_VERIFICATION_FAILED';
    error.report = report;
    throw error;
  }
  return report;
}
