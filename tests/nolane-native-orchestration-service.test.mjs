import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NolaneNativeOrchestrationService } from '../src/nolane-native/orchestration-service.mjs';

test('orchestration service production-wires skills, scoped subagents, gateway, messaging, scheduler and trajectories', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-orchestration-service-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const skillsRoot = path.join(root, 'skills');
  await mkdir(path.join(skillsRoot, 'repair'), { recursive: true });
  await writeFile(path.join(skillsRoot, 'repair', 'SKILL.md'), '# Repair\nRun focused tests.');
  await writeFile(path.join(skillsRoot, 'repair', 'skill.json'), JSON.stringify({ schema: 'nolane.agent.skill.v1', id: 'repair', title: 'Repair', entrypoint: 'SKILL.md', capabilities: ['repo:read'] }));
  const events = [];
  const service = new NolaneNativeOrchestrationService({ dataDir: root, skillRoots: [skillsRoot], clock: () => 1000, eventSink: (event) => events.push(event) });
  await service.open();
  assert.deepEqual((await service.listSkills()).map((item) => item.id), ['repair']);
  const localCatalog = await service.skillCatalog({ source: 'nolane', catalog: 'local', limit: 20 });
  assert.equal(localCatalog.counts.total, 1);
  assert.equal(localCatalog.counts.bySource.nolane, 1);
  assert.equal(localCatalog.counts.byCatalog.local, 1);
  assert.deepEqual(localCatalog.skills.map((skill) => ({ id: skill.id, source: skill.source, catalog: skill.catalog })), [{ id: 'repair', source: 'nolane', catalog: 'local' }]);
  const loadedSkill = await service.loadSkill('repair', { grantedCapabilities: ['repo:read'] });
  assert.match(loadedSkill.receiptSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual({ source: loadedSkill.source, catalog: loadedSkill.catalog, provenanceStatus: loadedSkill.provenanceStatus }, { source: 'nolane', catalog: 'local', provenanceStatus: 'local-user-supplied' });
  const child = service.spawnSubagent({ missionId: 'm1', parentAgentId: 'root', agentId: 'child', objective: 'Inspect', parentCapabilities: ['repo:read'], delegatedCapabilities: ['repo:read'], allowedPaths: ['src/**'] });
  assert.equal(child.status, 'running');
  const handoff = service.completeSubagent('child', { summary: 'Found issue', evidence: [{ receiptSha256: 'a'.repeat(64) }], verified: true });
  assert.match(handoff.handoffSha256, /^[a-f0-9]{64}$/);
  assert.equal((await service.startGateway('local')).status, 'running');
  const message = await service.sendMessage({ channel: 'mission:m1', text: 'ready', metadata: { missionId: 'm1' } });
  assert.match(message.externalId, /^local-/);
  await service.schedule({ id: 'j1', runAt: 900, task: { type: 'noop', payload: { missionId: 'm1' } } });
  assert.equal((await service.runDue()).length, 1);
  const trajectory = await service.appendTrajectory({ episodeId: 'e1', step: 1, state: { missionId: 'm1' }, action: { type: 'tool' }, effect: { status: 'pass' }, verifier: { valid: true, receiptSha256: 'b'.repeat(64) } });
  assert.match(trajectory.recordSha256, /^[a-f0-9]{64}$/);
  const exported = await service.exportTrajectories({ outputFile: path.join(root, 'export.jsonl') });
  assert.equal(exported.records, 1);
  assert.match(await readFile(path.join(root, 'export.jsonl'), 'utf8'), /"episodeId":"e1"/);
  assert.ok(events.some((event) => event.type === 'nolane.orchestration.message'));
});

test('orchestration service installs a verified ForgeOS Skill into its local catalog', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-orchestration-forgeos-install-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const skillsRoot = path.join(root, 'skills');
  const forgeRoot = path.join(root, 'forge-os');
  const forgeSkill = path.join(forgeRoot, 'skills-v2', 'stable', 'inspect');
  await mkdir(path.join(forgeSkill, 'sections'), { recursive: true });
  await writeFile(path.join(forgeSkill, 'SKILL.md'), '---\nname: inspect\ndescription: Inspect safely.\n---\n# Inspect\n');
  await writeFile(path.join(forgeSkill, 'manifest.json'), '{"id":"inspect"}\n');
  await writeFile(path.join(forgeSkill, 'sections', 'procedure.md'), '# Procedure\n');
  await writeFile(path.join(forgeRoot, 'skills-v2', 'catalog.json'), JSON.stringify([{ id: 'inspect', path: 'skills-v2/stable/inspect', maturity: 'stable', kernelLevel: 'L1', capabilityIds: [], targetTokens: 10 }]));
  await writeFile(path.join(forgeRoot, 'package.json'), JSON.stringify({ version: '0.6.1', license: 'MIT' }));
  const service = new NolaneNativeOrchestrationService({ dataDir: root, skillRoots: [skillsRoot], forgeOsRoots: [forgeRoot] });
  await service.open();

  const installed = await service.installForgeOsSkill('forgeos:v2:inspect');
  const local = await service.skillCatalog({ source: 'nolane', catalog: 'local' });

  assert.equal(installed.provenanceStatus, 'forge-os-imported');
  assert.deepEqual(local.skills.map((skill) => skill.id), ['inspect']);
  assert.equal(local.skills[0].provenanceStatus, 'forge-os-imported');
});
