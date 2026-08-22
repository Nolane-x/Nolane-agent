import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyCheckpoint10UxFoundation } from '../src/release/checkpoint-10-ux-foundation-verifier.mjs';
import { PRODUCT_IDENTITY } from '../src/product-identity.mjs';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const CURRENT_RELEASE_VERSION = PRODUCT_IDENTITY.version;

test('checkpoint 10 UX foundation verifier binds backend UI model profiles summary resizing and non-claims', async () => {
  const report = await verifyCheckpoint10UxFoundation({ rootDirectory: process.cwd() });
  assert.equal(report.status, 'pass');
  assert.equal(report.version, CURRENT_RELEASE_VERSION);
  assert.equal(report.failures.length, 0);
  assert.equal(report.coverage.settingsBackend, true);
  assert.equal(report.coverage.settingsUi, true);
  assert.equal(report.coverage.modelProfiles, true);
  assert.equal(report.coverage.outputSummary, true);
  assert.equal(report.coverage.resizableShell, true);
  assert.equal(report.coverage.responsiveAccessibility, true);
  assert.equal(report.claims.providerRealCertified, false);
  assert.equal(report.claims.windowsExternalCertified, false);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
});

test('checkpoint 10 verification script uses the current release identity', async () => {
  const { stdout } = await execFileAsync(process.execPath, ['scripts/verify-checkpoint-10-ux-foundation.mjs']);
  const report = JSON.parse(stdout);
  assert.equal(report.status, 'pass');
  assert.equal(report.version, CURRENT_RELEASE_VERSION);
});


test('full release matrix and documentation include the checkpoint 10 UX foundation gate', async () => {
  const [matrix, checkpoint, catalog] = await Promise.all([
    readFile(new URL('../src/release/full-release-matrix.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../docs/CHECKPOINT-10-UX-FOUNDATION.md', import.meta.url), 'utf8'),
    readFile(new URL('../docs/MODEL-PROFILE-CATALOG.md', import.meta.url), 'utf8'),
  ]);
  assert.match(matrix, /checkpoint-10-ux-foundation/);
  assert.match(checkpoint, /Standard.*Research/s);
  assert.match(checkpoint, /Full Release Matrix/);
  assert.match(catalog, /Unknown is not unsupported/);
  assert.match(catalog, /provider documentation/);
});
