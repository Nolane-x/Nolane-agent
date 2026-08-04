import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { EmbeddingModelPack } from '../src/repository/embedding-model-pack.mjs';
import { OnnxCodeEmbeddingProvider } from '../src/repository/onnx-code-embedding-provider.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

async function packFixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-embedding-pack-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'model'), { recursive: true });
  const model = Buffer.from('verified-model-bytes');
  const tokenizer = Buffer.from('{"tokenizer":"verified"}');
  await writeFile(path.join(root, 'model', 'code-embed.int8.onnx'), model);
  await writeFile(path.join(root, 'model', 'tokenizer.json'), tokenizer);
  const manifest = {
    schema: 'forge.embedding-model-pack.v1',
    modelId: 'test-code-embed-int8',
    modelSha256: sha256(model),
    tokenizerSha256: sha256(tokenizer),
    dimensions: 3,
    quantization: 'int8',
    files: [
      { role: 'model', path: 'model/code-embed.int8.onnx', bytes: model.length, sha256: sha256(model) },
      { role: 'tokenizer', path: 'model/tokenizer.json', bytes: tokenizer.length, sha256: sha256(tokenizer) },
    ],
  };
  await writeFile(path.join(root, 'embedding-pack.json'), JSON.stringify(manifest));
  return { root, manifest };
}

test('EmbeddingModelPack verifies bytes and hashes and rejects tampering', async (t) => {
  const { root } = await packFixture(t);
  const pack = await EmbeddingModelPack.open(root);
  assert.equal(pack.modelId, 'test-code-embed-int8');
  assert.equal(pack.dimensions, 3);
  assert.match(pack.receiptSha256, /^[a-f0-9]{64}$/);
  await writeFile(path.join(root, 'model', 'tokenizer.json'), 'tampered');
  await assert.rejects(() => EmbeddingModelPack.open(root), (error) => error?.code === 'EMBEDDING_PACK_INTEGRITY_FAILED');
});

test('OnnxCodeEmbeddingProvider creates runtime lazily, mean-pools, normalizes, reuses session, and unloads when idle', async (t) => {
  const { root } = await packFixture(t);
  const pack = await EmbeddingModelPack.open(root);
  let sessions = 0;
  let closes = 0;
  let now = 100;
  const runtimeFactory = {
    async createSession({ modelPath, modelSha256 }) {
      sessions += 1;
      assert.equal(modelPath.endsWith('code-embed.int8.onnx'), true);
      assert.equal(modelSha256, pack.modelSha256);
      return {
        async run({ texts, tokenizerPath, signal }) {
          assert.equal(tokenizerPath.endsWith('tokenizer.json'), true);
          if (signal?.aborted) throw signal.reason;
          return {
            tokenEmbeddings: texts.map(() => [[1, 0, 0], [0, 2, 0], [100, 100, 100]]),
            attentionMask: texts.map(() => [1, 1, 0]),
          };
        },
        async close() { closes += 1; },
      };
    },
  };
  const provider = new OnnxCodeEmbeddingProvider({ pack, runtimeFactory, idleTtlMs: 50, clock: () => now });
  assert.equal(sessions, 0);
  assert.equal(await provider.available(), true);
  assert.equal(sessions, 0);

  const [vector] = await provider.embed(['authentication session']);
  assert.equal(sessions, 1);
  assert.ok(Math.abs(vector[0] - 0.4472135955) < 1e-8);
  assert.ok(Math.abs(vector[1] - 0.894427191) < 1e-8);
  assert.equal(vector[2], 0);
  await provider.embed(['second request']);
  assert.equal(sessions, 1);

  now = 151;
  assert.equal(await provider.unloadIdle(), true);
  assert.equal(closes, 1);
  await provider.embed(['after unload']);
  assert.equal(sessions, 2);
  await provider.close();
  assert.equal(closes, 2);
});

test('OnnxCodeEmbeddingProvider returns bounded not-installed and cancellation errors', async () => {
  const missing = new OnnxCodeEmbeddingProvider({ packRoot: '/path/that/does/not/exist', runtimeFactory: { async createSession() { throw new Error('must not run'); } } });
  assert.equal(await missing.available(), false);
  await assert.rejects(() => missing.embed(['x']), (error) => error?.code === 'EMBEDDING_MODEL_NOT_INSTALLED');

  const controller = new AbortController();
  controller.abort(new Error('cancelled'));
  await assert.rejects(() => missing.embed(['x'], { signal: controller.signal }), /cancelled/);
});
