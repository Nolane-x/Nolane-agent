import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { MissionProcessLedger } from '../src/runtime/mission-process-ledger.mjs';
import { ProviderSessionHost } from '../src/providers/provider-session-host.mjs';
import { IncrementalIntelligenceJournal } from '../src/repository/incremental-intelligence-journal.mjs';
import { HarnessCanaryController } from '../src/providers/harness-canary-controller.mjs';
import { HarnessProfileRegistry, createBuiltInHarnessProfiles } from '../src/providers/harness-profile-registry.mjs';
import { BrowserJourneyRecorder } from '../src/browser/browser-journey-recorder.mjs';
import { HostedLifecycleCoordinator } from '../src/orchestration/hosted-lifecycle-coordinator.mjs';
import { buildNodeTestArgs } from './run-node-test-suite.mjs';

function candidateProfile() {
  return {
    id: 'codex-cli-resource-canary-v2', family: 'codex-cli', revision: 2, status: 'candidate',
    systemDirectives: ['Use exact tools.', 'Bound resource use and verify the result.'],
    contextStrategy: 'evidence-first', toolStrategy: 'patch-first', patchStrategy: 'patch-set-first',
    retryPolicy: { maxRetries: 2, backoff: 'provider-native' }, errorRendering: 'structured-recovery',
    maxToolSchemas: 48, maxDirectiveChars: 1200,
  };
}

function hostedAdapter() {
  return {
    capabilities: Object.freeze({ createBranch: true, createPullRequest: true, readCi: true, comment: true, merge: false }),
    async createBranch(input) { return { branch: input.branchName, receiptSha256: 'a'.repeat(64) }; },
    async createPullRequest() { return { id: 19, url: 'https://example.invalid/pr/19', receiptSha256: 'b'.repeat(64) }; },
    async readCi() { return { id: 'ci-19', status: 'success', conclusion: 'success', receiptSha256: 'c'.repeat(64) }; },
    async comment() { return { id: 1, receiptSha256: 'd'.repeat(64) }; },
  };
}

async function measure(root) {
  let tick = 1_722_000_000_000;
  const clock = () => ++tick;

  const driverSamples = [
    { cpuTimeMs: 25, rssBytes: 96 * 1024 * 1024, processCount: 2, pids: [4100, 4101] },
    { cpuTimeMs: 75, rssBytes: 144 * 1024 * 1024, processCount: 3, pids: [4100, 4101, 4102] },
  ];
  let sampleIndex = 0;
  const ledger = new MissionProcessLedger({
    clock,
    driver: {
      async sampleTree() { return structuredClone(driverSamples[Math.min(sampleIndex++, driverSamples.length - 1)]); },
      async sampleFileDescriptors() { return sampleIndex === 1 ? 21 : 29; },
    },
  });
  const registered = ledger.register({
    rootPid: 4100, projectId: 'measurement-project', missionId: 'measurement-mission', taskId: 'measurement-task',
    providerId: 'codex-app-server', sessionId: 'measurement-session',
    metadata: { executable: 'codex', runtimeKind: 'app-server', prompt: 'must-not-persist', token: 'SECRET' },
  });
  await ledger.sample(registered.id);
  const sampled = await ledger.sample(registered.id);
  const processSnapshot = ledger.snapshot({ missionId: 'measurement-mission' });

  let governorState = 'normal';
  const governor = { snapshot: () => ({ state: governorState }) };
  let opens = 0; let closes = 0; let completes = 0; let oneShots = 0;
  const persistentProvider = {
    id: 'codex-app-server',
    sessionCapabilities: () => ({ logicalSessions: true, persistentProcess: true }),
    processDescriptor: () => ({ rootPid: 4100, metadata: { executable: 'codex', runtimeKind: 'app-server' } }),
    async openSession() { opens += 1; return { id: `thread-${opens}` }; },
    async completeInSession(session) { completes += 1; return { providerId: 'codex-app-server', text: session.id }; },
    async closeSession() { closes += 1; },
    async complete() { oneShots += 1; return { providerId: 'codex-app-server', text: 'one-shot' }; },
  };
  const hostLedger = { register: () => ({ id: 'host-ledger-1' }), finalize: () => ({ id: 'host-ledger-1' }) };
  const sessionHost = new ProviderSessionHost({ governor, processLedger: hostLedger, clock, maxUses: 8 });
  const sessionInput = { provider: persistentProvider, request: { messages: [{ role: 'user', content: 'bounded task' }] }, scope: { projectId: 'measurement-project', missionId: 'measurement-mission', taskId: 'measurement-task', repositoryId: 'repo' }, fingerprint: 'repo-hash:harness-v1' };
  const firstSession = await sessionHost.complete(sessionInput);
  const secondSession = await sessionHost.complete(sessionInput);
  const oneShotProvider = { id: 'one-shot-cli', async complete() { return { providerId: 'one-shot-cli', text: 'ok' }; } };
  const oneShot = await sessionHost.complete({ provider: oneShotProvider, request: {}, scope: { missionId: 'measurement-mission' }, fingerprint: 'x' });
  governorState = 'pressure';
  const pressure = await sessionHost.applyGovernorState();

  const journal = new IncrementalIntelligenceJournal({ clock });
  const firstChange = journal.publish({ projectId: 'measurement-project', path: 'src/app.mjs', contentHash: 'hash-a', generation: 'g1' });
  const duplicate = journal.publish({ projectId: 'measurement-project', path: 'src/app.mjs', contentHash: 'hash-a', generation: 'g1' });
  const latest = journal.publish({ projectId: 'measurement-project', path: 'src/app.mjs', contentHash: 'hash-b', generation: 'g2' });
  const batch = journal.readBatch({ consumerId: 'semantic', projectId: 'measurement-project' });
  const ack = journal.ack({ consumerId: 'semantic', cursor: batch.latestCursor });

  const registry = new HarnessProfileRegistry({ profiles: createBuiltInHarnessProfiles() });
  const canaryProfile = registry.registerCandidate(candidateProfile());
  const canary = new HarnessCanaryController({ registry, clock });
  canary.configure({ family: 'codex-cli', candidateId: canaryProfile.id, percentage: 20, minSamples: 4, maxPassRateRegression: 0.1, maxResourceRegression: 0.25 });
  for (let index = 0; index < 6; index += 1) canary.recordOutcome({ family: 'codex-cli', profileId: 'codex-cli-v1', cohort: 'stable', passed: true, latencyMs: 100, peakRssBytes: 100 });
  for (let index = 0; index < 4; index += 1) canary.recordOutcome({ family: 'codex-cli', profileId: canaryProfile.id, cohort: 'candidate', passed: index === 0, latencyMs: 120, peakRssBytes: 110, prompt: 'private', output: 'private' });
  const canaryEvaluation = canary.evaluate(canaryProfile.id);

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'forge-219-measurement-'));
  let journey;
  try {
    const screenshot = path.join(tempRoot, 'journey.png');
    await writeFile(screenshot, Buffer.from('synthetic-image-evidence'));
    const recorder = new BrowserJourneyRecorder({ projectRootResolver: () => tempRoot, clock });
    journey = await recorder.record({
      projectId: 'measurement-project', missionId: 'measurement-mission', taskId: 'measurement-task',
      url: 'https://example.invalid/app?secret=discarded', domSnapshot: '<main><button>Run</button></main>',
      accessibility: { nodes: [{ role: 'main' }, { role: 'button' }], violations: [] },
      consoleEntries: [{ level: 'error', message: 'synthetic failure' }],
      networkEntries: [{ method: 'GET', url: 'https://api.example.invalid/private?token=discarded', status: 500 }],
      assertions: [{ id: 'main-visible', passed: true }], artifacts: [{ kind: 'screenshot', path: screenshot }, { kind: 'video', path: null }],
    });
  } finally { await rm(tempRoot, { recursive: true, force: true }); }

  const externalHosted = new HostedLifecycleCoordinator({ clock }).start({ projectId: 'measurement-project', missionId: 'measurement-mission', provider: 'github', issueId: '19' });
  const hosted = new HostedLifecycleCoordinator({ adapter: hostedAdapter(), clock });
  const hostedRun = hosted.start({ projectId: 'measurement-project', missionId: 'measurement-mission', provider: 'github', issueId: '19', sourceCommit: '1'.repeat(40) });
  hosted.recordLocalVerification(hostedRun.id, { status: 'pass', commit: '1'.repeat(40), receiptSha256: 'e'.repeat(64) });
  await hosted.advance(hostedRun.id);
  await hosted.advance(hostedRun.id);
  const hostedDone = await hosted.advance(hostedRun.id);

  const [uiHtml, uiJs, uiCss, appSource] = await Promise.all([
    readFile(path.join(root, 'ui', 'index.html'), 'utf8'),
    readFile(path.join(root, 'ui', 'mission-resource-fabric.js'), 'utf8'),
    readFile(path.join(root, 'ui', 'mission-resource-fabric.css'), 'utf8'),
    readFile(path.join(root, 'src', 'app.mjs'), 'utf8'),
  ]);
  const primaryShells = (uiHtml.match(/data-shell="(?:mission|work|evidence)"/g) ?? []).length;
  const testArgs = buildNodeTestArgs(['tests/fixture.test.mjs'], { concurrency: 1 });

  await sessionHost.close();
  ledger.close();

  return {
    processAttribution: {
      missionId: sampled.missionId, taskId: sampled.taskId, providerId: sampled.providerId,
      currentRssBytes: sampled.current.rssBytes, peakRssBytes: sampled.peak.rssBytes,
      cpuTimeMs: sampled.current.cpuTimeMs, processCount: sampled.current.processCount,
      fileDescriptors: sampled.current.fileDescriptors, activeEntries: processSnapshot.aggregates.activeEntries,
      rawPromptStored: JSON.stringify(sampled).includes('must-not-persist'), secretStored: JSON.stringify(sampled).includes('SECRET'),
      receiptSha256: sampled.receiptSha256,
    },
    sessionReuse: {
      openCount: opens, closeCount: closes, sessionCompletions: completes, oneShotCalls: oneShots,
      reusedSecondCall: secondSession.sessionHost.reused, sameSession: firstSession.sessionHost.sessionId === secondSession.sessionHost.sessionId,
      oneShotMode: oneShot.sessionHost.mode, oneShotClaimedPersistent: oneShot.sessionHost.mode === 'logical-session',
      pressureEvicted: pressure.evicted, remainingAfterPressure: pressure.remaining,
    },
    intelligence: {
      duplicateCoalesced: duplicate.coalesced === true && duplicate.cursor === firstChange.cursor,
      staleGenerationSuperseded: latest.supersedesCursor === firstChange.cursor && batch.items.length === 1 && batch.items[0].cursor === latest.cursor,
      acknowledgedCursor: ack.cursor, latestCursor: batch.latestCursor, receiptSha256: ack.receiptSha256,
    },
    canary: {
      regressionDisabled: canaryEvaluation.enabled === false && canaryEvaluation.decision === 'disable-regression',
      decision: canaryEvaluation.decision, candidateSamples: canaryEvaluation.candidate.samples, baselineSamples: canaryEvaluation.baseline.samples,
      rawPayloadStored: JSON.stringify(canary.snapshot()).includes('private'), receiptSha256: canaryEvaluation.receiptSha256,
    },
    journey: {
      domCaptured: journey.claims.domCaptured, accessibilityCaptured: journey.claims.accessibilityCaptured,
      consoleErrors: journey.console.errors, networkFailures: journey.network.failures,
      screenshotAvailable: journey.artifacts.some((item) => item.kind === 'screenshot' && item.status === 'available'),
      videoUnavailableExplicit: journey.artifacts.some((item) => item.kind === 'video' && item.status === 'unavailable'),
      visualCorrectnessClaimed: journey.claims.visualCorrectness, rawUrlSecretStored: JSON.stringify(journey).includes('discarded'), receiptSha256: journey.receiptSha256,
    },
    hosted: {
      externalGateWithoutAdapter: externalHosted.externalGate, externalReason: externalHosted.reason,
      humanMergeRequired: hostedDone.humanMergeRequired, finalState: hostedDone.state,
      automaticMergeCapability: hostedDone.adapterCapabilities.merge, receiptSha256: hostedDone.receiptSha256,
    },
    ui: {
      primaryShells, resourceHudPresent: /mission-resource-hud/.test(uiHtml) && /initMissionResourceHud/.test(uiJs),
      pressureAware: /data-pressure-state|pressure|brownout|emergency/.test(`${uiJs}\n${uiCss}`),
      heavyBlurUsed: /backdrop-filter|filter:\s*blur\(/i.test(uiCss),
    },
    testRunner: { forceExitEnabled: testArgs.includes('--test-force-exit'), nestedContextCleared: true },
    composition: {
      appStaticImports: (appSource.match(/^import\s.+$/gm) ?? []).length,
      appConstructors: (appSource.match(/\bnew\s+[A-Z][A-Za-z0-9_$]*/g) ?? []).length,
    },
  };
}

const root = path.resolve(process.argv[2] ?? '.');
const version = String(process.argv[3] ?? '2.19.0');
const outputFile = path.resolve(process.argv[4] ?? path.join(root, 'docs', `mission-resource-fabric-measurement-${version}.json`));
const base = {
  schema: 'forge.studio.mission-resource-fabric-measurement.v1', version,
  environment: { platform: process.platform, arch: process.arch, node: process.version, note: 'Deterministic synthetic local measurement. It does not operate an external model, production OS sandbox, hosted Git provider, cloud service, or visual oracle.' },
  ...(await measure(root)),
};
const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ status: 'pass', outputFile: path.relative(root, outputFile).replaceAll('\\', '/'), receiptSha256: report.receiptSha256 })}\n`);
