import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NolaneNativeOrchestrationService } from '../src/nolane-native/orchestration-service.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-orchestration-contract-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const skillsRoot = path.join(root, 'skills');
  await mkdir(path.join(skillsRoot, 'inspect'), { recursive: true });
  await writeFile(path.join(skillsRoot, 'inspect', 'SKILL.md'), '# Inspect\nRead repository evidence.');
  await writeFile(path.join(skillsRoot, 'inspect', 'skill.json'), JSON.stringify({ schema: 'nolane.agent.skill.v1', id: 'inspect', title: 'Inspect', entrypoint: 'SKILL.md', capabilities: ['repo:read'] }));
  const service = new NolaneNativeOrchestrationService({ dataDir: root, skillRoots: [skillsRoot], clock: () => 1000 });
  await service.open();
  return service;
}

test('orchestration contract wires skills delegations gateways scheduling messaging plugins and trajectory export', async (t) => {
  const service = await fixture(t);
  assert.deepEqual((await service.listSkills()).map((item) => item.id), ['inspect']);
  assert.match((await service.loadSkill('inspect', { grantedCapabilities: ['repo:read'] })).receiptSha256, /^[a-f0-9]{64}$/);
  const child = service.spawnSubagent({ missionId: 'm1', parentAgentId: 'root', agentId: 'child', objective: 'Inspect', parentCapabilities: ['repo:read'], delegatedCapabilities: ['repo:read'], allowedPaths: ['src/**'] });
  assert.equal(child.status, 'running');
  assert.match(service.completeSubagent('child', { summary: 'done', evidence: [{ receiptSha256: 'a'.repeat(64) }], verified: true }).handoffSha256, /^[a-f0-9]{64}$/);
  assert.equal((await service.startGateway()).status, 'running');
  assert.match((await service.sendMessage({ channel: 'mission:m1', text: 'ready' })).externalId, /^local-/);
  await service.schedule({ id: 'job', runAt: 900, task: { type: 'noop', payload: {} } });
  assert.equal((await service.runDue()).length, 1);
  const trajectory = await service.appendTrajectory({ episodeId: 'e1', step: 1, state: { missionId: 'm1' }, action: { type: 'inspect' }, effect: { status: 'pass' }, verifier: { valid: true, receiptSha256: 'b'.repeat(64) } });
  assert.match(trajectory.recordSha256, /^[a-f0-9]{64}$/);
});

test('orchestration contract rejects capability escalation unverified handoff unknown skills and invalid trajectories', async (t) => {
  const service = await fixture(t);
  await assert.rejects(() => service.loadSkill('inspect', { grantedCapabilities: [] }), /capabilit/i);
  assert.throws(() => service.spawnSubagent({ missionId: 'm1', parentAgentId: 'root', agentId: 'child', objective: 'Escalate', parentCapabilities: ['repo:read'], delegatedCapabilities: ['repo:write'], allowedPaths: ['src/**'] }), /capabilit|delegat|scope/i);
  const child = service.spawnSubagent({ missionId: 'm1', parentAgentId: 'root', agentId: 'safe-child', objective: 'Inspect', parentCapabilities: ['repo:read'], delegatedCapabilities: ['repo:read'], allowedPaths: ['src/**'] });
  assert.equal(child.status, 'running');
  assert.throws(() => service.completeSubagent('safe-child', { summary: 'unsupported', evidence: [], verified: false }), /verified|evidence/i);
  await assert.rejects(() => service.appendTrajectory({ episodeId: 'e2', step: 1, state: {}, action: {}, effect: {}, verifier: { valid: false } }), /verifier|valid/i);
});
