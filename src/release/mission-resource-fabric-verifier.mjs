import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const REQUIRED = Object.freeze([
  'src/runtime/mission-process-ledger.mjs',
  'src/providers/provider-session-host.mjs',
  'src/repository/incremental-intelligence-journal.mjs',
  'src/providers/harness-canary-controller.mjs',
  'src/browser/browser-journey-recorder.mjs',
  'src/orchestration/hosted-lifecycle-coordinator.mjs',
  'src/runtime/mission-resource-fabric.mjs',
  'src/app.mjs',
  'src/server/routes.mjs',
  'ui/index.html',
  'ui/mission-resource-fabric.js',
  'ui/mission-resource-fabric.css',
  'scripts/run-node-test-suite.mjs',
  'scripts/measure-mission-resource-fabric.mjs',
  'scripts/verify-mission-resource-fabric.mjs',
  'src/release/full-release-matrix.mjs',
  'tests/mission-process-ledger.test.mjs',
  'tests/provider-session-host.test.mjs',
  'tests/incremental-intelligence-journal.test.mjs',
  'tests/harness-canary-controller.test.mjs',
  'tests/browser-journey-recorder.test.mjs',
  'tests/hosted-lifecycle-coordinator.test.mjs',
  'tests/mission-resource-fabric-release-gate.test.mjs',
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
function validSha(value) { return /^[a-f0-9]{64}$/.test(String(value ?? '')); }

export async function verifyMissionResourceFabric({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory);
  const releaseVersion = String(version ?? '').trim();
  const failures = [];
  const contents = new Map();
  for (const relative of REQUIRED) contents.set(relative, await source(root, relative, failures));

  const ledger = contents.get('src/runtime/mission-process-ledger.mjs') ?? '';
  const sessions = contents.get('src/providers/provider-session-host.mjs') ?? '';
  const journal = contents.get('src/repository/incremental-intelligence-journal.mjs') ?? '';
  const canary = contents.get('src/providers/harness-canary-controller.mjs') ?? '';
  const journeys = contents.get('src/browser/browser-journey-recorder.mjs') ?? '';
  const hosted = contents.get('src/orchestration/hosted-lifecycle-coordinator.mjs') ?? '';
  const facade = contents.get('src/runtime/mission-resource-fabric.mjs') ?? '';
  const app = contents.get('src/app.mjs') ?? '';
  const routes = contents.get('src/server/routes.mjs') ?? '';
  const html = contents.get('ui/index.html') ?? '';
  const uiJs = contents.get('ui/mission-resource-fabric.js') ?? '';
  const uiCss = contents.get('ui/mission-resource-fabric.css') ?? '';
  const runner = contents.get('scripts/run-node-test-suite.mjs') ?? '';
  const matrix = contents.get('src/release/full-release-matrix.mjs') ?? '';

  requirePattern(ledger, /(?=[\s\S]*missionId)(?=[\s\S]*taskId)(?=[\s\S]*providerId)(?=[\s\S]*peak)(?=[\s\S]*fileDescriptors)(?=[\s\S]*const allowed = \['executable', 'kind', 'role', 'profileId', 'runtimeKind', 'workspaceHash'\])/, 'mission-attributed process ledger with bounded metadata', failures);
  requirePattern(sessions, /(?=[\s\S]*logicalSessions)(?=[\s\S]*completeInSession)(?=[\s\S]*one-shot-pressure)(?=[\s\S]*fingerprint-changed)(?=[\s\S]*processLedger\.register)(?=[\s\S]*applyGovernorState)/, 'protocol-aware provider session host with pressure eviction', failures);
  requirePattern(journal, /(?=[\s\S]*publish\()(?=[\s\S]*readBatch\()(?=[\s\S]*ack\()(?=[\s\S]*supersedesCursor)(?=[\s\S]*consumer cursor must be monotonic)(?=[\s\S]*retentionFloorCursor)/, 'shared incremental intelligence journal', failures);
  requirePattern(canary, /(?=[\s\S]*determin|[\s\S]*bucket\()(?=[\s\S]*minSamples)(?=[\s\S]*maxPassRateRegression)(?=[\s\S]*maxResourceRegression)(?=[\s\S]*disable-regression)(?=[\s\S]*operator-disabled)/, 'governed harness canary cutoff', failures);
  requirePattern(journeys, /(?=[\s\S]*domView)(?=[\s\S]*accessibilityView)(?=[\s\S]*consoleView)(?=[\s\S]*networkView)(?=[\s\S]*artifacts)(?=[\s\S]*visualCorrectness:\s*false)/, 'browser journey evidence without visual oracle claims', failures);
  requirePattern(hosted, /(?=[\s\S]*HOSTED_ADAPTER_NOT_OPERATED)(?=[\s\S]*awaiting-local-verification)(?=[\s\S]*pull-request-open)(?=[\s\S]*awaiting-human-merge)(?=[\s\S]*repair-exhausted)(?=[\s\S]*merge:\s*false)/, 'fail-closed hosted issue to PR to CI lifecycle', failures);
  requirePattern(facade, /(?=[\s\S]*MissionProcessLedger)(?=[\s\S]*ProviderSessionHost)(?=[\s\S]*IncrementalIntelligenceJournal)(?=[\s\S]*BrowserJourneyRecorder)(?=[\s\S]*HostedLifecycleCoordinator)(?=[\s\S]*publicView\()(?=[\s\S]*createMissionResourceFabric)/, 'single mission resource fabric facade', failures);
  requirePattern(app, /(?=[\s\S]*createMissionResourceFabric)(?=[\s\S]*sessionHost:\s*missionResourceFabric\.sessionHost)(?=[\s\S]*journal:\s*missionResourceFabric\.journal)(?=[\s\S]*missionResourceFabric\.close)/, 'application mission resource fabric lifecycle wiring', failures);
  requirePattern(routes, /mission-resource-fabric/, 'authenticated mission resource fabric projection', failures);
  const primaryShells = (html.match(/data-shell="(?:mission|work|evidence)"/g) ?? []).length;
  if (primaryShells !== 3) failures.push(`primary UI shell count expected 3 but found ${primaryShells}`);
  requirePattern(html, /id="mission-resource-hud"/, 'mission resource HUD mount', failures);
  requirePattern(uiJs, /(?=[\s\S]*\/api\/mission-resource-fabric)(?=[\s\S]*requestAnimationFrame)(?=[\s\S]*slice\(0,\s*12\))/, 'bounded resource HUD rendering', failures);
  requirePattern(uiCss, /(?=[\s\S]*pressure)(?=[\s\S]*brownout)(?=[\s\S]*emergency)(?=[\s\S]*prefers-reduced-motion)/, 'pressure-aware reduced-effects UI', failures);
  if (/backdrop-filter|filter:\s*blur\(/i.test(uiCss)) failures.push('mission resource UI uses heavy blur');
  requirePattern(runner, /(?=[\s\S]*--test-force-exit)(?=[\s\S]*delete childEnv\.NODE_TEST_CONTEXT)(?=[\s\S]*child\.once\('close')(?=[\s\S]*exit code)/, 'bounded clean-exit Node test runner', failures);
  requirePattern(matrix, /id:\s*'mission-resource-fabric'[\s\S]*verify-mission-resource-fabric\.mjs/, 'required mission resource fabric matrix gate', failures);

  const appStaticImports = (app.match(/^import\s.+$/gm) ?? []).length;
  const appConstructors = (app.match(/\bnew\s+[A-Z][A-Za-z0-9_$]*/g) ?? []).length;
  if (appStaticImports > 160) failures.push(`app static imports exceed budget: ${appStaticImports} > 160`);
  if (appConstructors > 180) failures.push(`app eager constructor expressions exceed budget: ${appConstructors} > 180`);

  let audit = null;
  try { audit = JSON.parse(await readFile(path.join(root, 'docs', `feature-audit-${releaseVersion}.json`), 'utf8')); }
  catch { failures.push(`missing or invalid feature audit for ${releaseVersion}`); }
  const auditCounts = counts(audit);
  const expected = { verified_source_test: 734, partial: 0, external_gate: 56, not_implemented: 0 };
  for (const [status, value] of Object.entries(expected)) if (auditCounts[status] !== value) failures.push(`audit count ${status} expected ${value} but found ${auditCounts[status]}`);

  let measurement = null;
  try { measurement = JSON.parse(await readFile(path.join(root, 'docs', `mission-resource-fabric-measurement-${releaseVersion}.json`), 'utf8')); }
  catch { failures.push(`missing or invalid mission resource fabric measurement for ${releaseVersion}`); }
  if (measurement) {
    const process = measurement.processAttribution ?? {};
    if (process.missionId !== 'measurement-mission' || process.taskId !== 'measurement-task' || process.providerId !== 'codex-app-server') failures.push('mission process attribution was not measured');
    if (!(process.peakRssBytes > 0) || !(process.cpuTimeMs > 0) || !(process.processCount > 0) || !(process.fileDescriptors > 0)) failures.push('process resource dimensions were not measured');
    if (process.rawPromptStored !== false || process.secretStored !== false || !validSha(process.receiptSha256)) failures.push('process attribution privacy or receipt is invalid');
    const session = measurement.sessionReuse ?? {};
    if (session.openCount !== 1 || session.reusedSecondCall !== true || session.sameSession !== true) failures.push('logical provider session reuse was not measured');
    if (session.oneShotMode !== 'one-shot' || session.oneShotClaimedPersistent !== false) failures.push('one-shot provider honesty was not measured');
    if (session.pressureEvicted !== 1 || session.remainingAfterPressure !== 0) failures.push('pressure session eviction was not measured');
    const intelligence = measurement.intelligence ?? {};
    if (intelligence.duplicateCoalesced !== true || intelligence.staleGenerationSuperseded !== true || intelligence.acknowledgedCursor !== intelligence.latestCursor || !validSha(intelligence.receiptSha256)) failures.push('incremental intelligence journal behavior was not measured');
    const canaryMeasure = measurement.canary ?? {};
    if (canaryMeasure.regressionDisabled !== true || canaryMeasure.decision !== 'disable-regression' || canaryMeasure.rawPayloadStored !== false || !validSha(canaryMeasure.receiptSha256)) failures.push('harness canary regression cutoff was not measured');
    const journey = measurement.journey ?? {};
    if (journey.domCaptured !== true || journey.accessibilityCaptured !== true || journey.screenshotAvailable !== true || journey.videoUnavailableExplicit !== true || journey.visualCorrectnessClaimed !== false || journey.rawUrlSecretStored !== false || !validSha(journey.receiptSha256)) failures.push('browser journey evidence was not measured honestly');
    const hostedMeasure = measurement.hosted ?? {};
    if (hostedMeasure.externalGateWithoutAdapter !== true || hostedMeasure.humanMergeRequired !== true || hostedMeasure.automaticMergeCapability !== false || hostedMeasure.finalState !== 'awaiting-human-merge' || !validSha(hostedMeasure.receiptSha256)) failures.push('hosted lifecycle human gate was not measured');
    if (measurement.ui?.primaryShells !== 3 || measurement.ui?.resourceHudPresent !== true || measurement.ui?.pressureAware !== true || measurement.ui?.heavyBlurUsed !== false) failures.push('lean pressure-aware UI shell was not measured');
    if (measurement.testRunner?.forceExitEnabled !== true || measurement.testRunner?.nestedContextCleared !== true) failures.push('clean-exit test runner was not measured');
    if (measurement.composition?.appStaticImports > 160 || measurement.composition?.appConstructors > 180) failures.push('measurement composition budget is invalid');
    const receipt = measurement.receiptSha256; const base = { ...measurement }; delete base.receiptSha256;
    if (!validSha(receipt) || canonicalSha256(base) !== receipt) failures.push('mission resource fabric measurement receipt is invalid');
  }

  const limitations = await source(root, `docs/LIMITATIONS-${releaseVersion}.md`, failures);
  for (const [pattern, label] of [
    [/does not certify process-tree accounting on every.*operating system|process-tree accounting.*requires.*platform runner/i, 'cross-platform process accounting non-claim'],
    [/one-shot.*not.*persistent|does not claim.*one-shot.*persistent/i, 'one-shot persistence non-claim'],
    [/screenshot.*does not prove visual correctness|does not infer visual correctness/i, 'visual correctness non-claim'],
    [/does not auto(?:matically)?[- ]merge|human merge.*required/i, 'automatic hosted merge non-claim'],
    [/canary.*does not autonomously promote|production canary.*does not.*promot/i, 'autonomous canary promotion non-claim'],
  ]) requirePattern(limitations, pattern, label, failures);

  const metrics = Object.freeze({ appStaticImports, appConstructors, primaryShells });
  const boundaries = Object.freeze({
    allOperatingSystemsCertified: false,
    persistentSessionsClaimedForOneShotCli: false,
    visualCorrectnessClaimed: false,
    automaticHostedMergeClaimed: false,
    autonomousCanaryPromotionClaimed: false,
    independentComparativeSuperiorityClaimed: false,
  });
  const base = { schema: 'forge.studio.mission-resource-fabric-verification.v1', version: releaseVersion, status: failures.length ? 'fail' : 'pass', auditCounts, measurement, metrics, boundaries, failures: Object.freeze(failures) };
  const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  if (outputFile) { await mkdir(path.dirname(path.resolve(outputFile)), { recursive: true }); await writeFile(path.resolve(outputFile), `${JSON.stringify(report, null, 2)}\n`); }
  if (failures.length) { const error = new Error(`Mission resource fabric verification failed with ${failures.length} issue(s)`); error.code = 'MISSION_RESOURCE_FABRIC_VERIFICATION_FAILED'; error.report = report; throw error; }
  return report;
}
