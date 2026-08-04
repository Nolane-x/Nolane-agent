import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { IndependentVerificationRuntime } from '../src/verification/independent-verification-runtime.mjs';

const sha = (value) => canonicalSha256(value);

test('temporary mutation probe proves boundary coverage and restores exact bytes', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-mutation-probe-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'validator.mjs');
  const original = 'export const positive = (value) => value > 0;\n';
  await writeFile(file, original);
  const runtime = new IndependentVerificationRuntime({ vaultRoot: path.join(root, 'vault'), vaultKey: Buffer.alloc(32, 7) });
  const proof = await runtime.runMutationProbe({
    probeId: 'boundary-positive', filePath: file,
    mutate: (source) => source.replace('value > 0', 'value >= 0'),
    verify: async () => ({ status: 'fail', failureCount: 1, receiptSha256: sha('mutation-caught') }),
  });
  assert.equal(proof.status, 'pass');
  assert.equal(proof.mutationCaught, true);
  assert.equal(proof.restoredExactBytes, true);
  assert.equal(await readFile(file, 'utf8'), original);

  const survived = await runtime.runMutationProbe({
    probeId: 'surviving-mutant', filePath: file,
    mutate: (source) => source.replace('value > 0', 'value >= 0'),
    verify: async () => ({ status: 'pass', failureCount: 0, receiptSha256: sha('mutation-survived') }),
  });
  assert.equal(survived.status, 'fail');
  assert.ok(survived.reasons.includes('mutation-survived'));
  assert.equal(await readFile(file, 'utf8'), original);
});

test('high-risk review requires different identity and provider', () => {
  const runtime = new IndependentVerificationRuntime({ vaultRoot: '/tmp/unused-for-review', vaultKey: Buffer.alloc(32, 8) });
  const sameProvider = runtime.requireIndependentReview({
    risk: 0.9, executor: { identity: 'agent-a', provider: 'provider-a' },
    reviewer: { identity: 'agent-b', provider: 'provider-a' },
    review: { status: 'approved', receiptSha256: sha('review') },
  });
  assert.equal(sameProvider.status, 'blocked');
  const approved = runtime.requireIndependentReview({
    risk: 0.9, executor: { identity: 'agent-a', provider: 'provider-a' },
    reviewer: { identity: 'agent-b', provider: 'provider-b' },
    review: { status: 'approved', receiptSha256: sha('review') },
  });
  assert.equal(approved.status, 'approved');
  assert.equal(approved.identityIndependent, true);
  assert.equal(approved.providerIndependent, true);
});

test('browser and API journey receipts require hashed before-after artifacts', () => {
  const runtime = new IndependentVerificationRuntime({ vaultRoot: '/tmp/unused-for-journey', vaultKey: Buffer.alloc(32, 9) });
  const receipt = runtime.verifyJourney({
    journeyId: 'settings-save', kind: 'browser',
    steps: [{ action: 'open', target: '/settings' }, { action: 'click', target: 'save' }],
    beforeArtifact: { artifactId: 'before.png', sha256: sha('before') },
    afterArtifact: { artifactId: 'after.png', sha256: sha('after') },
    runtimeReceiptSha256: sha('runtime'), assertions: [{ id: 'saved', status: 'pass' }],
  });
  assert.equal(receipt.status, 'pass');
  assert.equal(receipt.artifacts.before.sha256, sha('before'));
  assert.equal(receipt.artifacts.after.sha256, sha('after'));
  assert.throws(() => runtime.verifyJourney({ journeyId: 'bad', kind: 'api', steps: [], beforeArtifact: { artifactId: 'x', sha256: 'bad' } }), /SHA-256/);
});

test('hidden regression vault keeps expected answer encrypted and executor-blind', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-hidden-regression-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const key = Buffer.alloc(32, 3);
  const runtime = new IndependentVerificationRuntime({ vaultRoot: root, vaultKey: key });
  const registration = await runtime.registerHiddenCase({
    caseId: 'case-1', taskKind: 'rename', executorInput: { source: 'const oldName = 1;' }, expected: { output: 'const newName = 1;' }, tags: ['rename', 'held-out'],
  });
  assert.equal(registration.payloadExposed, false);
  const raw = await readFile(path.join(root, 'case-1.hidden'), 'utf8');
  assert.equal(raw.includes('const newName'), false);
  assert.equal(raw.includes('expected'), false);

  let executorObserved;
  const result = await runtime.evaluateHiddenCase('case-1', async (input) => {
    executorObserved = input;
    return { output: input.source.replace('oldName', 'newName') };
  });
  assert.deepEqual(executorObserved, { source: 'const oldName = 1;' });
  assert.equal('expected' in executorObserved, false);
  assert.equal(result.status, 'pass');
  assert.equal(result.expectedExposedToExecutor, false);

  const restarted = new IndependentVerificationRuntime({ vaultRoot: root, vaultKey: key });
  const failed = await restarted.evaluateHiddenCase('case-1', async () => ({ output: 'wrong' }));
  assert.equal(failed.status, 'fail');
});
