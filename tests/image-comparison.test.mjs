import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { ImageComparisonService, encodeRgbaPng } from '../src/browser/image-comparison-service.mjs';

async function fixture(t, options = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-image-comparison-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const service = new ImageComparisonService({ workspaceRoot: root, artifactRoot: path.join(root, 'artifacts'), ...options });
  return { root, service };
}

function image(width, height, pixels) {
  return encodeRgbaPng({ width, height, data: Uint8Array.from(pixels) });
}

test('ImageComparisonService hashes inputs, measures pixels and writes a content-addressed PNG diff', async (t) => {
  const f = await fixture(t);
  const baseline = image(2, 1, [0, 0, 0, 255, 255, 255, 255, 255]);
  const actual = image(2, 1, [0, 0, 0, 255, 255, 0, 255, 255]);
  await writeFile(path.join(f.root, 'before.png'), baseline);
  await writeFile(path.join(f.root, 'after.png'), actual);
  const result = await f.service.compare({ baselinePath: 'before.png', actualPath: 'after.png', outputName: 'change.png' });
  assert.equal(result.width, 2);
  assert.equal(result.height, 1);
  assert.equal(result.changedPixels, 1);
  assert.equal(result.changedPixelRatio, 0.5);
  assert.match(result.baselineSha256, /^[a-f0-9]{64}$/);
  assert.match(result.actualSha256, /^[a-f0-9]{64}$/);
  assert.match(result.diffSha256, /^[a-f0-9]{64}$/);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(result.diffArtifact, 'artifacts/change.png');
  assert.ok((await stat(path.join(f.root, result.diffArtifact))).isFile());
  assert.deepEqual((await readFile(path.join(f.root, result.diffArtifact))).subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
});

test('ImageComparisonService supports threshold and detects dimension mismatch', async (t) => {
  const f = await fixture(t);
  await writeFile(path.join(f.root, 'a.png'), image(1, 1, [10, 10, 10, 255]));
  await writeFile(path.join(f.root, 'b.png'), image(1, 1, [12, 10, 10, 255]));
  assert.equal((await f.service.compare({ baselinePath: 'a.png', actualPath: 'b.png', threshold: 2 })).changedPixels, 0);
  await writeFile(path.join(f.root, 'wide.png'), image(2, 1, [0, 0, 0, 255, 0, 0, 0, 255]));
  await assert.rejects(() => f.service.compare({ baselinePath: 'a.png', actualPath: 'wide.png' }), (error) => error.code === 'IMAGE_DIMENSION_MISMATCH');
});

test('ImageComparisonService rejects invalid, oversized and path-escaping images', async (t) => {
  const f = await fixture(t, { maxImageBytes: 100, maxPixels: 4 });
  await writeFile(path.join(f.root, 'invalid.png'), 'not an image');
  await writeFile(path.join(f.root, 'valid.png'), image(1, 1, [0, 0, 0, 255]));
  await assert.rejects(() => f.service.compare({ baselinePath: 'invalid.png', actualPath: 'valid.png' }), (error) => error.code === 'IMAGE_FORMAT_INVALID');
  await writeFile(path.join(f.root, 'large.png'), Buffer.alloc(101));
  await assert.rejects(() => f.service.compare({ baselinePath: 'large.png', actualPath: 'valid.png' }), (error) => error.code === 'IMAGE_TOO_LARGE');
  await assert.rejects(() => f.service.compare({ baselinePath: '../outside.png', actualPath: 'valid.png' }), (error) => error.code === 'IMAGE_PATH_DENIED');
  assert.throws(() => encodeRgbaPng({ width: 3, height: 2, data: new Uint8Array(24), maxPixels: 4 }), (error) => error.code === 'IMAGE_PIXEL_LIMIT');
});

test('ImageComparisonService requires an optional backend for non-PNG inputs', async (t) => {
  const f = await fixture(t);
  await writeFile(path.join(f.root, 'photo.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  await writeFile(path.join(f.root, 'valid.png'), image(1, 1, [0, 0, 0, 255]));
  await assert.rejects(() => f.service.compare({ baselinePath: 'photo.jpg', actualPath: 'valid.png' }), (error) => error.code === 'IMAGE_BACKEND_UNAVAILABLE');
});
