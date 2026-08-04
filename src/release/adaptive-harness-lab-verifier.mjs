import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const REQUIRED = Object.freeze([
  'src/providers/adaptive-harness-lab.mjs',
  'src/providers/harness-profile-registry.mjs',
  'src/providers/harness-request-composer.mjs',
  'src/providers/harness-failure-classifier.mjs',
  'src/providers/harness-failure-store.mjs',
  'src/providers/harness-experiment-service.mjs',
  'src/providers/provider-registry.mjs',
  'src/agent/agent-loop.mjs',
  'src/app.mjs',
  'tests/adaptive-harness-lab-composition.test.mjs',
  'tests/harness-profile-registry.test.mjs',
  'tests/harness-request-composer.test.mjs',
  'tests/harness-failure-classifier.test.mjs',
  'tests/harness-failure-store.test.mjs',
  'tests/harness-experiment-service.test.mjs',
  'tests/agent-loop-harness.test.mjs',
  'tests/adaptive-harness-lab-app-wiring.test.mjs',
  'tests/adaptive-harness-lab-release-gate.test.mjs',
  'scripts/measure-adaptive-harness-lab.mjs',
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

export async function verifyAdaptiveHarnessLab({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory);
  const releaseVersion = String(version ?? '').trim();
  const failures = [];
  const contents = new Map();
  for (const relative of REQUIRED) contents.set(relative, await source(root, relative, failures));
  const facade = contents.get('src/providers/adaptive-harness-lab.mjs') ?? '';
  const profiles = contents.get('src/providers/harness-profile-registry.mjs') ?? '';
  const composer = contents.get('src/providers/harness-request-composer.mjs') ?? '';
  const classifier = contents.get('src/providers/harness-failure-classifier.mjs') ?? '';
  const failureStore = contents.get('src/providers/harness-failure-store.mjs') ?? '';
  const experiments = contents.get('src/providers/harness-experiment-service.mjs') ?? '';
  const providers = contents.get('src/providers/provider-registry.mjs') ?? '';
  const agent = contents.get('src/agent/agent-loop.mjs') ?? '';
  const app = contents.get('src/app.mjs') ?? '';
  const matrix = contents.get('src/release/full-release-matrix.mjs') ?? '';

  requirePattern(facade, /(?=[\s\S]*createAdaptiveHarnessLab)(?=[\s\S]*HarnessProfileRegistry)(?=[\s\S]*HarnessRequestComposer)(?=[\s\S]*HarnessFailureStore)(?=[\s\S]*HarnessExperimentService)(?=[\s\S]*publicView)(?=[\s\S]*close)/, 'single adaptive harness composition facade', failures);
  requirePattern(profiles, /(?=[\s\S]*codex-cli-v1)(?=[\s\S]*claude-code-v1)(?=[\s\S]*gemini-cli-v1)(?=[\s\S]*generic-local-v1)(?=[\s\S]*profileSha256)(?=[\s\S]*promote\()(?=[\s\S]*rollback\()/, 'immutable multi-family harness registry with promotion and rollback', failures);
  requirePattern(composer, /(?=[\s\S]*registry\.resolve)(?=[\s\S]*systemDirectives)(?=[\s\S]*maxToolSchemas)(?=[\s\S]*structuredClone)(?=[\s\S]*receiptSha256)/, 'deterministic request composition preserving cloned tool schemas', failures);
  requirePattern(classifier, /(?=[\s\S]*provider-rate-limit)(?=[\s\S]*context-overflow)(?=[\s\S]*sandbox-denied)(?=[\s\S]*patch-conflict)(?=[\s\S]*loop-no-progress)(?=[\s\S]*fingerprint)/, 'bounded harness failure taxonomy', failures);
  requirePattern(failureStore, /(?=[\s\S]*const ALLOWED = new Set)(?=[\s\S]*unsupported telemetry field)(?=[\s\S]*harness_failures)(?=[\s\S]*evidence_receipt_sha256)(?=[\s\S]*summary\()(?=[\s\S]*clusters\()/, 'privacy-bounded allowlisted failure telemetry', failures);
  requirePattern(experiments, /(?=[\s\S]*suite\.cases\.length < 4)(?=[\s\S]*criticalRegressions)(?=[\s\S]*candidateSummary\.passRate < baselineSummary\.passRate)(?=[\s\S]*minImprovement)(?=[\s\S]*promotable)(?=[\s\S]*receiptSha256)/, 'replay-gated harness experiment comparison', failures);
  requirePattern(providers, /(?=[\s\S]*harnessFamily)(?=[\s\S]*inferHarnessFamily)(?=[\s\S]*codex-cli)(?=[\s\S]*claude-code)(?=[\s\S]*gemini-cli)/, 'provider harness-family metadata', failures);
  requirePattern(agent, /(?=[\s\S]*harnessComposer)(?=[\s\S]*harnessFailureStore)(?=[\s\S]*harnessFailureClassifier)(?=[\s\S]*agent\.harness\.failure-classified)(?=[\s\S]*harnessProfileId)(?=[\s\S]*provider\.complete)/, 'agent-loop harness composition and classified telemetry', failures);
  requirePattern(app, /(?=[\s\S]*createAdaptiveHarnessLab)(?=[\s\S]*adaptiveHarness\.composer)(?=[\s\S]*adaptiveHarness\.failureStore)(?=[\s\S]*adaptiveHarness\.failureClassifier)(?=[\s\S]*adaptiveHarness:\s*adaptiveHarness\.publicView\(\))(?=[\s\S]*adaptiveHarness\.close)/, 'application adaptive harness lifecycle wiring', failures);
  requirePattern(matrix, /id:\s*'adaptive-harness-lab'[\s\S]*verify-adaptive-harness-lab\.mjs/, 'required adaptive harness lab matrix gate', failures);

  const appStaticImports = (app.match(/^import\s.+$/gm) ?? []).length;
  const appConstructors = (app.match(/\bnew\s+[A-Z][A-Za-z0-9_$]*/g) ?? []).length;
  if (appStaticImports > 165) failures.push(`app static imports exceed budget: ${appStaticImports} > 165`);
  if (appConstructors > 185) failures.push(`app eager constructor expressions exceed budget: ${appConstructors} > 185`);

  let audit = null;
  try { audit = JSON.parse(await readFile(path.join(root, 'docs', `feature-audit-${releaseVersion}.json`), 'utf8')); }
  catch { failures.push(`missing or invalid feature audit for ${releaseVersion}`); }
  const auditCounts = counts(audit);
  const expected = { verified_source_test: 734, partial: 0, external_gate: 56, not_implemented: 0 };
  for (const [status, value] of Object.entries(expected)) if (auditCounts[status] !== value) failures.push(`audit count ${status} expected ${value} but found ${auditCounts[status]}`);

  let measurement = null;
  try { measurement = JSON.parse(await readFile(path.join(root, 'docs', `adaptive-harness-lab-measurement-${releaseVersion}.json`), 'utf8')); }
  catch { failures.push(`missing or invalid adaptive harness lab measurement for ${releaseVersion}`); }
  if (measurement) {
    if (!(measurement.distinctProfiles >= 3)) failures.push('distinct provider harness profiles were not measured');
    if (!(measurement.distinctSystemMessages >= 3)) failures.push('provider-specific system guidance was not measured');
    if (!(measurement.compositionReceipts >= 3)) failures.push('harness composition receipts were not measured');
    if (measurement.schemaPreserved !== true) failures.push('tool schema preservation was not measured');
    if (measurement.failureClass !== 'provider-rate-limit' || measurement.failureEvents !== 1) failures.push('classified bounded failure telemetry was not measured');
    if (measurement.rawPromptStored !== false || measurement.modelOutputStored !== false) failures.push('privacy rejection measurement is invalid');
    if (measurement.rejectedCandidates !== 1 || measurement.weakPromotable !== false) failures.push('weak candidate rejection was not measured');
    if (measurement.promotions !== 1 || measurement.strongPromotable !== true) failures.push('passing replay promotion was not measured');
    if (measurement.rollbacks !== 1) failures.push('harness rollback was not measured');
    for (const key of ['promotionReceiptSha256', 'rollbackReceiptSha256']) if (!/^[a-f0-9]{64}$/.test(String(measurement[key] ?? ''))) failures.push(`${key} is invalid`);
    const receipt = measurement.receiptSha256;
    const base = { ...measurement }; delete base.receiptSha256;
    if (!/^[a-f0-9]{64}$/.test(String(receipt ?? '')) || canonicalSha256(base) !== receipt) failures.push('adaptive harness lab measurement receipt is invalid');
  }

  const limitations = await source(root, `docs/LIMITATIONS-${releaseVersion}.md`, failures);
  for (const [pattern, label] of [
    [/does not autonomously (?:mutate|promote).*harness|no autonomous online harness mutation/i, 'autonomous online mutation non-claim'],
    [/production (?:feedback|telemetry).*does not.*promot|does not promote.*production (?:feedback|telemetry)/i, 'production telemetry promotion non-claim'],
    [/does not (?:attribute|certify).*process-tree|process-tree accounting.*not (?:implemented|certified|included)/i, 'process-tree accounting non-claim'],
    [/does not (?:implement|certify).*browser journey|browser journey verification.*not (?:implemented|certified|included)/i, 'browser journey verification non-claim'],
    [/does not guarantee.*model.*quality|provider-specific harness.*does not.*guarantee/i, 'model quality guarantee non-claim'],
  ]) requirePattern(limitations, pattern, label, failures);

  const metrics = Object.freeze({ appStaticImports, appConstructors });
  const boundaries = Object.freeze({
    autonomousOnlineMutationClaimed: false,
    productionFeedbackPromotionClaimed: false,
    processTreeAccountingCertified: false,
    browserJourneyVerificationCertified: false,
    modelQualityImprovementGuaranteed: false,
  });
  const base = { schema: 'forge.studio.adaptive-harness-lab-verification.v1', version: releaseVersion, status: failures.length ? 'fail' : 'pass', auditCounts, measurement, metrics, boundaries, failures: Object.freeze(failures) };
  const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  if (outputFile) { await mkdir(path.dirname(path.resolve(outputFile)), { recursive: true }); await writeFile(path.resolve(outputFile), `${JSON.stringify(report, null, 2)}\n`); }
  if (failures.length) { const error = new Error(`Adaptive harness lab verification failed with ${failures.length} issue(s)`); error.code = 'ADAPTIVE_HARNESS_LAB_VERIFICATION_FAILED'; error.report = report; throw error; }
  return report;
}
