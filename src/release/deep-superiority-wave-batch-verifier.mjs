import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { measureDeepSuperiorityWaveBatch } from '../../scripts/measure-deep-superiority-wave-batch.mjs';

const SHA = /^[a-f0-9]{64}$/i;
async function exists(root, relative, failures) { try { await access(path.join(root, relative)); } catch { failures.push(`missing ${relative}`); } }
async function source(root, relative, failures) { try { return await readFile(path.join(root, relative), 'utf8'); } catch { failures.push(`missing ${relative}`); return ''; } }
function requirePattern(text, pattern, label, failures) { if (!pattern.test(text)) failures.push(`missing behavior: ${label}`); }
function requireTrue(value, label, failures) { if (value !== true) failures.push(`${label} not measured`); }
function requireFalse(value, label, failures) { if (value !== false) failures.push(`${label} boundary inflated`); }

export async function verifyDeepSuperiorityWaveBatch({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory);
  const releaseVersion = String(version ?? JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version);
  const failures = [];
  const required = [
    'src/superiority/deep/mission-constitution-engine.mjs',
    'src/superiority/deep/counterfactual-execution-planner.mjs',
    'src/superiority/deep/verification-memory-curator.mjs',
    'src/superiority/deep/self-healing-runtime.mjs',
    'src/superiority/deep/proof-budget-scheduler.mjs',
    'src/superiority/deep/comparative-benchmark-lab.mjs',
    'src/superiority/deep/local-ui-certification-lab.mjs',
    'src/superiority/deep/provider-dogfood-replay-lab.mjs',
    'src/runtime/superiority-plane.mjs', 'src/decision/decision-plane.mjs', 'src/runtime/mission-resource-fabric.mjs', 'src/server/routes.mjs',
    'tests/deep-superiority-constitution-counterfactual.test.mjs', 'tests/deep-superiority-memory-self-healing.test.mjs',
    'tests/deep-superiority-budget-benchmark.test.mjs', 'tests/deep-superiority-ui-dogfood.test.mjs',
    'tests/deep-superiority-plane-integration.test.mjs', 'tests/deep-superiority-http-api.test.mjs',
    'docs/Deep-Superiority-Wave-Batch.md',
  ];
  for (const relative of required) await exists(root, relative, failures);
  const [constitution, counterfactual, memory, healing, budget, benchmark, ui, dogfood, plane, decision, fabric, routes, docs] = await Promise.all([
    'src/superiority/deep/mission-constitution-engine.mjs', 'src/superiority/deep/counterfactual-execution-planner.mjs',
    'src/superiority/deep/verification-memory-curator.mjs', 'src/superiority/deep/self-healing-runtime.mjs',
    'src/superiority/deep/proof-budget-scheduler.mjs', 'src/superiority/deep/comparative-benchmark-lab.mjs',
    'src/superiority/deep/local-ui-certification-lab.mjs', 'src/superiority/deep/provider-dogfood-replay-lab.mjs',
    'src/runtime/superiority-plane.mjs', 'src/decision/decision-plane.mjs', 'src/runtime/mission-resource-fabric.mjs', 'src/server/routes.mjs',
    'docs/Deep-Superiority-Wave-Batch.md',
  ].map((relative) => source(root, relative, failures)));

  requirePattern(constitution, /EFFECT_DENIED[\s\S]*BUDGET_EXCEEDED[\s\S]*explicit human approval[\s\S]*automaticPolicyMutationAllowed:\s*false/, 'immutable mission constitution and human amendment boundary', failures);
  requirePattern(counterfactual, /risk-budget[\s\S]*proof-coverage[\s\S]*rollback-coverage[\s\S]*dominated[\s\S]*automaticExecutionAllowed:\s*false/, 'counterfactual Pareto and execution boundary', failures);
  requirePattern(memory, /minimumIndependentSuccesses[\s\S]*Memory promotion requires explicit human approval[\s\S]*tombstoned[\s\S]*rawContentStored:\s*false/, 'verification memory curation and tombstones', failures);
  requirePattern(healing, /circuitOpen[\s\S]*maxRepairAttempts[\s\S]*Repair approval required[\s\S]*unboundedSelfModificationAllowed:\s*false/, 'bounded self-healing circuit and approval', failures);
  requirePattern(budget, /verificationReserveRatio[\s\S]*verification-reserve-insufficient[\s\S]*dependency-cycle[\s\S]*proofStarvationAllowed:\s*false/, 'proof budget reservation and dependency scheduling', failures);
  requirePattern(benchmark, /environmentFingerprint[\s\S]*competitor-artifact-not-independent[\s\S]*twoSidedSignP[\s\S]*comparativeSuperiorityClaimAllowed/, 'paired comparative benchmark statistics and independence', failures);
  requirePattern(ui, /640[\s\S]*900[\s\S]*1180[\s\S]*1440[\s\S]*windowsCertificationRequired:\s*true[\s\S]*wcag22AaCertified:\s*false/, 'local UI implementation and external certification boundary', failures);
  requirePattern(dogfood, /Mock dogfood receipt is forbidden[\s\S]*Machine-labelled Windows 8 GB receipt required[\s\S]*Independent verifier required[\s\S]*provider-real-windows-receipt-missing/, 'signed provider-real dogfood protocol', failures);
  requirePattern(plane, /MissionConstitutionEngine[\s\S]*CounterfactualExecutionPlanner[\s\S]*VerificationMemoryCurator[\s\S]*SelfHealingRuntime[\s\S]*ProofBudgetScheduler[\s\S]*ComparativeBenchmarkLab[\s\S]*LocalUICertificationLab[\s\S]*ProviderDogfoodReplayLab/, 'SuperiorityPlane eight-wave composition', failures);
  requirePattern(decision, /(?=[\s\S]*registerMissionConstitution)(?=[\s\S]*decideCounterfactualPlan)(?=[\s\S]*promoteVerifiedMemory)(?=[\s\S]*executeSelfHealingRepair)(?=[\s\S]*scheduleProofBudget)(?=[\s\S]*evaluateComparativeStudy)(?=[\s\S]*certifyLocalUi)(?=[\s\S]*evaluateDogfoodSuite)/, 'DecisionPlane production wiring', failures);
  requirePattern(fabric, /superiority:\s*this\.decision\.superioritySnapshot\(\)[\s\S]*registerMissionConstitution[\s\S]*scheduleProofBudget[\s\S]*certifyLocalUi/, 'MissionResourceFabric public projection', failures);
  requirePattern(routes, /\/api\/superiority\/constitution\/register[\s\S]*\/api\/superiority\/counterfactual\/decide[\s\S]*\/api\/superiority\/memory\/promote[\s\S]*\/api\/superiority\/budget\/schedule[\s\S]*\/api\/superiority\/benchmark\/evaluate[\s\S]*\/api\/superiority\/ui\/certify[\s\S]*\/api\/superiority\/dogfood\/evaluate/, 'authenticated HTTP surface', failures);
  requirePattern(docs, /eight|tám[\s\S]*193[\s\S]*5 external[\s\S]*0 not-implemented[\s\S]*comparativeSuperiorityClaimAllowed=false/i, 'wave scope and honest claim documentation', failures);

  const measurement = await measureDeepSuperiorityWaveBatch({ rootDirectory: root, version: releaseVersion });
  const measurementPath = path.join(root, 'docs', `deep-superiority-wave-batch-measurement-${releaseVersion}.json`);
  let persisted = null;
  try { persisted = JSON.parse(await readFile(measurementPath, 'utf8')); }
  catch { failures.push(`missing or invalid ${path.relative(root, measurementPath).replaceAll('\\', '/')}`); }
  if (persisted && canonicalSha256(Object.fromEntries(Object.entries(persisted).filter(([key]) => key !== 'receiptSha256'))) !== persisted.receiptSha256) failures.push('persisted measurement receipt invalid');
  if (persisted && persisted.receiptSha256 !== measurement.receiptSha256) failures.push('persisted measurement is stale');

  for (const [label, value] of Object.entries({
    'forbidden effect blocked': measurement.constitution?.forbiddenEffectBlocked,
    'constitution amendment requires human': measurement.constitution?.amendmentRejectedWithoutHuman,
    'safe counterfactual selected': measurement.counterfactual?.safeCandidateSelected,
    'unsafe counterfactual rejected': measurement.counterfactual?.unsafeCandidateRejected,
    'memory independently verified': measurement.verificationMemory?.independentlyVerified,
    'memory promotion requires human': measurement.verificationMemory?.humanPromotionRequired,
    'self-healing circuit opened': measurement.selfHealing?.circuitOpenedForCriticalAnomaly,
    'bounded repair executed': measurement.selfHealing?.boundedRepairExecuted,
    'proof capacity reserved': measurement.proofBudget?.proofCapacityReserved,
    'impossible proof mission blocked': measurement.proofBudget?.impossibleMissionBlocked,
    'benchmark protocol gate exercised': measurement.comparativeBenchmark?.protocolClaimGateCanOpen,
    'local UI certification passed': measurement.localUi?.localCertificationPassed,
    'dogfood signature protocol accepted': measurement.dogfood?.signedProviderRealProtocolAccepted,
    'DecisionPlane wiring measured': measurement.productionWiring?.decisionPlaneComposesAllWaves,
    'MissionResourceFabric wiring measured': measurement.productionWiring?.missionResourceFabricProjectsAllWaves,
    'HTTP wiring measured': measurement.productionWiring?.authenticatedHttpSurface,
    'local implementation verified': measurement.claims?.localDeepSuperiorityImplementationVerified,
  })) requireTrue(value, label, failures);
  if (measurement.requirements?.verified !== 193 || measurement.requirements?.externalGate !== 5 || measurement.requirements?.notImplemented !== 0) failures.push('requirement status is not 193 verified / 5 external / 0 not-implemented');
  for (const [label, value] of Object.entries({
    'automatic counterfactual execution': measurement.counterfactual?.automaticExecutionAllowed,
    'raw memory content storage': measurement.verificationMemory?.rawContentStored,
    'unbounded self modification': measurement.selfHealing?.unboundedSelfModificationAllowed,
    'proof starvation': measurement.proofBudget?.proofStarvationAllowed,
    'independent NolaneNative artifact bundled': measurement.comparativeBenchmark?.independentNolaneNativeArtifactBundled,
    'provider-real receipt bundled': measurement.dogfood?.providerRealReceiptBundled,
    'production comparative superiority': measurement.claims?.productionComparativeSuperiorityAllowed,
    'production dogfood certification': measurement.claims?.productionProviderRealDogfoodCertified,
    'Windows UI certification': measurement.claims?.windowsUiCertified,
    'WCAG certification': measurement.claims?.wcag22AaCertified,
    'complete parity claim': measurement.claims?.completeParityClaimAllowed,
  })) requireFalse(value, label, failures);
  if (Object.values(measurement.boundaries ?? {}).some((value) => value !== false)) failures.push('measurement safety boundaries inflated');
  const unsigned = { ...measurement }; delete unsigned.receiptSha256;
  if (!SHA.test(measurement.receiptSha256 ?? '') || canonicalSha256(unsigned) !== measurement.receiptSha256) failures.push('measurement receipt invalid');

  const base = {
    schema: 'nolane.agent.deep-superiority-wave-batch-verification.v1', version: releaseVersion,
    status: failures.length ? 'fail' : 'pass', measurementPath, measurement,
    claims: { localDeepSuperiorityImplementationVerified: failures.length === 0, comparativeSuperiorityClaimAllowed: false, providerRealDogfoodCertified: false, windowsUiCertified: false, completeParityClaimAllowed: false },
    failures: Object.freeze(failures),
  };
  const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  if (outputFile) { await mkdir(path.dirname(path.resolve(outputFile)), { recursive: true }); await writeFile(path.resolve(outputFile), `${JSON.stringify(report, null, 2)}\n`); }
  if (failures.length) { const error = new Error(`Deep superiority wave batch verification failed with ${failures.length} issue(s)`); error.code = 'DEEP_SUPERIORITY_WAVE_BATCH_FAILED'; error.report = report; throw error; }
  return report;
}
