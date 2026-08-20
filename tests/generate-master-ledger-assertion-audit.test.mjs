import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

import { evidenceFileSha256 } from '../src/release/evidence-file-hash.mjs';
import { generateMasterLedgerAssertionAudit } from '../scripts/generate-master-ledger-assertion-audit.mjs';

test('master ledger assertion audit uses the canonical evidence hash across Windows line endings', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'nolane-master-audit-'));
  const production = Buffer.from('export const ready = true;\r\n');
  const source = Buffer.from([
    "import test from 'node:test';",
    "import assert from 'node:assert/strict';",
    '',
    "test('accepts valid input', () => { assert.equal(true, true); });",
    "test('rejects invalid input', () => { assert.throws(() => { throw new Error('invalid'); }); });",
    '',
  ].join('\r\n'));
  const ledger = {
    requirements: [{
      id: 'R-canonical-evidence',
      status: 'verified',
      acceptance: {
        productionEntryPoints: ['src/feature.mjs'],
        testPaths: ['tests/feature.test.mjs'],
        evidenceHashes: {
          'src/feature.mjs': evidenceFileSha256(production),
          'tests/feature.test.mjs': evidenceFileSha256(source),
        },
      },
    }],
  };

  try {
    await Promise.all([
      mkdir(path.join(root, 'requirements'), { recursive: true }),
      mkdir(path.join(root, 'src'), { recursive: true }),
      mkdir(path.join(root, 'tests'), { recursive: true }),
    ]);
    await Promise.all([
      writeFile(path.join(root, 'requirements/master-acceptance-ledger.json'), JSON.stringify(ledger)),
      writeFile(path.join(root, 'src/feature.mjs'), production),
      writeFile(path.join(root, 'tests/feature.test.mjs'), source),
    ]);

    const { report } = await generateMasterLedgerAssertionAudit({ root, write: false });

    assert.equal(report.summary.assertionVerified, 1);
    assert.equal(report.summary.assertionUnbound, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
