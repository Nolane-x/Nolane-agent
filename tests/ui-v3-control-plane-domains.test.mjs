import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTROL_PLANE_ROUTES, loadControlPlaneDomain } from '../ui-v3/control-plane/route-registry.mjs';
import { buildOperationsView } from '../ui-v3/control-plane/domains/operations.mjs';
import { createRuntimeView } from '../ui-v3/control-plane/domains/runtime.mjs';
import { buildContextMemoryView } from '../ui-v3/control-plane/domains/context-memory.mjs';
import { buildEvidenceView } from '../ui-v3/control-plane/domains/evidence.mjs';
import { buildIntelligenceView } from '../ui-v3/control-plane/domains/intelligence.mjs';
import { buildTrustSecurityView } from '../ui-v3/control-plane/domains/trust-security.mjs';
import { buildGovernanceView } from '../ui-v3/control-plane/domains/governance.mjs';
import { buildPlatformView, renderPlatformView } from '../ui-v3/control-plane/domains/platform.mjs';

test('Control Plane route registry lazy-loads every approved domain once', async () => {
  assert.deepEqual(Object.keys(CONTROL_PLANE_ROUTES), ['overview','agent-kernel','operations','runtime','context-memory','evidence','intelligence','trust-security','governance','extensions','autonomy','labs','release']);
  const first = await loadControlPlaneDomain('runtime'); const second = await loadControlPlaneDomain('runtime');
  assert.equal(first, second);
  await assert.rejects(() => loadControlPlaneDomain('unknown'), /unknown control plane domain/i);
});

test('Operations exposes mission, agent, queue and recovery summaries with safe actions', () => {
  const value = buildOperationsView({ missions: [{ id: 'm1', status: 'running' }], agents: [{ id: 'a1', missionId: 'm1', status: 'active' }], queues: [{ id: 'q1', pending: 2 }], recoveries: [{ id: 'r1', status: 'available' }] });
  assert.equal(value.missions.length, 1); assert.equal(value.agents[0].actions.includes('stop'), true); assert.equal(value.queues[0].pending, 2); assert.equal(value.recoveries[0].actions.includes('restore'), true);
});

test('Runtime suspends polling and heavy resources when route is hidden', () => {
  let polls = 0; const runtime = createRuntimeView({ poll: () => polls++ });
  runtime.activate(); runtime.tick(); runtime.tick(); runtime.suspend(); runtime.tick();
  const value = runtime.snapshot();
  assert.equal(polls, 2); assert.equal(value.active, false); assert.equal(value.browserSessions.every((item) => item.suspended), true);
});

test('Context and Memory preserve provenance while redacting sensitive content', () => {
  const value = buildContextMemoryView({ context: [{ id: 'c1', content: 'token=secret', sensitive: true, provenance: 'AGENTS.md', confidence: 0.8, scope: 'project', freshness: 'fresh' }], memories: [{ id: 'm1', content: 'Use pnpm', provenance: 'verified-outcome' }] });
  assert.equal(value.context[0].content, '[redacted]'); assert.equal(value.context[0].provenance, 'AGENTS.md'); assert.equal(value.memories[0].actions.includes('delete'), true);
});

test('Evidence defaults to hierarchical timeline and defers raw JSON expansion', () => {
  const value = buildEvidenceView({ events: [{ id: 'e1', phase: 'verify', agentId: 'a1', receiptId: 'r1', raw: { secret: 'x' } }] });
  assert.equal(value.defaultView, 'timeline'); assert.equal(value.events[0].rawLoaded, false); assert.equal('raw' in value.events[0], false); assert.equal(value.filters.includes('receipt'), true);
});

test('Intelligence exposes typed repository facts without background graph animation', () => {
  const value = buildIntelligenceView({ symbols: [{ id: 's1' }], routes: [{ id: 'r1' }], graph: { nodes: [1], edges: [] } });
  assert.equal(value.symbolCount, 1); assert.equal(value.routeCount, 1); assert.equal(value.graph.animation, 'interaction-only'); assert.equal(value.graph.backgroundAnimation, false);
});

test('Trust and Security never expose secret values and keep human and capability labels', () => {
  const value = buildTrustSecurityView({ permissions: [{ label: 'Write project files', capabilityId: 'project:write', state: 'ask' }], secrets: [{ provider: 'github', value: 'ghp-secret', lastUsedAt: 'now' }] });
  assert.equal(value.permissions[0].capabilityId, 'project:write'); assert.equal(value.secrets[0].value, undefined); assert.equal(value.secrets[0].configured, true);
});

test('Governance resolves precedence without treating valid overrides as conflicts', () => {
  const value = buildGovernanceView({ instructions: [{ scope: 'organization', text: 'A' }, { scope: 'project', text: 'B' }, { scope: 'mission', text: 'C' }], conflicts: [{ id: 'x', validOverride: true }] });
  assert.deepEqual(value.instructions.map((item) => item.scope), ['organization','project','mission']); assert.equal(value.conflicts[0].severity, 'info');
});

test('Platform routes separate operational configuration, experiments and release promotion', () => {
  const value = buildPlatformView({ providers: [{ id: 'local' }], skills: [{ id: 's1' }], experiments: [{ id: 'x1', status: 'running' }], release: { version: '5.0.0-alpha.4', signed: false }, foundation: { foundationReady: true, trainedModel: false } });
  assert.equal(value.extensions.providers.length, 1); assert.equal(value.labs.experiments.length, 1); assert.equal(value.release.canPromote, false); assert.equal(value.autonomy.presets.length, 4); assert.equal(value.labs.foundation.label, 'Foundation ready · No trained model');
});

test('application Control Plane route uses the real lazy domain registry', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile('ui-v3/app.mjs', 'utf8');
  assert.match(source, /import\('\.\/control-plane\/route-registry\.mjs'\)/);
  assert.match(source, /loadControlPlaneDomain/);
  assert.doesNotMatch(source, /loader:\s*async\s*\(domain\)\s*=>\s*\(\{ domain, suspend/);
});

test('Platform Labs exposes alpha.5 verified subsystem counts and explicit non-claims', () => {
  const value = buildPlatformView({ foundation: {
    status: { foundationReady: true, trainedModel: false, claims: { frontierParity: false, competitorSuperiority: false, autonomousSelfImprovement: false } },
    distillation: { steps: 4, policies: { router: '2' } }, recursive: { runs: 3 }, symbolic: { solvers: 2 },
    plasticity: { memories: 5, promotedAdapters: 0 }, curriculum: { environments: 1, tasks: 7 }, verifierRedTeam: { probes: 4, rejected: 2 },
  } });
  assert.equal(value.labs.foundation.label, 'Foundation ready · No trained model');
  assert.deepEqual(value.labs.foundation.subsystems, { distillationSteps: 4, recursiveRuns: 3, symbolicSolvers: 2, memories: 5, curriculumTasks: 7, verifierProbes: 4, scientificBenchmarks: 0, astCodemods: 0, smtProofs: 0, datalogEvaluations: 0, distilledPolicies: 0, adaptationContexts: 0, latentExperts: 0 });
  assert.deepEqual(value.labs.foundation.nonClaims, ['autonomous-self-improvement', 'competitor-superiority', 'frontier-parity', 'trained-model']);
  const html = renderPlatformView(value, 'labs');
  assert.match(html, /No trained model/);
  assert.match(html, /4 distillation steps/);
  assert.match(html, /Non-claims: autonomous-self-improvement, competitor-superiority, frontier-parity, trained-model/);
});
