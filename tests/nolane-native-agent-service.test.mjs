import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { StudioStore } from '../src/storage/studio-store.mjs';
import { NolaneSessionStore } from '../src/nolane-native/session-store.mjs';
import { NolaneNativeAgentService } from '../src/nolane-native/agent-service.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function providerSource(providers) {
  return { list: () => providers, detection: () => ({ available: true, healthy: true, authenticated: true }) };
}

test('native agent service uses provider fallback, governed file effect, verified criterion and durable session trace', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-agent-service-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const workspace = path.join(root, 'workspace');
  await writeFile(path.join(root, 'placeholder'), 'x');
  await import('node:fs/promises').then(({ mkdir }) => mkdir(workspace, { recursive: true }));
  await writeFile(path.join(workspace, 'note.txt'), 'before');
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  store.createProject({ id: 'p1', name: 'Project', workspaceRoot: workspace });
  const sessions = new NolaneSessionStore({ root: path.join(root, 'sessions') });
  await sessions.open();
  await sessions.createSession({ id: 's1', title: 'Write verified note', projectId: 'p1' });
  let primaryCalls = 0;
  const primary = {
    id: 'primary',
    profile: { capabilities: ['coding', 'tool-calling'], qualityTier: 5 },
    publicView() { return { id: this.id, capabilities: this.profile.capabilities, qualityTier: 5 }; },
    async complete() { primaryCalls += 1; const error = new Error('temporary provider outage'); error.retryable = true; throw error; },
  };
  let secondaryCalls = 0;
  const content = 'after\n';
  const secondary = {
    id: 'secondary',
    profile: { capabilities: ['coding', 'tool-calling'], qualityTier: 4 },
    publicView() { return { id: this.id, capabilities: this.profile.capabilities, qualityTier: 4 }; },
    async complete({ messages }) {
      secondaryCalls += 1;
      const state = JSON.parse(messages.at(-1).content);
      if (secondaryCalls === 1) {
        return {
          text: '',
          toolCalls: [{ id: 'call-1', name: 'file.write', arguments: { path: 'note.txt', content }, expectedEffect: { contentSha256: sha256(content) } }],
          usage: { totalTokens: 20 },
        };
      }
      const receipt = state.effects[0].receiptSha256;
      return {
        text: JSON.stringify({ schema: 'nolane.agent.final.v1', answer: 'Updated note.txt', criteriaProof: [{ id: 'c1', verified: true, evidenceReceiptSha256: receipt }] }),
        toolCalls: [],
        usage: { totalTokens: 12 },
      };
    },
  };
  const service = new NolaneNativeAgentService({
    store,
    sessionStore: sessions,
    providerSource: providerSource([primary, secondary]),
    allowedCommands: ['node'],
  });
  const result = await service.run({
    missionId: 'm1', sessionId: 's1', projectId: 'p1', objective: 'Update note',
    criteria: [{ id: 'c1', text: 'note.txt contains the requested text' }],
    requiredCapabilities: ['coding', 'tool-calling'],
    grantedCapabilities: ['file:write'],
    approvals: [], budgets: { maxTurns: 5, maxTokens: 1000, timeoutMs: 10_000, maxToolCalls: 4 },
  });
  assert.equal(result.status, 'completed');
  assert.equal(result.verification.verified, true);
  assert.equal(result.verification.schema, 'nolane.goal-evidence-contract.v1');
  assert.equal(result.verification.actorId, 'provider:secondary');
  assert.equal(result.verification.verifierId, 'nolane:goal-evidence-verifier');
  assert.notEqual(result.verification.actorId, result.verification.verifierId);
  assert.match(result.verification.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(await readFile(path.join(workspace, 'note.txt'), 'utf8'), content);
  assert.equal(primaryCalls, 1);
  assert.equal(secondaryCalls, 2);
  assert.deepEqual(result.transcript.map((item) => item.providerId), ['secondary', 'secondary']);
  assert.match(result.receipt.sha256, /^[a-f0-9]{64}$/);
  const session = sessions.getSession('s1');
  assert.equal(session.messages.length, 2);
  assert.equal(session.messages[0].role, 'user');
  assert.equal(session.messages[1].role, 'assistant');
  assert.match(session.messages[1].text, /Updated note\.txt/);
});

test('native agent service fails closed for traversal and unapproved shell execution', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-agent-guard-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const workspace = path.join(root, 'workspace');
  await import('node:fs/promises').then(({ mkdir }) => mkdir(workspace, { recursive: true }));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  store.createProject({ id: 'p1', name: 'Project', workspaceRoot: workspace });
  const sessions = new NolaneSessionStore({ root: path.join(root, 'sessions') });
  await sessions.open();
  await sessions.createSession({ id: 's1', title: 'Guarded', projectId: 'p1' });
  for (const action of [
    { name: 'file.write', arguments: { path: '../escape.txt', content: 'bad' } },
    { name: 'shell.execute', arguments: { command: ['node', '--version'] } },
  ]) {
    let calls = 0;
    const provider = {
      id: `provider-${action.name}`,
      profile: { capabilities: ['coding', 'tool-calling'] },
      publicView() { return { id: this.id, capabilities: this.profile.capabilities }; },
      async complete() { calls += 1; return { text: '', toolCalls: [{ id: `c-${calls}`, ...action }], usage: { totalTokens: 1 } }; },
    };
    const service = new NolaneNativeAgentService({ store, sessionStore: sessions, providerSource: providerSource([provider]), allowedCommands: ['node'] });
    await assert.rejects(() => service.run({ missionId: `m-${action.name}`, sessionId: 's1', projectId: 'p1', objective: 'unsafe', criteria: [], requiredCapabilities: ['coding'], grantedCapabilities: ['file:write', 'shell:execute'], approvals: [], budgets: { maxTurns: 1, maxTokens: 10, timeoutMs: 1000, maxToolCalls: 1 } }), /outside workspace|Approval required/);
  }
});
