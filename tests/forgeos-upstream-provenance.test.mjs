import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createForgeOsVendorManifest } from '../src/release/source-reconstruction.mjs';
import { verifyForgeOsUpstream } from '../src/nolane-native/forgeos-upstream-provenance.mjs';

async function fixture({ dirty = false } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-forgeos-upstream-'));
  const vendor = path.join(root, 'vendor', 'forge-os');
  await mkdir(path.join(vendor, 'src', 'core'), { recursive: true });
  await writeFile(path.join(vendor, 'src', 'core', 'canonical-json.mjs'), 'export const canonical = true;\n');
  await writeFile(path.join(vendor, 'src', 'core', 'orchestrator.mjs'), 'export const orchestrator = true;\n');
  await writeFile(path.join(vendor, 'package.json'), JSON.stringify({ version: '0.6.1', license: 'MIT' }));
  await writeFile(path.join(vendor, 'LICENSE'), 'MIT\n');
  await writeFile(path.join(vendor, 'project-manifest.json'), JSON.stringify({
    version: '0.6.1',
    source: { commit: 'a'.repeat(40), tree: 'b'.repeat(40), dirty },
  }));
  const manifest = await createForgeOsVendorManifest(root, { write: true });
  await writeFile(path.join(root, 'vendor', 'forge-os-upstream.json'), JSON.stringify({
    schema: 'nolane.forgeos.upstream.v1',
    repository: 'https://github.com/Nolane-x/forge-os',
    pinnedCommit: 'a'.repeat(40),
    pinnedTree: 'b'.repeat(40),
    version: '0.6.1',
    license: 'MIT',
    snapshotRootSha256: manifest.rootSha256,
    remoteHeadAtCheck: null,
    remoteHeadCheckedAt: null,
    remoteArchiveSha256: null,
  }, null, 2));
  return { root, vendor, manifest };
}

test('ForgeOS upstream verification binds the pinned source to the vendored manifest', async (t) => {
  const { root, manifest } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const result = await verifyForgeOsUpstream(root);
  assert.equal(result.status, 'pass');
  assert.equal(result.repository, 'https://github.com/Nolane-x/forge-os');
  assert.equal(result.pinnedCommit, 'a'.repeat(40));
  assert.equal(result.snapshotRootSha256, manifest.rootSha256);
  assert.equal(result.claims.sourceIdentityVerified, true);
  assert.equal(result.claims.remoteFreshnessVerified, false);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
});

test('ForgeOS upstream verification fails closed on a dirty or mismatched snapshot', async (t) => {
  const { root } = await fixture({ dirty: true });
  t.after(() => rm(root, { recursive: true, force: true }));
  const result = await verifyForgeOsUpstream(root);
  assert.equal(result.status, 'blocked');
  assert.equal(result.claims.sourceIdentityVerified, false);
  assert.match(result.blockers.join(' '), /dirty/i);
});

test('ForgeOS upstream verification reports a bounded blocked state when a portable subset lacks the full vendor manifest', async (t) => {
  const { root } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await rm(path.join(root, 'vendor', 'forge-os.manifest.json'));
  const result = await verifyForgeOsUpstream(root);
  assert.equal(result.status, 'blocked');
  assert.equal(result.claims.localManifestVerified, false);
  assert.match(result.blockers.join(' '), /manifest/i);
});
