import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { HarnessProfileRegistry, createBuiltInHarnessProfiles } from '../src/providers/harness-profile-registry.mjs';
import { HarnessRequestComposer } from '../src/providers/harness-request-composer.mjs';
import { classifyHarnessFailure } from '../src/providers/harness-failure-classifier.mjs';
import { HarnessFailureStore } from '../src/providers/harness-failure-store.mjs';
import { HarnessExperimentService } from '../src/providers/harness-experiment-service.mjs';

const suite = Object.freeze({
  id: 'adaptive-harness-release-replay',
  cases: Object.freeze([
    Object.freeze({ id: 'critical-tool-schema', critical: true, assertions: { state: 'awaiting-verification', maxToolCalls: 8 } }),
    Object.freeze({ id: 'bounded-patch', assertions: { state: 'awaiting-verification', maxToolCalls: 8 } }),
    Object.freeze({ id: 'retry-recovery', assertions: { state: 'awaiting-verification', maxToolCalls: 8 } }),
    Object.freeze({ id: 'compact-context', assertions: { state: 'awaiting-verification', maxToolCalls: 8 } }),
  ]),
});

function candidate(id, revision, directives) {
  return {
    id,
    family: 'codex-cli',
    revision,
    status: 'candidate',
    systemDirectives: directives,
    contextStrategy: 'evidence-first',
    toolStrategy: 'patch-first',
    patchStrategy: 'patch-set-first',
    retryPolicy: { maxRetries: 2, backoff: 'bounded-exponential' },
    errorRendering: 'classified-actionable',
    maxToolSchemas: 48,
    maxDirectiveChars: 1400,
  };
}

async function measure() {
  const events = [];
  const registry = new HarnessProfileRegistry({ profiles: createBuiltInHarnessProfiles(), eventSink: (event) => events.push(event) });
  const composer = new HarnessRequestComposer({ registry });
  const tools = [
    { type: 'function', function: { name: 'fs.patchSet', description: 'Patch files', parameters: { type: 'object', properties: { patches: { type: 'array' } }, required: ['patches'] } } },
    { type: 'function', function: { name: 'fs.read', description: 'Read file', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
    { type: 'function', function: { name: 'process.run', description: 'Run process', parameters: { type: 'object', properties: { executable: { type: 'string' } }, required: ['executable'] } } },
  ];
  const messages = [{ role: 'system', content: 'Operate through Forge Studio governance.' }, { role: 'user', content: 'Apply one bounded correction.' }];
  const providers = [
    { id: 'codex', harnessFamily: 'codex-cli' },
    { id: 'claude', harnessFamily: 'claude-code' },
    { id: 'gemini', harnessFamily: 'gemini-cli' },
  ];
  const compositions = providers.map((provider) => composer.compose({ provider, messages, tools, task: { role: 'executor', metadata: { taskKind: 'release-measurement' } } }));
  const distinctProfiles = new Set(compositions.map((item) => item.profileId)).size;
  const distinctSystemMessages = new Set(compositions.map((item) => item.messages[0].content)).size;
  const schemaPreserved = compositions.every((item) => item.tools.some((tool) => tool.function.name === 'fs.patchSet' && canonicalSha256(tool.function.parameters) === canonicalSha256(tools[0].function.parameters)));

  const store = new HarnessFailureStore({ file: ':memory:' });
  let rawPromptStored = true;
  let modelOutputStored = true;
  const classified = classifyHarnessFailure(Object.assign(new Error('429 rate limit reached'), { code: 'HTTP_429' }), { providerId: 'codex', profileId: compositions[0].profileId });
  const telemetry = {
    providerId: 'codex', harnessFamily: 'codex-cli', profileId: compositions[0].profileId, profileRevision: compositions[0].profileRevision,
    taskKind: 'release-measurement', failureClass: classified.class, retryable: classified.retryable, fingerprint: classified.fingerprint,
    missionId: 'measurement-mission', taskId: 'measurement-task', evidenceReceiptSha256: compositions[0].receiptSha256, occurredAt: 1_722_000_000_000,
  };
  try { store.record({ ...telemetry, rawPrompt: 'must-not-persist' }); } catch { rawPromptStored = false; }
  try { store.record({ ...telemetry, modelOutput: 'must-not-persist' }); } catch { modelOutputStored = false; }
  store.record(telemetry);
  const failureSummary = store.summary();
  store.close();

  const baseline = registry.resolve({ harnessFamily: 'codex-cli' });
  const weak = registry.registerCandidate(candidate('codex-cli-release-weak-v2', 2, ['Use exact tools.', 'Repeat the current plan.']));
  const strong = registry.registerCandidate(candidate('codex-cli-release-strong-v3', 3, ['Use exact tools.', 'Minimize retries, tool calls, and repeated context.']));
  let tick = 0;
  const experiments = new HarnessExperimentService({ clock: () => ++tick, minImprovement: 0.01 });
  const weakReport = await experiments.compare({
    family: 'codex-cli', baseline, candidate: weak, suite,
    executor: async ({ profile, evalCase }) => ({
      state: profile.id === weak.id && evalCase.id === 'critical-tool-schema' ? 'failed' : 'awaiting-verification',
      output: profile.id, toolCalls: 3, retries: 1, estimatedTokens: 240, evidence: [],
    }),
  });
  const strongReport = await experiments.compare({
    family: 'codex-cli', baseline, candidate: strong, suite,
    executor: async ({ profile }) => ({
      state: 'awaiting-verification', output: profile.id,
      toolCalls: profile.id === baseline.id ? 6 : 2,
      retries: profile.id === baseline.id ? 1 : 0,
      estimatedTokens: profile.id === baseline.id ? 500 : 120,
      evidence: [],
    }),
  });
  let rejectedCandidates = 0;
  try { registry.promote({ family: 'codex-cli', candidateId: weak.id, report: weakReport, actor: 'release-measurement' }); }
  catch { rejectedCandidates += 1; }
  const promotion = registry.promote({ family: 'codex-cli', candidateId: strong.id, report: strongReport, actor: 'release-measurement' });
  const rollback = registry.rollback({ family: 'codex-cli', actor: 'release-measurement' });

  return Object.freeze({
    distinctProfiles,
    distinctSystemMessages,
    compositionReceipts: compositions.filter((item) => /^[a-f0-9]{64}$/.test(item.receiptSha256)).length,
    schemaPreserved,
    failureClass: classified.class,
    failureEvents: failureSummary.total,
    rawPromptStored,
    modelOutputStored,
    rejectedCandidates,
    promotions: events.filter((event) => event.type === 'harness.profile.promoted').length,
    rollbacks: events.filter((event) => event.type === 'harness.profile.rolled-back').length,
    weakPromotable: weakReport.promotable,
    strongPromotable: strongReport.promotable,
    promotionReceiptSha256: promotion.receiptSha256,
    rollbackReceiptSha256: rollback.receiptSha256,
  });
}

const root = path.resolve(process.argv[2] ?? '.');
const version = String(process.argv[3] ?? '2.19.0');
const outputFile = path.resolve(process.argv[4] ?? path.join(root, 'docs', `adaptive-harness-lab-measurement-${version}.json`));
const base = {
  schema: 'forge.studio.adaptive-harness-lab-measurement.v1',
  version,
  environment: { platform: process.platform, arch: process.arch, node: process.version, note: 'Synthetic local harness composition and replay measurement; no external model, production prompt, browser, cloud service, or hosted worker was invoked.' },
  ...(await measure()),
};
const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ status: 'pass', outputFile: path.relative(root, outputFile).replaceAll('\\', '/'), receiptSha256: report.receiptSha256 })}\n`);
