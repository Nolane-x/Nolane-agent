import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { verifyForgeOsVendor } from '../src/release/source-reconstruction.mjs';

test('ForgeOS vendor dependency is complete and bound to a path-size-sha256 manifest', async () => {
  const result = await verifyForgeOsVendor(process.cwd());
  assert.equal(result.status, 'pass');
  assert.ok(result.files > 100);
  assert.match(result.rootSha256, /^[a-f0-9]{64}$/);
  assert.ok(result.requiredModules.includes('src/core/canonical-json.mjs'));
  assert.ok(result.requiredModules.includes('src/core/orchestrator.mjs'));

  const canonical = await import('../vendor/forge-os/src/core/canonical-json.mjs');
  assert.equal(typeof canonical.canonicalSha256, 'function');
});

test('ForgeOS vendor verification detects byte tampering', async () => {
  const source = path.join(process.cwd(), 'vendor', 'forge-os');
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'forge-vendor-verify-'));
  try {
    const manifest = JSON.parse(await readFile(path.join(process.cwd(), 'vendor', 'forge-os.manifest.json'), 'utf8'));
    await import('node:fs/promises').then(({ cp, writeFile }) => cp(source, path.join(temporary, 'vendor', 'forge-os'), { recursive: true }).then(() => writeFile(path.join(temporary, 'vendor', 'forge-os.manifest.json'), `${JSON.stringify(manifest)}\n`)));
    const target = path.join(temporary, 'vendor', 'forge-os', manifest.files[0].relativePath);
    await import('node:fs/promises').then(({ appendFile }) => appendFile(target, '\nTAMPERED'));
    await assert.rejects(() => verifyForgeOsVendor(temporary), /(?:byte count|checksum) mismatch/i);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
