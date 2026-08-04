import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const SHA = /^[a-f0-9]{64}$/i;
async function present(root, relative, failures) { try { await access(path.join(root, relative)); } catch { failures.push(`missing ${relative}`); } }
async function source(root, relative, failures) { try { return await readFile(path.join(root, relative), 'utf8'); } catch { failures.push(`missing ${relative}`); return ''; } }
function requirePattern(text, pattern, label, failures) { if (!pattern.test(text)) failures.push(`missing behavior: ${label}`); }

export async function verifyNolaneProofIntelligence({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory);
  const releaseVersion = String(version ?? '');
  const failures = [];
  const required = [
    'src/superiority/superiority-utils.mjs',
    'src/superiority/proof-mission-compiler.mjs',
    'src/superiority/causal-repository-twin.mjs',
    'src/superiority/adversarial-solution-tournament.mjs',
    'src/superiority/adaptive-model-governor.mjs',
    'src/runtime/superiority-plane.mjs',
    'tests/superiority-proof-mission-compiler.test.mjs',
    'tests/superiority-causal-repository-twin.test.mjs',
    'tests/superiority-adversarial-tournament.test.mjs',
    'tests/superiority-adaptive-model-governor.test.mjs',
    'tests/superiority-plane-integration.test.mjs',
    'tests/superiority-http-api.test.mjs',
    'docs/NOLANE-PROOF-INTELLIGENCE.md',
  ];
  for (const file of required) await present(root, file, failures);
  const [proof, twin, tournament, governor, plane, decision, fabric, routes, docs] = await Promise.all([
    'src/superiority/proof-mission-compiler.mjs', 'src/superiority/causal-repository-twin.mjs',
    'src/superiority/adversarial-solution-tournament.mjs', 'src/superiority/adaptive-model-governor.mjs',
    'src/runtime/superiority-plane.mjs', 'src/decision/decision-plane.mjs', 'src/runtime/mission-resource-fabric.mjs',
    'src/server/routes.mjs', 'docs/NOLANE-PROOF-INTELLIGENCE.md',
  ].map((file) => source(root, file, failures)));
  requirePattern(proof, /topologicalOrder[\s\S]*falsificationSatisfied[\s\S]*independentVerifierSatisfied[\s\S]*deployAllowed/, 'proof obligations and deploy gate', failures);
  requirePattern(twin, /(?=[\s\S]*predictImpact)(?=[\s\S]*invalidateEvidence)(?=[\s\S]*recordObservedOutcome)(?=[\s\S]*automaticSourceMutationAllowed:\s*false)/, 'causal twin prediction and observed calibration', failures);
  requirePattern(tournament, /(?=[\s\S]*critical-counterexample-confirmed)(?=[\s\S]*independent-falsifier-missing)(?=[\s\S]*independent-verifier-missing)(?=[\s\S]*real-probe-required)/, 'adversarial independent selection', failures);
  requirePattern(governor, /(?=[\s\S]*smallestSufficientModelPolicy)(?=[\s\S]*Independent verification model is unavailable)(?=[\s\S]*explicit human approval)(?=[\s\S]*automaticPromotionAllowed:\s*false)/, 'adaptive model routing and promotion lock', failures);
  requirePattern(plane, /ProofMissionCompiler[\s\S]*CausalRepositoryTwin[\s\S]*AdversarialSolutionTournament[\s\S]*AdaptiveModelGovernor/, 'superiority plane composition', failures);
  requirePattern(decision, /(?=[\s\S]*superiorityLoaded)(?=[\s\S]*compileProofMission)(?=[\s\S]*predictCausalImpact)(?=[\s\S]*decideAdversarialTournament)(?=[\s\S]*routeGovernedModel)/, 'DecisionPlane lazy integration', failures);
  requirePattern(fabric, /superiority:\s*this\.decision\.superioritySnapshot\(\)[\s\S]*compileProofMission/, 'MissionResourceFabric production projection', failures);
  requirePattern(routes, /\/api\/superiority\/proof\/compile[\s\S]*\/api\/superiority\/twin\/predict[\s\S]*\/api\/superiority\/tournament\/decide[\s\S]*\/api\/superiority\/models\/route/, 'authenticated HTTP wiring', failures);
  requirePattern(docs, /external-reference[\s\S]*same model[\s\S]*same machine[\s\S]*same token[\s\S]*comparativeSuperiorityClaimAllowed=false/i, 'honest comparative boundary documentation', failures);

  let measurement = null;
  try { measurement = JSON.parse(await source(root, `docs/nolane-proof-intelligence-measurement-${releaseVersion}.json`, failures)); }
  catch { failures.push('measurement JSON invalid'); }
  if (measurement) {
    const checks = {
      'proof denied before evidence': measurement.proof?.deployDeniedBeforeEvidence,
      'proof allowed after evidence': measurement.proof?.deployAllowedAfterEvidence,
      'proof independent verification': measurement.proof?.independentVerificationRequired,
      'stale edge excluded': measurement.repositoryTwin?.staleEdgeExcluded,
      'observed calibration': measurement.repositoryTwin?.observedCalibrationRecorded,
      'critical candidate rejected': measurement.tournament?.criticalCandidateRejected,
      'independent candidate selected': measurement.tournament?.independentCandidateSelected,
      'easy task uses small model': measurement.modelGovernor?.easyUsesSmall,
      'risky task uses large model': measurement.modelGovernor?.riskyUsesLarge,
      'risky task uses independent verifier': measurement.modelGovernor?.riskyUsesIndependentVerifier,
      'private task uses local model': measurement.modelGovernor?.privateUsesLocal,
      'DecisionPlane integration measured': measurement.productionWiring?.decisionPlaneLazyIntegration,
      'HTTP integration measured': measurement.productionWiring?.authenticatedHttpSurface,
      'same-budget contract required': measurement.comparativeReadiness?.sameModelMachineTokenPermissionContractRequired,
    };
    for (const [label, value] of Object.entries(checks)) if (value !== true) failures.push(`${label} not measured`);
    if (measurement.comparativeReadiness?.claimAllowed !== false || measurement.comparativeReadiness?.independentReferenceArtifactPresent !== false) failures.push('comparative claim boundary inflated');
    if (Object.values(measurement.boundaries ?? {}).some((value) => value !== false)) failures.push('measurement safety boundaries inflated');
    const unsigned = { ...measurement }; delete unsigned.receiptSha256;
    if (!SHA.test(measurement.receiptSha256 ?? '') || canonicalSha256(unsigned) !== measurement.receiptSha256) failures.push('measurement receipt invalid');
  }
  const boundaries = Object.freeze({
    hiddenReasoningStored: false,
    rawPromptStored: false,
    rawModelOutputStored: false,
    automaticSourceMutationClaimed: false,
    automaticCommitClaimed: false,
    automaticDeploymentClaimed: false,
    automaticModelPromotionClaimed: false,
    comparativeSuperiorityClaimed: false,
  });
  const base = { schema: 'nolane.agent.nolane-proof-intelligence-verification.v1', version: releaseVersion, status: failures.length ? 'fail' : 'pass', measurement, boundaries, failures: Object.freeze(failures) };
  const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  if (outputFile) { await mkdir(path.dirname(path.resolve(outputFile)), { recursive: true }); await writeFile(path.resolve(outputFile), `${JSON.stringify(report, null, 2)}\n`); }
  if (failures.length) { const error = new Error(`Nolane Proof Intelligence verification failed with ${failures.length} issue(s)`); error.code = 'NOLANE_PROOF_INTELLIGENCE_FAILED'; error.report = report; throw error; }
  return report;
}
