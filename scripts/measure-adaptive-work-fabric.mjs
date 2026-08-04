import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { RuntimeLeasePool } from '../src/runtime/runtime-lease-pool.mjs';
import { RepositoryIntelligenceScheduler } from '../src/repository/repository-intelligence-scheduler.mjs';
import { SubagentOrchestrator } from '../src/agents/subagent-orchestrator.mjs';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const governor = (state = 'normal', policy = {}) => ({ snapshot: () => ({ state, policy: { maxActiveAgents: 2, semanticIndexing: 'incremental', ...policy } }) });
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

async function measureProvider() {
  const events = [];
  const pool = new RuntimeLeasePool({ kind: 'provider', governor: governor('normal', { maxActiveAgents: 2 }), policyKey: 'maxActiveAgents', maxPerKey: 2, eventSink: (event) => events.push(event) });
  let active = 0;
  let peakActive = 0;
  const queueDelays = [];
  await Promise.all(Array.from({ length: 5 }, (_, index) => pool.run({ key: index % 2 ? 'claude' : 'codex', missionId: `m${index}`, taskId: `t${index}` }, async (lease) => {
    active += 1;
    peakActive = Math.max(peakActive, active);
    queueDelays.push(lease.queueDelayMs);
    await delay(20);
    active -= 1;
  })));
  const snapshot = pool.snapshot();
  pool.close();
  return Object.freeze({
    limit: 2,
    requests: 5,
    peakActive,
    queuedEvents: events.filter((event) => event.type === 'runtime-lease.queued').length,
    attributedAcquisitions: events.filter((event) => event.type === 'runtime-lease.acquired' && event.missionId && event.taskId).length,
    maxQueueDelayMs: Math.max(...queueDelays),
    finalActive: snapshot.active,
    finalQueued: snapshot.queued,
  });
}

async function measureRepository() {
  const gate = deferred();
  let runnerCalls = 0;
  const coalescing = new RepositoryIntelligenceScheduler({
    governor: governor(), maxWorkers: 1,
    runners: { lexical: async () => { runnerCalls += 1; await gate.promise; return { indexed: 1 }; } },
  });
  const first = coalescing.enqueue({ project: { id: 'repo-coalesce' }, generation: 'g1', stages: ['lexical'], priority: 'mission' });
  const second = coalescing.enqueue({ project: { id: 'repo-coalesce' }, generation: 'g1', stages: ['lexical'], priority: 'mission' });
  while (coalescing.snapshot().active !== 1) await delay(1);
  gate.resolve();
  await Promise.all([first, second]);
  const coalescedRequests = coalescing.snapshot().journal.filter((event) => event.type === 'repository-index.coalesced').length;
  coalescing.close();

  const blocker = deferred();
  const staleScheduler = new RepositoryIntelligenceScheduler({
    governor: governor(), maxWorkers: 1,
    runners: { lexical: async (project) => { if (project.id === 'blocker') await blocker.promise; return { projectId: project.id }; } },
  });
  const active = staleScheduler.enqueue({ project: { id: 'blocker' }, generation: 'g1', stages: ['lexical'] });
  while (staleScheduler.snapshot().active !== 1) await delay(1);
  const stale = staleScheduler.enqueue({ project: { id: 'repo-stale' }, generation: 'old', stages: ['lexical'], priority: 'background' });
  const staleOutcome = stale.catch((error) => error?.code ?? 'unknown');
  const fresh = staleScheduler.enqueue({ project: { id: 'repo-stale' }, generation: 'new', stages: ['lexical'], priority: 'interactive' });
  blocker.resolve();
  await active;
  await fresh;
  await staleOutcome;
  const staleCancelled = staleScheduler.snapshot().journal.filter((event) => event.type === 'repository-index.stale-cancelled').length;
  staleScheduler.close();
  return Object.freeze({ runnerCalls, duplicateRequests: 2, coalescedRequests, staleCancelled });
}

async function measureSwarm() {
  const profile = { id: 'worker', description: 'measurement worker', prompt: '', tools: [], exclusiveTools: [], mcpServers: [], skills: [], capabilities: [], maxTurns: 4, budgetTokens: 1000, allowChildAgents: false, sandboxProfile: 'workspace' };
  const parentTask = { id: 'parent', projectId: 'p1', allowedTools: [], allowedMcpServers: [], allowedSkills: [], permissions: ['agent.create'], maxTurns: 4, budgetTokens: 1000 };
  const events = [];
  const orchestrator = new SubagentOrchestrator({
    profiles: [profile], maxConcurrency: 1, governor: governor(), eventSink: (event) => events.push(event),
    runner: async (child) => ({ summary: child.objective, receipts: [] }),
  });
  const result = await orchestrator.runAdaptiveGraph({
    parentTask,
    jobs: [
      { id: 'seed', profileId: 'worker', objective: 'seed' },
      { id: 'revise', profileId: 'worker', objective: 'old', dependencies: ['seed'] },
      { id: 'revoke', profileId: 'worker', objective: 'remove', dependencies: ['seed'] },
    ],
    reconcile: async ({ revision }) => revision === 1 ? {
      add: [{ id: 'add', profileId: 'worker', objective: 'added', dependencies: ['seed'] }],
      revise: [{ id: 'revise', objective: 'revised', ownedSymbols: ['Measured.symbol'] }],
      revoke: ['revoke'], reason: 'measurement mutation',
    } : {},
  });
  const count = (type) => events.filter((event) => event.type === type).length;
  return Object.freeze({
    completed: result.completed.length,
    stopped: result.stopped.length,
    waves: result.waves,
    revisions: result.revisions,
    added: count('subagent.graph.jobs-added'),
    revised: count('subagent.graph.jobs-revised'),
    revoked: count('subagent.graph.jobs-revoked'),
    mutationReceipts: result.mutations.filter((event) => /^[a-f0-9]{64}$/.test(event.receiptSha256)).length,
  });
}

const root = path.resolve(process.argv[2] ?? '.');
const version = String(process.argv[3] ?? '2.19.0');
const outputFile = path.resolve(process.argv[4] ?? path.join(root, 'docs', `adaptive-work-fabric-measurement-${version}.json`));
const base = {
  schema: 'forge.studio.adaptive-work-fabric-measurement.v1',
  version,
  environment: { platform: process.platform, arch: process.arch, node: process.version, note: 'Synthetic local scheduling measurement; no external provider, browser, cloud, or hosted worker was invoked.' },
  provider: await measureProvider(),
  repository: await measureRepository(),
  swarm: await measureSwarm(),
};
const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ status: 'pass', outputFile: path.relative(root, outputFile).replaceAll('\\', '/'), receiptSha256: report.receiptSha256 })}\n`);
