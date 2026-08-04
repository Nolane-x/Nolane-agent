import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BrandMigrationAuditor, auditCurrentBranding } from '../src/branding/brand-migration-auditor.mjs';

test('BrandMigrationAuditor finds active legacy branding but allows explicit historical and alias records', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-brand-'));
  try {
    await mkdir(path.join(root, 'ui-v3'), { recursive: true });
    await writeFile(path.join(root, 'ui-v3', 'active.html'), '<h1>Forge Studio workspace</h1>');
    await writeFile(path.join(root, 'HISTORY.md'), 'Historical Forge Studio 4.0 record');
    await writeFile(path.join(root, 'aliases.json'), JSON.stringify({ legacyProductNames: ['ForgeStudio'] }));
    const auditor = new BrandMigrationAuditor({ legacyNames: ['ForgeStudio', 'Forge Studio'] });
    const report = await auditor.audit({ root, activePaths: ['ui-v3/active.html', 'HISTORY.md', 'aliases.json'], allowedLegacyPaths: ['HISTORY.md', 'aliases.json'] });
    assert.deepEqual(report.findings.map((item) => item.path), ['ui-v3/active.html']);
    assert.equal(report.complete, false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('current Nolane Agent documentation, onboarding, examples and screenshot metadata pass brand audit', async () => {
  const report = await auditCurrentBranding({ root: process.cwd() });
  assert.deepEqual(report.findings, []);
  assert.equal(report.complete, true);
  assert.equal(report.currentDocs.includes('docs/NOLANE-AGENT-ONBOARDING.md'), true);
  assert.equal(report.currentDocs.includes('docs/NOLANE-AGENT-EXAMPLES.md'), true);
  assert.equal(report.screenshots.includes('docs/screenshots/nolane-agent-ui-v3.svg'), true);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
});
