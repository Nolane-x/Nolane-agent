import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { expectedFrontierAuditCounts } from './frontier-audit-counts.mjs';

const SHA = /^[a-f0-9]{64}$/i;

async function present(root, file, failures) {
  try { await access(path.join(root, file)); } catch { failures.push(`missing ${file}`); }
}
async function source(root, file, failures) {
  try { return await readFile(path.join(root, file), 'utf8'); } catch { failures.push(`missing ${file}`); return ''; }
}
function required(text, pattern, label, failures) {
  if (!pattern.test(text)) failures.push(`missing behavior: ${label}`);
}

export async function verifyFrontierSafetySelfHealing({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory);
  const releaseVersion = String(version ?? '');
  const failures = [];
  const requiredFiles = [
    'src/frontier/cross-repository-workspace-map.mjs',
    'src/frontier/transactional-change-planner.mjs',
    'src/frontier/synchronized-commit-chain.mjs',
    'src/frontier/post-merge-sentinel.mjs',
    'src/frontier/change-survival-ledger.mjs',
    'src/frontier/self-healing-coordinator.mjs',
    'src/frontier/cultural-lineage-ledger.mjs',
    'src/frontier/self-improvement-constitution.mjs',
    'src/runtime/frontier-governance-plane.mjs',
    'tests/cross-repository-workspace-map.test.mjs',
    'tests/transactional-change-planner.test.mjs',
    'tests/synchronized-commit-chain.test.mjs',
    'tests/post-merge-sentinel.test.mjs',
    'tests/change-survival-ledger.test.mjs',
    'tests/self-healing-coordinator.test.mjs',
    'tests/cultural-lineage-ledger.test.mjs',
    'tests/self-improvement-constitution.test.mjs',
    'tests/frontier-governance-plane.test.mjs',
  ];
  for (const file of requiredFiles) await present(root, file, failures);

  const [workspace, planner, chain, sentinel, survival, selfHealing, lineage, constitution, plane] = await Promise.all([
    'src/frontier/cross-repository-workspace-map.mjs',
    'src/frontier/transactional-change-planner.mjs',
    'src/frontier/synchronized-commit-chain.mjs',
    'src/frontier/post-merge-sentinel.mjs',
    'src/frontier/change-survival-ledger.mjs',
    'src/frontier/self-healing-coordinator.mjs',
    'src/frontier/cultural-lineage-ledger.mjs',
    'src/frontier/self-improvement-constitution.mjs',
    'src/runtime/frontier-governance-plane.mjs',
  ].map((file) => source(root, file, failures)));
  required(workspace, /(?=[\s\S]*registerRepository)(?=[\s\S]*registerContract)(?=[\s\S]*linkDependency)(?=[\s\S]*cycle)(?=[\s\S]*provenanceReceiptSha256)/, 'cross-repository graph with provenance and cycle guard', failures);
  required(planner, /(?=[\s\S]*topological)(?=[\s\S]*compatibility)(?=[\s\S]*allOrRollback)(?=[\s\S]*rollbackSequence)(?=[\s\S]*verificationCheckpoints)/, 'transactional ordering, compatibility, verification, and rollback', failures);
  required(chain, /(?=[\s\S]*recordPreparedCommit)(?=[\s\S]*recordVerification)(?=[\s\S]*recordRollback)(?=[\s\S]*human approval)(?=[\s\S]*autonomousMergeAllowed:\s*false)/, 'synchronized commit chain with human merge gate', failures);
  required(sentinel, /(?=[\s\S]*ci)(?=[\s\S]*crash)(?=[\s\S]*performance)(?=[\s\S]*security)(?=[\s\S]*selfHealingEligible)/, 'post-merge signal attribution', failures);
  required(survival, /(?=[\s\S]*observationWindowDays)(?=[\s\S]*shadowCredit)(?=[\s\S]*productionRoutingChanged:\s*false)(?=[\s\S]*productionDurabilityProven:\s*false)/, 'matured survival shadow feedback', failures);
  required(selfHealing, /(?=[\s\S]*resetToBaseline)(?=[\s\S]*createWorktree)(?=[\s\S]*regressionTestId)(?=[\s\S]*rollbackRef)(?=[\s\S]*mergeAllowed:\s*false)(?=[\s\S]*publishAllowed:\s*false)/, 'bounded clean-baseline self-healing', failures);
  required(lineage, /(?=[\s\S]*parents)(?=[\s\S]*provenanceReceiptSha256)(?=[\s\S]*rollback)(?=[\s\S]*supersede)(?=[\s\S]*productionPolicyChanged:\s*false)/, 'versioned cultural lineage', failures);
  required(constitution, /(?=[\s\S]*disable-verifier)(?=[\s\S]*delete-audit)(?=[\s\S]*expand-autonomy)(?=[\s\S]*held-out)(?=[\s\S]*red-team)(?=[\s\S]*canary)(?=[\s\S]*productionPromotionExecuted:\s*false)/, 'self-improvement constitution', failures);
  required(plane, /(?=[\s\S]*registerRepository)(?=[\s\S]*proposeSelfHealing)(?=[\s\S]*evaluateSelfImprovementCandidate)(?=[\s\S]*frontierSuperiorityClaimAllowed:\s*false)/, 'lazy frontier governance integration', failures);

  let measurement = null;
  try { measurement = JSON.parse(await source(root, `docs/frontier-governance-measurement-${releaseVersion}.json`, failures)); } catch { failures.push('measurement JSON invalid'); }
  if (measurement) {
    const checks = {
      crossRepositoryGraphBuilt: measurement.workspace?.crossRepositoryGraphBuilt,
      provenanceBound: measurement.workspace?.provenanceBound,
      transactional: measurement.transaction?.transactional,
      allOrRollback: measurement.transaction?.allOrRollback,
      humanMergeGateRequired: measurement.commitChain?.humanMergeGateRequired,
      everyRepositoryPreparedAndVerified: measurement.commitChain?.everyRepositoryPreparedAndVerified,
      allFiveSignalKindsObserved: measurement.postMerge?.allFiveSignalKindsObserved,
      directAttributionRequired: measurement.postMerge?.directAttributionRequired,
      cleanBaselineBeforeWorktree: measurement.selfHealing?.cleanBaselineBeforeWorktree,
      regressionTestRequired: measurement.selfHealing?.regressionTestRequired,
      maturedAfterWindow: measurement.survival?.maturedAfterWindow,
      shadowOnly: measurement.survival?.shadowOnly,
      exactVersionLineage: measurement.lineage?.exactVersionLineage,
      forbiddenMutationBlocked: measurement.constitution?.forbiddenMutationBlocked,
      fullStagePipeline: measurement.constitution?.fullStagePipeline,
      humanApprovalRequired: measurement.constitution?.humanApprovalRequired,
      sameCriteriaAndEnvironment: measurement.comparability?.sameCriteriaAndEnvironment,
      behavioralConflictDetected: measurement.semanticMerge?.behavioralConflictDetected,
    };
    for (const [label, value] of Object.entries(checks)) if (value !== true) failures.push(`${label} not measured`);
    for (const [label, value] of Object.entries({
      autonomousMergeAllowed: measurement.selfHealing?.autonomousMergeAllowed,
      publishAllowed: measurement.selfHealing?.publishAllowed,
      productionPromotionExecuted: measurement.constitution?.productionPromotionExecuted,
      autonomyExpanded: measurement.constitution?.autonomyExpanded,
      frontierSuperiorityClaimAllowed: measurement.boundaries?.frontierSuperiorityClaimAllowed,
      realSevenToThirtyDayFieldSurvivalCertified: measurement.boundaries?.realSevenToThirtyDayFieldSurvivalCertified,
    })) if (value !== false) failures.push(`${label} non-claim violated`);
    if ((measurement.composition?.appStaticImports ?? Infinity) > 160 || (measurement.composition?.appConstructors ?? Infinity) > 180) failures.push('composition budget exceeded');
    const unsigned = { ...measurement }; delete unsigned.receiptSha256;
    if (!SHA.test(measurement.receiptSha256 ?? '') || canonicalSha256(unsigned) !== measurement.receiptSha256) failures.push('measurement receipt invalid');
  }

  let audit = null;
  try { audit = JSON.parse(await source(root, `docs/feature-audit-${releaseVersion}.json`, failures)); } catch { failures.push('audit JSON invalid'); }
  if (!audit || audit.totalItems !== 1150 || JSON.stringify(audit.summary) !== JSON.stringify(expectedFrontierAuditCounts(releaseVersion))) failures.push('frontier audit transition mismatch');
  const limitations = await source(root, `docs/LIMITATIONS-${releaseVersion}.md`, failures);
  for (const phrase of [
    'does not autonomously merge or publish',
    'does not execute production policy promotion',
    'does not certify real 7–30 day field survival',
    'does not expand autonomy or capability',
    'does not claim frontier superiority',
  ]) if (!limitations.includes(phrase)) failures.push(`missing limitation: ${phrase}`);

  const base = {
    schema: 'forge.studio.frontier-safety-self-healing-verification.v1',
    version: releaseVersion,
    status: failures.length ? 'fail' : 'pass',
    failures,
    measurement,
    boundaries: measurement?.boundaries ?? {},
  };
  const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  if (outputFile) { await mkdir(path.dirname(outputFile), { recursive: true }); await writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`); }
  return report;
}
