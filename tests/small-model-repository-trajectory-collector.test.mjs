import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  collectRepositoryTrajectories,
  writeRepositoryTrajectoryDataset,
  verifyRepositoryTrajectoryDataset,
} from '../src/small-model/repository-trajectory-collector.mjs';

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nolane-repo-trajectories-'));
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.mkdir(path.join(root, 'tests'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'math.mjs'), 'export const add = (a, b) => a + b;\n');
  await fs.writeFile(path.join(root, 'tests', 'pass.test.mjs'), [
    "import test from 'node:test';",
    "import assert from 'node:assert/strict';",
    "import { add } from '../src/math.mjs';",
    "test('repository probe passes against real source', () => assert.equal(add(2, 3), 5));",
    '',
  ].join('\n'));
  await fs.writeFile(path.join(root, 'tests', 'fail.test.mjs'), [
    "import test from 'node:test';",
    "import assert from 'node:assert/strict';",
    "test('repository probe exposes a real verifier failure', () => assert.equal(1, 2));",
    '',
  ].join('\n'));
  return root;
}

test('collector executes real node tests and records only verified repository effects', async (t) => {
  const root = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const result = await collectRepositoryTrajectories({
    root,
    probes: [
      {
        id: 'pass-probe', kind: 'verification', actionType: 'test',
        testPath: 'tests/pass.test.mjs', sourcePaths: ['src/math.mjs'],
        state: { taskType: 'repository-verification', expectedLabel: 'unit' },
      },
      {
        id: 'fail-probe', kind: 'verification', actionType: 'test',
        testPath: 'tests/fail.test.mjs', sourcePaths: ['src/math.mjs'],
        state: { taskType: 'repository-verification', expectedLabel: 'unit' },
      },
    ],
    timeoutMs: 10_000,
  });

  assert.equal(result.attempts.length, 2);
  assert.equal(result.episodes.length, 1);
  assert.equal(result.excluded.length, 1);
  const episode = result.episodes[0];
  assert.equal(episode.id, 'pass-probe');
  assert.equal(episode.verifier.valid, true);
  assert.equal(episode.verifier.exitCode, 0);
  assert.equal(episode.actualEffect.changed, true);
  assert.match(episode.state.testSha256, /^[a-f0-9]{64}$/);
  assert.match(episode.state.sourceSha256ByPath['src/math.mjs'], /^[a-f0-9]{64}$/);
  assert.deepEqual(episode.action.argv.slice(1), ['--test', 'tests/pass.test.mjs']);
  assert.ok(Number.isFinite(episode.cost.durationMs));
  assert.match(episode.verifier.stdoutSha256, /^[a-f0-9]{64}$/);
  assert.match(episode.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(result.excluded[0].reason, 'verifier-failed');
  assert.equal(result.excluded[0].exitCode, 1);
});


test('collector discovers repository source imports when sourcePaths is auto', async (t) => {
  const root = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const result = await collectRepositoryTrajectories({
    root,
    probes: [{
      id: 'auto-source', kind: 'verification', actionType: 'test',
      testPath: 'tests/pass.test.mjs', sourcePaths: 'auto',
      state: { taskType: 'repository-verification', expectedLabel: 'unit' },
    }],
  });
  assert.deepEqual(Object.keys(result.episodes[0].state.sourceSha256ByPath), ['src/math.mjs']);
});

test('repository trajectory dataset is content addressed and rejects tampering', async (t) => {
  const root = await fixture();
  const outputDir = path.join(root, 'datasets', 'trajectories', 'repository-v1');
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const collection = await collectRepositoryTrajectories({
    root,
    probes: [{
      id: 'pass-probe', kind: 'tool-policy', actionType: 'test',
      testPath: 'tests/pass.test.mjs', sourcePaths: ['src/math.mjs'],
      state: { taskType: 'repository-verification', expectedLabel: 'test' },
    }],
  });
  const written = await writeRepositoryTrajectoryDataset({ root, outputDir, collection });
  const verified = await verifyRepositoryTrajectoryDataset({ outputDir });
  assert.equal(verified.valid, true);
  assert.equal(verified.episodeCount, 1);
  assert.equal(written.receiptSha256, verified.receiptSha256);

  const episodesPath = path.join(outputDir, 'episodes.jsonl');
  await fs.appendFile(episodesPath, '{"tampered":true}\n');
  await assert.rejects(
    verifyRepositoryTrajectoryDataset({ outputDir }),
    /trajectory dataset hash mismatch/i,
  );
});

test('collector rejects path escape and hidden reasoning metadata before execution', async (t) => {
  const root = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await assert.rejects(
    collectRepositoryTrajectories({
      root,
      probes: [{ id: 'escape', kind: 'verification', actionType: 'test', testPath: '../outside.test.mjs', sourcePaths: [], state: {} }],
    }),
    /outside repository root/i,
  );
  await assert.rejects(
    collectRepositoryTrajectories({
      root,
      probes: [{ id: 'hidden', kind: 'verification', actionType: 'test', testPath: 'tests/pass.test.mjs', sourcePaths: [], state: { hiddenReasoning: 'forbidden' } }],
    }),
    /hidden reasoning/i,
  );
});
