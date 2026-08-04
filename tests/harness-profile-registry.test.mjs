import assert from 'node:assert/strict';
import test from 'node:test';

import { HarnessProfileRegistry, createBuiltInHarnessProfiles } from '../src/providers/harness-profile-registry.mjs';

function candidate(overrides = {}) {
  return {
    id: 'codex-cli-v2-candidate',
    family: 'codex-cli',
    revision: 2,
    status: 'candidate',
    systemDirectives: ['Use the Forge tool contract exactly.', 'Prefer bounded patch sets after reading evidence.'],
    contextStrategy: 'evidence-first',
    toolStrategy: 'patch-first',
    patchStrategy: 'patch-set-first',
    retryPolicy: { maxRetries: 2, backoff: 'bounded-exponential' },
    errorRendering: 'classified-actionable',
    maxToolSchemas: 48,
    maxDirectiveChars: 1200,
    ...overrides,
  };
}

test('built-in registry resolves distinct provider families and a generic fallback', () => {
  const registry = new HarnessProfileRegistry({ profiles: createBuiltInHarnessProfiles() });
  assert.equal(registry.resolve({ id: 'codex', harnessFamily: 'codex-cli' }).id, 'codex-cli-v1');
  assert.equal(registry.resolve({ id: 'claude', harnessFamily: 'claude-code' }).id, 'claude-code-v1');
  assert.equal(registry.resolve({ id: 'gemini-api', harnessFamily: 'gemini-api' }).id, 'gemini-api-v1');
  assert.equal(registry.resolve({ id: 'unknown', harnessFamily: 'unknown' }).id, 'generic-local-v1');
  assert.notEqual(registry.resolve({ harnessFamily: 'codex-cli' }).profileSha256, registry.resolve({ harnessFamily: 'claude-code' }).profileSha256);
});

test('profiles are deeply immutable and validation rejects oversized or unsupported values', () => {
  const registry = new HarnessProfileRegistry({ profiles: createBuiltInHarnessProfiles() });
  const profile = registry.resolve({ harnessFamily: 'codex-cli' });
  assert.throws(() => { profile.revision = 99; }, TypeError);
  assert.throws(() => { profile.systemDirectives.push('mutate'); }, TypeError);
  assert.throws(() => registry.registerCandidate(candidate({ contextStrategy: 'read-everything' })), /contextStrategy/);
  assert.throws(() => registry.registerCandidate(candidate({ systemDirectives: ['x'.repeat(5000)] })), /directive/);
});

test('candidate promotion requires a matching promotable replay report and rollback restores prior active profile', () => {
  const events = [];
  const registry = new HarnessProfileRegistry({ profiles: createBuiltInHarnessProfiles(), eventSink: (event) => events.push(event) });
  const registered = registry.registerCandidate(candidate());
  const baseline = registry.resolve({ harnessFamily: 'codex-cli' });

  assert.throws(() => registry.promote({ family: 'codex-cli', candidateId: registered.id, report: { promotable: false } }), /not promotable/);
  assert.throws(() => registry.promote({ family: 'codex-cli', candidateId: registered.id, report: { promotable: true, family: 'codex-cli', candidateProfileSha256: '0'.repeat(64), receiptSha256: '1'.repeat(64) } }), /hash/);

  const promoted = registry.promote({
    family: 'codex-cli',
    candidateId: registered.id,
    report: {
      schema: 'forge.harness-experiment-report.v1',
      promotable: true,
      family: 'codex-cli',
      candidateProfileSha256: registered.profileSha256,
      receiptSha256: 'a'.repeat(64),
    },
    actor: 'release-gate',
  });
  assert.equal(promoted.activeProfileId, registered.id);
  assert.equal(registry.resolve({ harnessFamily: 'codex-cli' }).id, registered.id);
  assert.match(promoted.receiptSha256, /^[a-f0-9]{64}$/);

  const rolledBack = registry.rollback({ family: 'codex-cli', actor: 'release-gate' });
  assert.equal(rolledBack.activeProfileId, baseline.id);
  assert.equal(registry.resolve({ harnessFamily: 'codex-cli' }).id, baseline.id);
  assert.deepEqual(events.map((event) => event.type), ['harness.profile.candidate-registered', 'harness.profile.promoted', 'harness.profile.rolled-back']);
});

test('public view exposes bounded identities without directives', () => {
  const registry = new HarnessProfileRegistry({ profiles: createBuiltInHarnessProfiles() });
  const view = registry.publicView();
  assert.ok(view.length >= 7);
  assert.equal(Object.hasOwn(view[0], 'systemDirectives'), false);
  assert.match(view[0].profileSha256, /^[a-f0-9]{64}$/);
});
