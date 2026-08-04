import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NolaneSkillRegistry } from '../src/nolane-native/skill-registry.mjs';
import { NolaneSubagentManager } from '../src/nolane-native/subagent-manager.mjs';
import { NolaneGatewayRegistry } from '../src/nolane-native/gateway-registry.mjs';
import { NolanePluginHost } from '../src/nolane-native/plugin-host.mjs';
import { NolaneDurableScheduler } from '../src/nolane-native/durable-scheduler.mjs';
import { NolaneTrajectoryStore } from '../src/nolane-native/trajectory-store.mjs';

test('skill registry discovers signed manifests and loads instructions progressively', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-skills-'));
  try {
    await mkdir(path.join(root, 'repair-provider'), { recursive: true });
    await writeFile(path.join(root, 'repair-provider', 'SKILL.md'), '# Repair Provider\nRun focused tests first.');
    await writeFile(path.join(root, 'repair-provider', 'skill.json'), JSON.stringify({ schema: 'nolane.agent.skill.v1', id: 'repair-provider', title: 'Repair Provider', entrypoint: 'SKILL.md', capabilities: ['repo:read','test:run'] }));
    const registry = new NolaneSkillRegistry({ roots: [root] });
    const listed = await registry.discover();
    assert.deepEqual(listed.map((item) => item.id), ['repair-provider']);
    assert.equal(listed[0].contentLoaded, false);
    const loaded = await registry.load('repair-provider', { grantedCapabilities: ['repo:read','test:run'] });
    assert.match(loaded.content, /focused tests/);
    assert.match(loaded.receiptSha256, /^[a-f0-9]{64}$/);
    await assert.rejects(() => registry.load('repair-provider', { grantedCapabilities: ['repo:read'] }), /capability/i);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('subagent manager restricts delegated authority and binds verified handoffs', async () => {
  const manager = new NolaneSubagentManager({ maxChildrenPerMission: 2 });
  const child = manager.spawn({ missionId: 'm1', parentAgentId: 'root', agentId: 'child-1', objective: 'Inspect tests', parentCapabilities: ['repo:read','test:run'], delegatedCapabilities: ['repo:read'], allowedPaths: ['tests/**'] });
  assert.deepEqual(child.capabilities, ['repo:read']);
  await assert.rejects(async () => manager.spawn({ missionId: 'm1', parentAgentId: 'root', agentId: 'bad', objective: 'bad', parentCapabilities: ['repo:read'], delegatedCapabilities: ['shell:execute'] }), /authority/i);
  const handoff = manager.complete('child-1', { summary: 'Found retry gap', evidence: [{ receiptSha256: 'a'.repeat(64) }], verified: true });
  assert.match(handoff.handoffSha256, /^[a-f0-9]{64}$/);
  assert.equal(manager.get('child-1').status, 'completed');
  manager.cancelMission('m1', { reason: 'mission-cancelled' });
});

test('gateway registry starts and stops isolated platform adapters with capability probes', async () => {
  const events = [];
  const registry = new NolaneGatewayRegistry();
  registry.register({ id: 'local-chat', platform: 'local', capabilities: ['message:send'], async probe() { return { ready: true }; }, async start() { events.push('start'); }, async stop() { events.push('stop'); } });
  assert.equal((await registry.probe('local-chat')).ready, true);
  assert.equal((await registry.start('local-chat')).status, 'running');
  assert.equal(registry.status('local-chat').platform, 'local');
  assert.equal((await registry.stop('local-chat')).status, 'stopped');
  assert.deepEqual(events, ['start','stop']);
});

test('plugin host quarantines dangerous hooks and exposes messaging only through typed adapters', async () => {
  const host = new NolanePluginHost({ allowedCapabilities: ['message:send','event:read'] });
  const dangerous = host.install({ id: 'bad', kind: 'messaging', capabilities: ['shell:execute'], hooks: [{ event: 'beforeSend', command: 'rm -rf /' }] });
  assert.equal(dangerous.status, 'quarantined');
  const sent = [];
  const safe = host.install({ id: 'local-messages', kind: 'messaging', capabilities: ['message:send'], adapter: { async send(message) { sent.push(message); return { externalId: 'x1' }; } } });
  assert.equal(safe.status, 'installed');
  host.activate('local-messages');
  const result = await host.send('local-messages', { channel: 'local', text: 'hello', metadata: { missionId: 'm1' } });
  assert.equal(result.externalId, 'x1');
  assert.equal(sent[0].text, 'hello');
});

test('durable scheduler persists jobs, prevents duplicate execution and recovers after restart', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-jobs-'));
  try {
    const first = new NolaneDurableScheduler({ file: path.join(root, 'jobs.json'), clock: () => 1_000 });
    await first.open();
    await first.schedule({ id: 'j1', runAt: 900, task: { type: 'benchmark', payload: { suite: 'smoke' } } });
    const runs = [];
    assert.equal((await first.runDue(async (job) => { runs.push(job.id); return { receiptSha256: 'b'.repeat(64) }; })).length, 1);
    assert.equal((await first.runDue(async () => { throw new Error('must not rerun'); })).length, 0);
    const second = new NolaneDurableScheduler({ file: path.join(root, 'jobs.json'), clock: () => 1_000 });
    await second.open();
    assert.equal(second.get('j1').status, 'completed');
    assert.deepEqual(runs, ['j1']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('trajectory store accepts only verified public state-action-effect records and exports deterministic JSONL', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-trajectories-'));
  try {
    const store = new NolaneTrajectoryStore({ file: path.join(root, 'trajectories.jsonl') });
    await assert.rejects(() => store.append({ episodeId: 'e0', state: {}, action: {}, effect: {}, verifier: { valid: false } }), /verified/i);
    await assert.rejects(() => store.append({ episodeId: 'e0', chainOfThought: 'secret', state: {}, action: {}, effect: {}, verifier: { valid: true, receiptSha256: 'c'.repeat(64) } }), /chain-of-thought/i);
    const record = await store.append({ episodeId: 'e1', step: 1, state: { taskType: 'bug-fix' }, action: { type: 'test' }, effect: { passed: true }, verifier: { valid: true, receiptSha256: 'c'.repeat(64) }, provenance: { repositorySha: 'd'.repeat(40) } });
    assert.match(record.recordSha256, /^[a-f0-9]{64}$/);
    const exported = await store.export({ outputFile: path.join(root, 'export.jsonl') });
    assert.equal(exported.records, 1);
    assert.match(await readFile(path.join(root, 'export.jsonl'), 'utf8'), /"episodeId":"e1"/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
