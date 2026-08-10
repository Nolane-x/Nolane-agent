import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  ReproducibleBenchmarkPack,
  createFrontierBenchmarkFixtures,
} from '../src/frontier-completion/reproducible-benchmark-pack.mjs';

const sha = (value) => createHash('sha256').update(value).digest('hex');
const key = Buffer.alloc(32, 7);

function tasks() {
  return [
    ['bug-1', 'bug', 'long-horizon'],
    ['feature-1', 'feature', 'browser-ui'],
    ['refactor-1', 'refactor', 'multi-agent'],
    ['migration-1', 'migration', 'security'],
    ['review-1', 'review', 'security'],
  ].map(([id, category, frontierCategory]) => ({
    id, category, frontierCategory,
    repository: { sourceId: `repo-${id}`, commit: sha(`commit-${id}`), contentFingerprint: sha(`content-${id}`), neverSeenBefore: true },
    objective: `${category} objective`,
    input: { issue: `${category} issue` },
    oracle: { expected: `${category} result`, verify: ['node', '--test'] },
  }));
}

test('benchmark pack enforces never-seen content-addressed repositories and contamination lock', () => {
  const contaminated = sha('known-repository');
  const pack = new ReproducibleBenchmarkPack({ contaminationFingerprints: [contaminated] });
  const admitted = pack.admitRepository({ sourceId: 'new-repo', commit: sha('new-commit'), contentFingerprint: sha('new-content'), neverSeenBefore: true });
  assert.equal(admitted.status, 'admitted');
  assert.match(admitted.receiptSha256, /^[a-f0-9]{64}$/);
  assert.throws(() => pack.admitRepository({ sourceId: 'known', commit: sha('old'), contentFingerprint: contaminated, neverSeenBefore: true }), /contamination/i);
  assert.throws(() => pack.admitRepository({ sourceId: 'undeclared', commit: sha('x'), contentFingerprint: sha('y') }), /never-seen/i);
});

test('public suite is reproducible and covers real bug feature refactor migration and review tasks plus frontier categories', () => {
  const pack = new ReproducibleBenchmarkPack();
  const first = pack.createPublicSuite({ id: 'frontier-public', version: 1, tasks: tasks() });
  const second = pack.createPublicSuite({ id: 'frontier-public', version: 1, tasks: [...tasks()].reverse() });
  assert.equal(first.receiptSha256, second.receiptSha256);
  assert.deepEqual(first.categories, ['bug', 'feature', 'migration', 'refactor', 'review']);
  assert.deepEqual(first.frontierCategories, ['browser-ui', 'long-horizon', 'multi-agent', 'security']);
  assert.equal(first.tasks.every((item) => item.oracle === undefined), true);
});

test('private held-out suite encrypts the oracle and executor projection cannot read answers', () => {
  const pack = new ReproducibleBenchmarkPack();
  const sealed = pack.sealPrivateSuite({ id: 'frontier-private', version: 1, tasks: tasks(), key, iv: Buffer.alloc(12, 9) });
  assert.equal(sealed.cipher, 'aes-256-gcm');
  assert.equal(JSON.stringify(sealed).includes('expected'), false);
  const executor = pack.executorProjection(sealed);
  assert.equal(JSON.stringify(executor).includes('oracle'), false);
  assert.equal(executor.tasks.length, 5);
  const verifier = pack.openPrivateSuite(sealed, { key, role: 'verifier' });
  assert.equal(verifier.tasks[0].oracle.expected.length > 0, true);
  assert.throws(() => pack.openPrivateSuite(sealed, { key, role: 'executor' }), /verifier/i);
});

test('private held-out suite rejects a truncated AES-GCM authentication tag before decryption', () => {
  const pack = new ReproducibleBenchmarkPack();
  const sealed = pack.sealPrivateSuite({ id: 'frontier-private', version: 1, tasks: tasks(), key, iv: Buffer.alloc(12, 9) });
  const truncated = { ...sealed, authTag: Buffer.from(sealed.authTag, 'base64').subarray(0, 15).toString('base64') };
  assert.throws(() => pack.openPrivateSuite(truncated, { key, role: 'verifier' }), /authentication tag must be exactly 16 bytes/i);
});

test('benchmark execution receipt binds suite task environment permissions budgets and result evidence', () => {
  const pack = new ReproducibleBenchmarkPack();
  const suite = pack.createPublicSuite({ id: 'frontier-public', version: 1, tasks: tasks() });
  const run = pack.recordRun({
    suiteReceiptSha256: suite.receiptSha256,
    taskId: 'bug-1',
    environment: { machineSha256: sha('machine'), runtimeSha256: sha('runtime') },
    permissions: { network: 'off', filesystem: 'workspace', shell: 'bounded' },
    budgets: { timeoutMs: 60_000, maxTokens: 1000, maxRssMb: 512 },
    result: { verified: true, verificationReceiptSha256: sha('verified'), artifacts: [sha('patch')] },
  });
  assert.equal(run.status, 'verified');
  assert.match(run.receiptSha256, /^[a-f0-9]{64}$/);
});

test('competitor comparison remains external without independently supplied comparable artifacts', () => {
  const pack = new ReproducibleBenchmarkPack();
  const report = pack.compareSystems({ forgeRun: { receiptSha256: sha('forge') }, competitorRun: null });
  assert.equal(report.status, 'external_gate');
  assert.equal(report.claimAllowed, false);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
});

test('frontier fixture generator emits content-addressed public and encrypted private files', () => {
  const generated = createFrontierBenchmarkFixtures({ tasks: tasks(), key, iv: Buffer.alloc(12, 3) });
  assert.equal(generated.publicFile.path, 'benchmark/frontier/public-suite.json');
  assert.equal(generated.privateFile.path, 'benchmark/frontier/private-held-out.enc.json');
  assert.match(generated.publicFile.sha256, /^[a-f0-9]{64}$/);
  assert.match(generated.privateFile.sha256, /^[a-f0-9]{64}$/);
  assert.notEqual(generated.publicFile.sha256, generated.privateFile.sha256);
});
