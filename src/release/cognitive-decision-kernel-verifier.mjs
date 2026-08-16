import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { expectedFrontierAuditCounts } from './frontier-audit-counts.mjs';

const SHA = /^[a-f0-9]{64}$/;
async function source(root, relative, failures) { try { return await readFile(path.join(root, relative), 'utf8'); } catch { failures.push(`missing ${relative}`); return ''; } }
async function present(root, relative, failures) { try { await access(path.join(root, relative)); } catch { failures.push(`missing ${relative}`); } }
function requirePattern(text, pattern, label, failures) { if (!pattern.test(text)) failures.push(`missing behavior: ${label}`); }

export async function verifyCognitiveDecisionKernel({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory);
  const releaseVersion = String(version ?? '');
  const failures = [];
  const required = [
    'src/cognition/context-posterior-manager.mjs', 'src/cognition/hypothesis-population.mjs',
    'src/cognition/epistemic-action-selector.mjs', 'src/cognition/structured-error-router.mjs',
    'src/cognition/episodic-binder.mjs', 'src/cognition/agency-ledger.mjs',
    'src/cognition/cognitive-policy-gates.mjs', 'src/cognition/cognitive-kernel.mjs',
    'tests/context-posterior-manager.test.mjs', 'tests/hypothesis-population.test.mjs',
    'tests/epistemic-action-selector.test.mjs', 'tests/structured-error-router.test.mjs',
    'tests/episodic-binder.test.mjs', 'tests/agency-ledger.test.mjs',
    'tests/cognitive-policy-gates.test.mjs', 'tests/cognitive-kernel.test.mjs',
    'tests/cognitive-decision-plane-integration.test.mjs', 'tests/agent-loop-cognitive-mode.test.mjs',
  ];
  for (const file of required) await present(root, file, failures);

  const utils = await source(root, 'src/cognition/cognition-utils.mjs', failures);
  const posterior = await source(root, 'src/cognition/context-posterior-manager.mjs', failures);
  const hypotheses = await source(root, 'src/cognition/hypothesis-population.mjs', failures);
  const selector = await source(root, 'src/cognition/epistemic-action-selector.mjs', failures);
  const router = await source(root, 'src/cognition/structured-error-router.mjs', failures);
  const episode = await source(root, 'src/cognition/episodic-binder.mjs', failures);
  const gates = await source(root, 'src/cognition/cognitive-policy-gates.mjs', failures);
  const kernel = await source(root, 'src/cognition/cognitive-kernel.mjs', failures);
  const plane = await source(root, 'src/decision/decision-plane.mjs', failures);
  const agentLoop = await source(root, 'src/agent/agent-loop.mjs', failures);
  const app = await source(root, 'src/app.mjs', failures);

  requirePattern(utils, /FORBIDDEN_KEYS[\s\S]*chainofthought[\s\S]*rawprompt[\s\S]*modeloutput[\s\S]*authorization/, 'recursive private-field guard', failures);
  requirePattern(posterior, /normalizedEntropy[\s\S]*canWriteDurableMemory[\s\S]*posterior-dispersed/, 'posterior concentration and durable-memory gate', failures);
  requirePattern(hypotheses, /maxActive[\s\S]*falsificationCondition[\s\S]*supportEvidence[\s\S]*counterEvidence[\s\S]*falsify/, 'bounded hypothesis population with falsification', failures);
  requirePattern(selector, /informationGain[\s\S]*tokenCost[\s\S]*ramCost[\s\S]*timeCost[\s\S]*irreversibilityRisk/, 'information-efficient action selection', failures);
  requirePattern(router, /(?=[\s\S]*ownerMask)(?=[\s\S]*unrelatedSubsystemsMasked)(?=[\s\S]*missing-binary)(?=[\s\S]*stale-symbol-memory)/, 'structured error posterior and owner mask', failures);
  requirePattern(episode, /expectedEffect[\s\S]*actualEffect[\s\S]*rollbackPoint[\s\S]*transcriptStored\s*:\s*false/, 'causal episode without transcript', failures);
  requirePattern(gates, /strategy-failed-in-current-lease[\s\S]*action-posterior-dispersed[\s\S]*verification-probe-unknown[\s\S]*marginal-information-gain-low/, 'recovery commit and stop gates', failures);
  requirePattern(kernel, /startTask[\s\S]*observe[\s\S]*propose[\s\S]*verify[\s\S]*commit[\s\S]*episodeReceiptSha256/, 'cognitive kernel lifecycle and causal binding', failures);
  requirePattern(plane, /(?=[\s\S]*cognitionLoaded)(?=[\s\S]*startCognitiveTask)(?=[\s\S]*commitCognitiveProposal)/, 'lazy Decision Plane cognition integration', failures);
  requirePattern(agentLoop, /cognitiveModeRequested[\s\S]*agent\.cognition\.recommendation[\s\S]*decisionPlane/, 'bounded Agent Loop cognition trigger', failures);
  if (/CognitiveKernel/.test(app)) failures.push('src/app.mjs must not import or instantiate CognitiveKernel directly');

  let measurement = null;
  try { measurement = JSON.parse(await source(root, `docs/cognitive-decision-kernel-measurement-${releaseVersion}.json`, failures)); }
  catch { failures.push('measurement JSON invalid'); }
  if (measurement) {
    if (measurement.version !== releaseVersion) failures.push('measurement version mismatch');
    if (measurement.context?.memoryAllowedBefore !== false || measurement.context?.memoryAllowedAfter !== true) failures.push('posterior memory gate not measured');
    if (measurement.hypotheses?.alternativeSurvived !== true || measurement.hypotheses?.falsifiedExplicitly !== true) failures.push('hypothesis survival/falsification not measured');
    if (measurement.actions?.selectedProbe !== 'targeted-test' || measurement.actions?.irreversibleRejected !== true) failures.push('epistemic action selection not measured');
    if (measurement.errors?.missingBinaryPrimary !== 'execution' || !measurement.errors?.staleMemoryOwners?.includes('memory')) failures.push('targeted error routing not measured');
    if (measurement.agency?.unverifiedClaimExcluded !== true || measurement.agency?.expectedVerifiedMismatch !== true || measurement.agency?.verifiedEffectReceiptBound !== true || measurement.agency?.rawCommandStored !== false) failures.push('agency verification/privacy not measured');
    if (measurement.episode?.bound !== true || measurement.episode?.transcriptStored !== false) failures.push('causal episode binding not measured');
    if (measurement.recovery?.failedStrategyBanned !== true) failures.push('recovery strategy ban not measured');
    if (measurement.commit?.deniedBeforeEvidence !== true || measurement.commit?.allowedAfterEvidence !== true) failures.push('commit gates not measured');
    if (measurement.stop?.criteriaVerifiedStops !== true || measurement.stop?.lowInformationGainStops !== true || measurement.stop?.criticalRiskPreventsStop !== true) failures.push('stop gates not measured');
    if (measurement.composition?.appStaticImports > 160 || measurement.composition?.appConstructors > 180) failures.push('composition budget exceeded');
    if (Object.values(measurement.boundaries ?? {}).some((value) => value !== false)) failures.push('measurement boundaries inflated');
    const unsigned = { ...measurement }; delete unsigned.receiptSha256;
    if (!SHA.test(measurement.receiptSha256 ?? '') || canonicalSha256(unsigned) !== measurement.receiptSha256) failures.push('measurement receipt invalid');
  }

  let audit = null;
  try { audit = JSON.parse(await source(root, `docs/feature-audit-${releaseVersion}.json`, failures)); }
  catch { failures.push('audit JSON invalid'); }
  const expected = expectedFrontierAuditCounts(releaseVersion);
  if (!audit || audit.totalItems !== 1150 || JSON.stringify(audit.summary) !== JSON.stringify(expected)) failures.push('1,150-item audit counts are not honest');

  const limitations = await source(root, `docs/LIMITATIONS-${releaseVersion}.md`, failures);
  for (const [pattern, label] of [
    [/chain-of-thought|private reasoning/i, 'private-reasoning non-claim'],
    [/does not.*mutate source|không.*tự.*sửa.*source/i, 'autonomous source-mutation non-claim'],
    [/does not.*learn.*policy|không.*tự.*học.*policy/i, 'learned-policy non-claim'],
    [/causal intervention.*not|causal intervention.*chưa/i, 'causal-intervention limitation'],
    [/does not claim.*outperform|không.*vượt.*Cursor/i, 'comparative non-claim'],
  ]) requirePattern(limitations, pattern, label, failures);

  const boundaries = Object.freeze({
    chainOfThoughtStored: false,
    autonomousSourceMutationClaimed: false,
    autonomousDurableMemoryClaimed: false,
    learnedPolicyClaimed: false,
    skillPromotionClaimed: false,
    causalInterventionProductionClaimed: false,
    comparativeSuperiorityClaimed: false,
  });
  const base = {
    schema: 'forge.studio.cognitive-decision-kernel-verification.v1',
    version: releaseVersion,
    status: failures.length ? 'fail' : 'pass',
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
    const error = new Error(`Cognitive Decision Kernel verification failed with ${failures.length} issue(s)`);
    error.code = 'COGNITIVE_DECISION_KERNEL_VERIFICATION_FAILED';
    error.report = report;
    throw error;
  }
  return report;
}
