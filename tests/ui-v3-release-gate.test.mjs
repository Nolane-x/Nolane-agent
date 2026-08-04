import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { verifyUiV3Release } from '../scripts/verify-ui-v3-release.mjs';
import { resolveUiRoot } from '../src/ui/ui-root-resolver.mjs';

test('UI v3 release gate passes source-local work while preserving external non-claims', async () => {
  const report = await verifyUiV3Release({ root: process.cwd(), write: false });
  assert.equal(report.sourceLocalPass, true);
  assert.equal(report.uiV3SourceLocalComplete, true);
  assert.equal(report.windows8GbCertified, false);
  assert.equal(report.screenReaderCertified, false);
  assert.equal(report.externalScreenshotCertified, false);
});

test('v3 root selection requires a matching manifest release receipt', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-v3-receipt-'));
  await mkdir(path.join(root, 'ui'));
  await mkdir(path.join(root, 'ui-dist'));
  await writeFile(path.join(root, 'ui-dist', 'manifest.json'), JSON.stringify({ uiVersion: 3, receiptSha256: 'a'.repeat(64) }));
  await writeFile(path.join(root, 'ui-dist', 'source-release.json'), JSON.stringify({ schema: 'nolane.ui.source-release.v1', manifestReceiptSha256: 'a'.repeat(64), sourceLocalVerified: true, receiptSha256: 'b'.repeat(64) }));
  const selected = resolveUiRoot({ appRoot: root, production: true });
  assert.equal(selected.version, 'v3');
  await writeFile(path.join(root, 'ui-dist', 'source-release.json'), JSON.stringify({ manifestReceiptSha256: 'c'.repeat(64), sourceLocalVerified: true, receiptSha256: 'b'.repeat(64) }));
  assert.throws(() => resolveUiRoot({ appRoot: root, production: true }), /receipt/i);
  const legacy = resolveUiRoot({ appRoot: root, requestedVersion: 'v2', production: true });
  assert.equal(legacy.version, 'v2');
});
