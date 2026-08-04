import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createDeliveryManifest } from '../src/forensics/delivery-manifest.mjs';

test('delivery manifest content-addresses every artifact and rejects duplicates', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-delivery-'));
  await writeFile(path.join(root, 'a.txt'), 'a');
  await writeFile(path.join(root, 'b.txt'), 'bb');
  const manifest = await createDeliveryManifest({ root, artifactPaths: ['a.txt', 'b.txt'], checkpoint: 'c1', gitHead: 'a'.repeat(40) });
  assert.equal(manifest.artifacts.length, 2);
  assert.equal(manifest.artifacts[0].bytes, 1);
  assert.match(manifest.artifacts[0].sha256, /^[a-f0-9]{64}$/);
  await assert.rejects(() => createDeliveryManifest({ root, artifactPaths: ['a.txt', 'a.txt'], checkpoint: 'c1', gitHead: 'a'.repeat(40) }), /duplicate/i);
});

test('delivery manifest rejects missing artifacts', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-delivery-'));
  await assert.rejects(() => createDeliveryManifest({ root, artifactPaths: ['missing.zip'], checkpoint: 'c1', gitHead: 'a'.repeat(40) }), /missing/i);
});

test('checksum lines hash every requested file including the delivery manifest itself', async () => {
  const { createChecksumLines } = await import('../src/forensics/delivery-manifest.mjs');
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-checksum-lines-'));
  await writeFile(path.join(root, 'artifact.zip'), 'artifact');
  await writeFile(path.join(root, 'delivery-manifest.json'), '{"schema":"v1"}\n');
  const lines = await createChecksumLines({ root, artifactPaths: ['delivery-manifest.json', 'artifact.zip'] });
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^[a-f0-9]{64}  artifact\.zip$/);
  assert.match(lines[1], /^[a-f0-9]{64}  delivery-manifest\.json$/);
  await rm(root, { recursive: true, force: true });
});
