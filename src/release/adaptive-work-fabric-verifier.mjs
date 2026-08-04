import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const REQUIRED = Object.freeze([
  'src/runtime/runtime-lease-pool.mjs',
  'src/providers/provider-registry.mjs',
  'src/browser/browser-agent-service.mjs',
  'src/repository/repository-intelligence-scheduler.mjs',
  'src/repository/adaptive-repository-intelligence.mjs',
  'src/repository/repository-intelligence-fabric.mjs',
  'src/repository/codebase-knowledge-watcher.mjs',
  'src/agents/subagent-orchestrator.mjs',
  'src/agent/operating-plane-tool-gateway.mjs',
  'src/app.mjs',
  'tests/runtime-lease-pool.test.mjs',
  'tests/provider-runtime-pool.test.mjs',
  'tests/browser-runtime-pool.test.mjs',
  'tests/repository-intelligence-scheduler.test.mjs',
  'tests/repository-intelligence-scheduler-wiring.test.mjs',
  'tests/subagent-adaptive-graph.test.mjs',
  'tests/agent-operating-plane-adaptive-graph.test.mjs',
  'tests/adaptive-work-fabric-release-gate.test.mjs',
  'scripts/measure-adaptive-work-fabric.mjs',
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

export async function verifyAdaptiveWorkFabric({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory);
  const releaseVersion = String(version ?? '').trim();
  const failures = [];
  const contents = new Map();
  for (const relative of REQUIRED) contents.set(relative, await source(root, relative, failures));
  const lease = contents.get('src/runtime/runtime-lease-pool.mjs') ?? '';
  const providers = contents.get('src/providers/provider-registry.mjs') ?? '';
  const browser = contents.get('src/browser/browser-agent-service.mjs') ?? '';
  const scheduler = contents.get('src/repository/repository-intelligence-scheduler.mjs') ?? '';
  const intelligence = contents.get('src/repository/adaptive-repository-intelligence.mjs') ?? '';
  const watcher = contents.get('src/repository/codebase-knowledge-watcher.mjs') ?? '';
  const repositoryFabric = contents.get('src/repository/repository-intelligence-fabric.mjs') ?? '';
  const subagents = contents.get('src/agents/subagent-orchestrator.mjs') ?? '';
  const operating = contents.get('src/agent/operating-plane-tool-gateway.mjs') ?? '';
  const app = contents.get('src/app.mjs') ?? '';
  const matrix = contents.get('src/release/full-release-matrix.mjs') ?? '';

  requirePattern(lease, /(?=[\s\S]*missionId)(?=[\s\S]*taskId)(?=[\s\S]*runtime-lease\.queued)(?=[\s\S]*RUNTIME_LEASE_ADMISSION_BLOCKED)(?=[\s\S]*maxPerKey)/, 'attributed pressure-aware runtime leases', failures);
  requirePattern(providers, /(?=[\s\S]*executionPool)(?=[\s\S]*complete)(?=[\s\S]*leaseContext)(?=[\s\S]*(?:executionPool|pool)\.run)/, 'provider completion admission through lease pool', failures);
  requirePattern(browser, /(?=[\s\S]*leasePool)(?=[\s\S]*action)(?=[\s\S]*missionId)(?=[\s\S]*this\.leasePool\.run)/, 'project browser action admission through lease pool', failures);
  requirePattern(scheduler, /(?=[\s\S]*interactive:\s*400)(?=[\s\S]*repository-index\.coalesced)(?=[\s\S]*repository-index\.stale-cancelled)(?=[\s\S]*semantic-on-demand)(?=[\s\S]*activeProjects)/, 'shared priority repository intelligence scheduler', failures);
  requirePattern(intelligence, /(?=[\s\S]*this\.scheduler)(?=[\s\S]*scheduler\.enqueue)(?=[\s\S]*forge\.adaptive-repository-index\.v1)/, 'adaptive repository intelligence scheduler delegation', failures);
  requirePattern(watcher, /(?=[\s\S]*scheduler)(?=[\s\S]*priority:\s*'watcher')(?=[\s\S]*portable-repository-watcher)/, 'watcher enqueue into shared scheduler', failures);
  requirePattern(subagents, /(?=[\s\S]*runAdaptiveGraph)(?=[\s\S]*jobs-added)(?=[\s\S]*jobs-revised)(?=[\s\S]*jobs-revoked)(?=[\s\S]*ownership-serialized)(?=[\s\S]*confidence-below-threshold)(?=[\s\S]*SUBAGENT_JOB_ATTEMPTS_EXHAUSTED)/, 'mutable receipt-backed subagent graph', failures);
  requirePattern(operating, /(?=[\s\S]*'agent\.runGraph')(?=[\s\S]*maxItems:\s*64)(?=[\s\S]*runAdaptiveGraph)/, 'explicit bounded adaptive graph tool', failures);
  requirePattern(app, /(?=[\s\S]*providerRuntimePool)(?=[\s\S]*browserRuntimePool)(?=[\s\S]*repositoryIntelligenceFabric)(?=[\s\S]*governor:\s*resourceGovernor)(?=[\s\S]*runAdaptiveGraph)(?=[\s\S]*repositoryIntelligenceFabric\.close)/, 'application work fabric lifecycle wiring', failures);
  requirePattern(repositoryFabric, /(?=[\s\S]*RepositoryIntelligenceScheduler)(?=[\s\S]*AdaptiveRepositoryIntelligence)(?=[\s\S]*CodebaseKnowledgeWatcher)(?=[\s\S]*scheduler\.close)/, 'repository scheduler lifecycle behind intelligence fabric', failures);
  requirePattern(matrix, /id:\s*'adaptive-work-fabric'[\s\S]*verify-adaptive-work-fabric\.mjs/, 'required adaptive work fabric matrix gate', failures);

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
  try { measurement = JSON.parse(await readFile(path.join(root, 'docs', `adaptive-work-fabric-measurement-${releaseVersion}.json`), 'utf8')); }
  catch { failures.push(`missing or invalid adaptive work fabric measurement for ${releaseVersion}`); }
  if (measurement) {
    if (!(measurement.provider?.peakActive > 0 && measurement.provider.peakActive <= measurement.provider.limit)) failures.push('provider peak concurrency measurement is invalid');
    if (!(measurement.provider?.queuedEvents >= 1)) failures.push('provider queueing was not measured');
    if (measurement.repository?.runnerCalls !== 1) failures.push('repository duplicate request did not coalesce to one runner call');
    if (!(measurement.repository?.coalescedRequests >= 1)) failures.push('repository coalescing receipt missing');
    if (!(measurement.repository?.staleCancelled >= 1)) failures.push('repository stale cancellation receipt missing');
    for (const key of ['added', 'revised', 'revoked']) if (!(measurement.swarm?.[key] >= 1)) failures.push(`swarm ${key} mutation was not measured`);
    const receipt = measurement.receiptSha256;
    const base = { ...measurement }; delete base.receiptSha256;
    if (!/^[a-f0-9]{64}$/.test(String(receipt ?? '')) || canonicalSha256(base) !== receipt) failures.push('adaptive work fabric measurement receipt is invalid');
  }

  const limitations = await source(root, `docs/LIMITATIONS-${releaseVersion}.md`, failures);
  for (const [pattern, label] of [
    [/one-shot.*CLI.*(?:not|does not).*persistent|does not make one-shot.*CLI.*persistent/i, 'one-shot provider process non-claim'],
    [/logical.*(?:lease|session).*(?:does not|do not).*operating-system.*contain/i, 'OS containment non-claim'],
    [/dynamic.*reconciliation.*(?:does not|do not).*semantic correctness/i, 'semantic correctness non-claim'],
    [/(?:does not make incremental indexing fully polyglot|incremental indexing.*fully polyglot)/i, 'polyglot parity non-claim'],
    [/does not certify Windows production/i, 'platform certification non-claim'],
  ]) requirePattern(limitations, pattern, label, failures);

  const boundaries = Object.freeze({ persistentOneShotCliHostClaimed: false, semanticMergeCorrectnessClaimed: false, osProcessTreeContainmentCertified: false, fullPolyglotParityClaimed: false, windowsProductionCertified: false });
  const metrics = Object.freeze({ appStaticImports, appConstructors });
  const base = { schema: 'forge.adaptive-work-fabric-verification.v1', version: releaseVersion, status: failures.length ? 'fail' : 'pass', auditCounts, measurement, metrics, boundaries, failures: Object.freeze(failures) };
  const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  if (outputFile) { await mkdir(path.dirname(path.resolve(outputFile)), { recursive: true }); await writeFile(path.resolve(outputFile), `${JSON.stringify(report, null, 2)}\n`); }
  if (failures.length) { const error = new Error(`Adaptive work fabric verification failed with ${failures.length} issue(s)`); error.code = 'ADAPTIVE_WORK_FABRIC_VERIFICATION_FAILED'; error.report = report; throw error; }
  return report;
}
