import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { resolveUiRoot } from '../src/ui/ui-root-resolver.mjs';

test('production v3 selection fails closed when ui-dist is missing', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-ui-root-'));
  await mkdir(path.join(root, 'ui'));
  assert.throws(() => resolveUiRoot({ appRoot: root, requestedVersion: 'v3', production: true }), /ui-dist/);
});

test('development can fall back to legacy UI but reports the fallback', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-ui-root-'));
  await mkdir(path.join(root, 'ui'));
  const result = resolveUiRoot({ appRoot: root, requestedVersion: 'v3', production: false });
  assert.equal(result.version, 'v2');
  assert.equal(result.fallback, true);
  assert.equal(result.root, path.join(root, 'ui'));
});
