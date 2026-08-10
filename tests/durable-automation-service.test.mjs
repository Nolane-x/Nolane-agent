import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { DurableAutomationService } from '../src/automations/durable-automation-service.mjs';

async function fixture(t, options = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-automation-'));
  const service = new DurableAutomationService({ file: path.join(root, 'automations.sqlite'), ...options });
  t.after(() => service.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, service };
}

test('DurableAutomationService persists interval definitions and prevents overlapping runs', async (t) => {
  let now = 1_000;
  const calls = [];
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const f = await fixture(t, { clock: () => now, runner: async (input) => { calls.push(input); if (calls.length === 1) await gate; return { status: 'pass', output: { report: 'ok' }, memory: 'Use npm test' }; } });
  const automation = f.service.create({ projectId: 'p', name: 'Nightly review', objective: 'Review dependencies', trigger: { kind: 'interval', everyMs: 60_000 }, outputPolicy: 'report', skills: ['dependency-review'] });
  const first = f.service.tick();
  await new Promise((resolve) => setImmediate(resolve));
  const overlap = await f.service.tick();
  assert.equal(overlap.skipped.some((item) => item.reason === 'already-running'), true);
  release(); await first;
  assert.equal(calls.length, 1);
  assert.equal(f.service.get(automation.id).lastRunStatus, 'pass');
  now += 60_000;
  await f.service.tick();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].priorMemory[0], 'Use npm test');
});

test('DurableAutomationService handles idempotent repository and webhook events with scoped capabilities', async (t) => {
  const calls = [];
  const f = await fixture(t, { runner: async (input) => { calls.push(input); return { status: 'pass', output: { pullRequestDraft: true } }; } });
  const automation = f.service.create({ projectId: 'p', name: 'Issue fixer', objective: 'Prepare a fix', trigger: { kind: 'event', eventTypes: ['github.issue.labeled'] }, outputPolicy: 'pull-request-draft', capabilities: ['git.read', 'git.write'], mcpServers: ['github'] });
  assert.equal(f.service.ingestEvent({ eventId: 'evt-1', type: 'github.issue.labeled', projectId: 'p', payload: { issue: 7 } }).queued, 1);
  assert.equal(f.service.ingestEvent({ eventId: 'evt-1', type: 'github.issue.labeled', projectId: 'p', payload: { issue: 7 } }).duplicate, true);
  await f.service.tick();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].capabilities, ['git.read', 'git.write']);
  assert.deepEqual(calls[0].mcpServers, ['github']);
  assert.equal(calls[0].event.payload.issue, 7);
  assert.equal(f.service.listRuns(automation.id)[0].status, 'pass');
});

test('DurableAutomationService retries failed work after restart and never permits direct production deployment', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-automation-retry-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'automations.sqlite');
  let now = 10_000; let attempts = 0;
  const first = new DurableAutomationService({ file, clock: () => now, retryBaseMs: 100, runner: async () => { attempts += 1; throw new Error('temporary failure'); } });
  assert.throws(() => first.create({ projectId: 'p', name: 'Unsafe', objective: 'Deploy', trigger: { kind: 'manual' }, outputPolicy: 'deploy-production' }), /output policy/i);
  const automation = first.create({ projectId: 'p', name: 'Safe', objective: 'Prepare release', trigger: { kind: 'manual' }, outputPolicy: 'branch' });
  first.enqueue(automation.id, { eventId: 'manual-1', type: 'manual', projectId: 'p', payload: {} });
  await first.tick();
  assert.equal(first.listRuns(automation.id)[0].status, 'retry-wait');
  first.close();

  now += 101;
  const reopened = new DurableAutomationService({ file, clock: () => now, retryBaseMs: 100, runner: async () => { attempts += 1; return { status: 'pass', output: { branch: 'forge/task' } }; } });
  await reopened.tick();
  assert.equal(reopened.listRuns(automation.id)[0].status, 'pass');
  assert.equal(attempts, 2);
  reopened.close();
});
