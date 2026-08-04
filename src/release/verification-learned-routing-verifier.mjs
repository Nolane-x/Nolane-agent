import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { expectedFrontierAuditCounts } from './frontier-audit-counts.mjs';

const SHA = /^[a-f0-9]{64}$/;
async function source(root, relative, failures) { try { return await readFile(path.join(root, relative), 'utf8'); } catch { failures.push(`missing ${relative}`); return ''; } }
async function present(root, relative, failures) { try { await access(path.join(root, relative)); } catch { failures.push(`missing ${relative}`); } }
function requirePattern(text, pattern, label, failures) { if (!pattern.test(text)) failures.push(`missing behavior: ${label}`); }

export async function verifyVerificationLearnedRouting({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory); const releaseVersion = String(version ?? ''); const failures = [];
  const required = [
    'src/verification/verification-pyramid-planner.mjs','src/verification/test-integrity-guard.mjs','src/verification/api-existence-gate.mjs','src/verification/adversarial-review-coordinator.mjs','src/verification/failure-injection-lab.mjs','src/verification/trajectory-confidence-calibrator.mjs','src/verification/semantic-completion-gate.mjs','src/verification/verification-control-plane.mjs','src/providers/verified-outcome-bandit.mjs',
    'tests/verification-pyramid-planner.test.mjs','tests/test-integrity-guard.test.mjs','tests/api-existence-gate.test.mjs','tests/adversarial-review-coordinator.test.mjs','tests/failure-injection-lab.test.mjs','tests/trajectory-confidence-calibrator.test.mjs','tests/verified-outcome-bandit.test.mjs','tests/verification-control-plane.test.mjs','tests/verification-runner-pyramid.test.mjs',
  ];
  for (const file of required) await present(root, file, failures);
  const pyramid = await source(root, 'src/verification/verification-pyramid-planner.mjs', failures);
  const integrity = await source(root, 'src/verification/test-integrity-guard.mjs', failures);
  const api = await source(root, 'src/verification/api-existence-gate.mjs', failures);
  const review = await source(root, 'src/verification/adversarial-review-coordinator.mjs', failures);
  const failure = await source(root, 'src/verification/failure-injection-lab.mjs', failures);
  const confidence = await source(root, 'src/verification/trajectory-confidence-calibrator.mjs', failures);
  const bandit = await source(root, 'src/providers/verified-outcome-bandit.mjs', failures);
  const completion = await source(root, 'src/verification/semantic-completion-gate.mjs', failures);
  const control = await source(root, 'src/verification/verification-control-plane.mjs', failures);
  const runner = await source(root, 'src/orchestration/verification-runner.mjs', failures);
  const decision = await source(root, 'src/decision/decision-plane.mjs', failures);
  const app = await source(root, 'src/app.mjs', failures);
  requirePattern(pyramid, /parse-type[\s\S]*targeted[\s\S]*independent-review[\s\S]*full-suite/, 'risk-adaptive verification pyramid', failures);
  requirePattern(integrity, /test-skip[\s\S]*assertion-weakened[\s\S]*flaky-single-pass/, 'test integrity and flaky evidence guard', failures);
  requirePattern(api, /version-incompatible[\s\S]*signature-mismatch[\s\S]*platform-unsupported/, 'exact API existence evidence', failures);
  requirePattern(review, /provider-model[\s\S]*harness-role[\s\S]*unresolvedFindingFingerprints/, 'independent reviewer and disagreement gate', failures);
  requirePattern(failure, /network-loss[\s\S]*process-death[\s\S]*database-lock[\s\S]*memory-pressure[\s\S]*criterion-not-reverified/, 'bounded failure recovery proof', failures);
  requirePattern(confidence, /(?=[\s\S]*weakestCritical)(?=[\s\S]*brier)(?=[\s\S]*verification receipt)/, 'trajectory confidence calibration', failures);
  requirePattern(bandit, /mode:\s*'shadow'[\s\S]*verified outcome[\s\S]*providerAndHarnessPaired/, 'verified-outcome shadow bandit', failures);
  requirePattern(completion, /(?=[\s\S]*greenSuiteAloneSufficient)(?=[\s\S]*test-integrity-blocked)(?=[\s\S]*api-existence-blocked)(?=[\s\S]*independent-review-unresolved)/, 'semantic completion gate', failures);
  requirePattern(control, /planVerification[\s\S]*assessTestIntegrity[\s\S]*recordBanditOutcome[\s\S]*productionRoutingChanged:\s*false/, 'lazy verification facade', failures);
  requirePattern(runner, /verificationPyramid[\s\S]*verificationStageCommands[\s\S]*verification-stage-/, 'verification runner stage binding', failures);
  requirePattern(decision, /(?=[\s\S]*verificationLoaded)(?=[\s\S]*planVerification)(?=[\s\S]*decideSemanticCompletion)/, 'Decision Plane verification integration', failures);
  if (/VerificationControlPlane/.test(app)) failures.push('src/app.mjs must not import or instantiate VerificationControlPlane directly');

  let measurement = null;
  try { measurement = JSON.parse(await source(root, `docs/verification-learned-routing-measurement-${releaseVersion}.json`, failures)); } catch { failures.push('measurement JSON invalid'); }
  if (measurement) {
    if (measurement.version !== releaseVersion) failures.push('measurement version mismatch');
    for (const [pathLabel, value] of [
      ['low risk pyramid', measurement.pyramid?.lowRiskNarrow], ['high risk pyramid', measurement.pyramid?.highRiskExpanded], ['false green block', measurement.testIntegrity?.falseGreenBlocked], ['missing API block', measurement.api?.missingApiBlocked], ['independent reviewer', measurement.review?.independentReviewerSelected], ['review disagreement', measurement.review?.disagreementBlocked], ['failure recovery', measurement.failure?.recoveredAndReverified], ['weakest confidence', measurement.confidence?.weakestLinkBounded], ['verified bandit', measurement.bandit?.verifiedOnly], ['shadow bandit', measurement.bandit?.shadowOnly], ['semantic completion block', measurement.completion?.greenSuiteInsufficient], ['semantic completion pass', measurement.completion?.passWithAllEvidence],
    ]) if (value !== true) failures.push(`${pathLabel} not measured`);
    if (measurement.failure?.directOsFaultInjected !== false) failures.push('direct OS fault claim inflated');
    if (measurement.privacy?.privateReasoningStored !== false || measurement.privacy?.rawPromptsStored !== false || measurement.privacy?.rawModelOutputsStored !== false) failures.push('privacy boundary violated');
    if (measurement.composition?.appStaticImports > 160 || measurement.composition?.appConstructors > 180) failures.push('composition budget exceeded');
    if (Object.values(measurement.boundaries ?? {}).some((value) => value !== false)) failures.push('measurement boundaries inflated');
    const unsigned = { ...measurement }; delete unsigned.receiptSha256;
    if (!SHA.test(measurement.receiptSha256 ?? '') || canonicalSha256(unsigned) !== measurement.receiptSha256) failures.push('measurement receipt invalid');
  }
  let audit = null;
  try { audit = JSON.parse(await source(root, `docs/feature-audit-${releaseVersion}.json`, failures)); } catch { failures.push('audit JSON invalid'); }
  const expected = expectedFrontierAuditCounts(releaseVersion);
  if (!audit || audit.totalItems !== 1150 || JSON.stringify(audit.summary) !== JSON.stringify(expected)) failures.push('frontier audit transition mismatch');
  const limitations = await source(root, `docs/LIMITATIONS-${releaseVersion}.md`, failures);
  for (const phrase of ['does not certify production multi-provider reviewer independence','does not include a hidden hosted regression set','does not certify long-term patch survival','does not change production routing','does not claim benchmark superiority']) if (!limitations.includes(phrase)) failures.push(`missing limitation: ${phrase}`);
  const base = { schema: 'forge.studio.verification-learned-routing-verification.v1', version: releaseVersion, status: failures.length ? 'fail' : 'pass', failures, measurement, auditSummary: audit?.summary ?? null, boundaries: measurement?.boundaries ?? null };
  const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  if (outputFile) { await mkdir(path.dirname(outputFile), { recursive: true }); await writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`); }
  if (failures.length) { const error = new Error(`Verification and learned routing verification failed: ${failures.join('; ')}`); error.report = report; throw error; }
  return report;
}
