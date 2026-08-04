import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AgentProfileLoader } from '../src/agents/agent-profile-loader.mjs';
import { SubagentOrchestrator } from '../src/agents/subagent-orchestrator.mjs';

async function project(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-agents-'));
  t.after(async () => { await import('node:fs/promises').then(({ rm }) => rm(root, { recursive: true, force: true })); });
  await mkdir(path.join(root, '.forge', 'agents'), { recursive: true });
  return root;
}

test('AgentProfileLoader validates scoped markdown profiles and rejects duplicate ids', async (t) => {
  const root = await project(t);
  await writeFile(path.join(root, '.forge', 'agents', 'reviewer.md'), `---
id: reviewer
description: Security-focused reviewer
tools: [fs.read, fs.search, git.diff]
exclusiveTools: [git.review]
mcpServers: [github]
skills: [security-review]
capabilities: [review]
maxTurns: 12
budgetTokens: 16000
allowChildAgents: false
sandboxProfile: read-only
---
Review only genuine correctness and security defects.
`);
  const loader = new AgentProfileLoader();
  const profiles = await loader.loadProjectProfiles(root);
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].id, 'reviewer');
  assert.deepEqual(profiles[0].tools, ['fs.read', 'fs.search', 'git.diff']);
  assert.equal(profiles[0].prompt, 'Review only genuine correctness and security defects.');
  await writeFile(path.join(root, '.forge', 'agents', 'duplicate.md'), `---\nid: reviewer\ndescription: duplicate\n---\nDuplicate`);
  await assert.rejects(() => loader.loadProjectProfiles(root), /AGENT_PROFILE_DUPLICATE/);
});

test('SubagentOrchestrator intersects parent authority and signs a bounded handoff', async () => {
  const events = [];
  const profile = {
    id: 'reviewer', description: 'review', prompt: 'Review.', tools: ['fs.read', 'fs.write', 'git.diff'],
    exclusiveTools: ['git.review'], mcpServers: ['github', 'linear'], skills: ['security-review'], capabilities: ['review'],
    maxTurns: 10, budgetTokens: 10_000, allowChildAgents: false, sandboxProfile: 'read-only',
  };
  const orchestrator = new SubagentOrchestrator({
    profiles: [profile],
    eventSink: (event) => events.push(event),
    signer: { async sign(digest) { return `sig:${digest}`; } },
    runner: async (child) => ({ summary: `used ${child.allowedTools.join(',')}`, receipts: ['r1'], output: { findings: 2 } }),
  });
  const result = await orchestrator.run({
    parentTask: {
      id: 'parent-1', projectId: 'p1', allowedTools: ['fs.read', 'git.diff', 'git.review'],
      allowedMcpServers: ['github'], allowedSkills: ['security-review'], permissions: ['agent.create'],
      maxTurns: 8, budgetTokens: 8_000,
    },
    profileId: 'reviewer', objective: 'Review the patch',
  });
  assert.deepEqual(result.child.allowedTools, ['fs.read', 'git.diff', 'git.review']);
  assert.deepEqual(result.child.mcpServers, ['github']);
  assert.deepEqual(result.child.skills, ['security-review']);
  assert.equal(result.child.maxTurns, 8);
  assert.equal(result.child.budgetTokens, 8_000);
  assert.match(result.handoff.digest, /^[a-f0-9]{64}$/);
  assert.equal(result.handoff.signature, `sig:${result.handoff.digest}`);
  assert.equal(events[0].type, 'subagent.started');
  assert.equal(events.at(-1).type, 'subagent.completed');
});

test('SubagentOrchestrator serializes shared exclusive tools while parallelizing independent agents', async () => {
  let activeExclusive = 0;
  let peakExclusive = 0;
  let activeGeneral = 0;
  let peakGeneral = 0;
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const profiles = [
    { id: 'exclusive', description: 'exclusive', prompt: '', tools: [], exclusiveTools: ['browser.write'], mcpServers: [], skills: [], capabilities: [], maxTurns: 4, budgetTokens: 1000, allowChildAgents: false, sandboxProfile: 'workspace' },
    { id: 'general', description: 'general', prompt: '', tools: ['fs.read'], exclusiveTools: [], mcpServers: [], skills: [], capabilities: [], maxTurns: 4, budgetTokens: 1000, allowChildAgents: false, sandboxProfile: 'workspace' },
  ];
  const orchestrator = new SubagentOrchestrator({
    profiles,
    maxConcurrency: 4,
    runner: async (child) => {
      if (child.exclusiveTools.length) { activeExclusive += 1; peakExclusive = Math.max(peakExclusive, activeExclusive); }
      else { activeGeneral += 1; peakGeneral = Math.max(peakGeneral, activeGeneral); }
      await delay(35);
      if (child.exclusiveTools.length) activeExclusive -= 1; else activeGeneral -= 1;
      return { summary: child.objective, receipts: [] };
    },
  });
  const parentTask = { id: 'p', projectId: 'p1', allowedTools: ['browser.write', 'fs.read'], allowedMcpServers: [], allowedSkills: [], permissions: ['agent.create'], maxTurns: 8, budgetTokens: 8000 };
  const results = await orchestrator.runGraph({ parentTask, jobs: [
    { id: 'a', profileId: 'exclusive', objective: 'a' },
    { id: 'b', profileId: 'exclusive', objective: 'b' },
    { id: 'c', profileId: 'general', objective: 'c' },
    { id: 'd', profileId: 'general', objective: 'd' },
  ] });
  assert.equal(results.length, 4);
  assert.equal(peakExclusive, 1);
  assert.ok(peakGeneral >= 2);
});

test('SubagentOrchestrator honors dependencies, cancellation, and child-agent permission', async () => {
  const order = [];
  const profile = { id: 'worker', description: 'worker', prompt: '', tools: ['fs.read'], exclusiveTools: [], mcpServers: [], skills: [], capabilities: [], maxTurns: 4, budgetTokens: 1000, allowChildAgents: true, sandboxProfile: 'workspace' };
  const orchestrator = new SubagentOrchestrator({ profiles: [profile], runner: async (child, { signal }) => {
    if (signal?.aborted) throw signal.reason;
    order.push(child.jobId);
    return { summary: child.jobId, receipts: [] };
  } });
  const parentTask = { id: 'p', projectId: 'p1', allowedTools: ['fs.read'], allowedMcpServers: [], allowedSkills: [], permissions: ['agent.create'], maxTurns: 4, budgetTokens: 1000 };
  const graph = await orchestrator.runGraph({ parentTask, jobs: [
    { id: 'build', profileId: 'worker', objective: 'build' },
    { id: 'review', profileId: 'worker', objective: 'review', dependencies: ['build'] },
  ] });
  assert.deepEqual(order, ['build', 'review']);
  assert.equal(graph[1].child.canCreateChildren, true);
  const controller = new AbortController(); controller.abort(new Error('cancelled by user'));
  await assert.rejects(() => orchestrator.run({ parentTask, profileId: 'worker', objective: 'cancel', signal: controller.signal }), /cancelled by user/);
  await assert.rejects(() => orchestrator.run({ parentTask: { ...parentTask, permissions: [] }, profileId: 'worker', objective: 'denied' }), /SUBAGENT_PERMISSION_DENIED/);
});
