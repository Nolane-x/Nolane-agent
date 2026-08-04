import assert from 'node:assert/strict';
import test from 'node:test';

import { MissionProcessLedger } from '../src/runtime/mission-process-ledger.mjs';

function fakeDriver(samples) {
  let index = 0;
  return {
    async sampleTree() {
      const value = samples[Math.min(index, samples.length - 1)];
      index += 1;
      if (value instanceof Error) throw value;
      return structuredClone(value);
    },
    async sampleFileDescriptors() { return index * 3; },
  };
}

test('MissionProcessLedger attributes current and peak process resources to a mission', async () => {
  const ledger = new MissionProcessLedger({ driver: fakeDriver([
    { cpuTimeMs: 20, rssBytes: 100, processCount: 1, pids: [10] },
    { cpuTimeMs: 55, rssBytes: 250, processCount: 3, pids: [10, 11, 12] },
    { cpuTimeMs: 80, rssBytes: 180, processCount: 2, pids: [10, 11] },
  ]), clock: (() => { let now = 1000; return () => now += 10; })() });

  const registered = ledger.register({ rootPid: 10, projectId: 'p1', missionId: 'm1', taskId: 't1', providerId: 'codex', sessionId: 's1' });
  assert.equal(registered.missionId, 'm1');
  await ledger.sample(registered.id);
  await ledger.sample(registered.id);
  const entry = await ledger.sample(registered.id);

  assert.equal(entry.current.rssBytes, 180);
  assert.equal(entry.peak.rssBytes, 250);
  assert.equal(entry.peak.processCount, 3);
  assert.equal(entry.current.cpuTimeMs, 80);
  assert.equal(entry.cpuDeltaMs, 25);
  assert.equal(entry.current.fileDescriptors, 9);
  assert.match(entry.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(Object.isFrozen(entry), true);

  const mission = ledger.snapshot({ missionId: 'm1' });
  assert.equal(mission.entries.length, 1);
  assert.equal(mission.aggregates.currentRssBytes, 180);
  assert.equal(mission.aggregates.peakRssBytes, 250);
});

test('MissionProcessLedger finalizes disappeared processes without losing the last sample', async () => {
  const missing = Object.assign(new Error('gone'), { code: 'SANDBOX_PROCESS_NOT_FOUND' });
  const ledger = new MissionProcessLedger({ driver: fakeDriver([
    { cpuTimeMs: 10, rssBytes: 64, processCount: 1, pids: [44] },
    missing,
  ]) });
  const { id } = ledger.register({ rootPid: 44, missionId: 'm2', taskId: 't2', providerId: 'claude' });
  await ledger.sample(id);
  const finalized = await ledger.sample(id);
  assert.equal(finalized.state, 'exited');
  assert.equal(finalized.exitReason, 'process-unavailable');
  assert.equal(finalized.current.rssBytes, 64);
});

test('MissionProcessLedger keeps only bounded metadata and never stores raw command or prompt fields', () => {
  const ledger = new MissionProcessLedger({ driver: fakeDriver([]) });
  const entry = ledger.register({
    rootPid: 7, missionId: 'm3', taskId: 't3', providerId: 'gemini',
    metadata: { executable: 'gemini', command: 'gemini --api-key SECRET', prompt: 'private prompt', role: 'reviewer', nested: { token: 'SECRET' } },
  });
  const serialized = JSON.stringify(entry);
  assert.equal(serialized.includes('private prompt'), false);
  assert.equal(serialized.includes('SECRET'), false);
  assert.deepEqual(entry.metadata, { executable: 'gemini', role: 'reviewer' });
});

test('MissionProcessLedger exposes unavailable file descriptor accounting explicitly', async () => {
  const ledger = new MissionProcessLedger({ driver: { async sampleTree() { return { cpuTimeMs: 1, rssBytes: 2, processCount: 1, pids: [5] }; } } });
  const { id } = ledger.register({ rootPid: 5, missionId: 'm4' });
  const sampled = await ledger.sample(id);
  assert.equal(sampled.current.fileDescriptors, null);
  assert.equal(sampled.capabilities.fileDescriptors, 'unavailable');
});

test('MissionProcessLedger integrates sampled RSS over time without claiming FD support', async () => {
  let now = 0;
  const mib = 1024 * 1024;
  const ledger = new MissionProcessLedger({ clock: () => now, driver: fakeDriver([
    { cpuTimeMs: 1, rssBytes: 100 * mib, processCount: 1, pids: [8] },
    { cpuTimeMs: 2, rssBytes: 300 * mib, processCount: 1, pids: [8] },
  ]) });
  const { id } = ledger.register({ rootPid: 8, missionId: 'm-rss' });
  now = 10_000; await ledger.sample(id);
  now = 20_000; const second = await ledger.sample(id);
  assert.equal(second.rssMbSeconds, 2_000);
  assert.equal(ledger.snapshot({ missionId: 'm-rss' }).aggregates.rssMbSeconds, 2_000);
  assert.equal(second.capabilities.fileDescriptors, 'available');
});
