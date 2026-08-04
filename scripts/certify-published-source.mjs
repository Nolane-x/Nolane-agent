import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { certifyPublishedSourceArchive } from '../src/release/clean-room-certification.mjs';
import { loadReleaseNaming, releaseArtifactNames } from '../src/release/release-naming.mjs';

function sha256(value) { return createHash('sha256').update(value).digest('hex'); }

const root = path.resolve(process.argv[2] ?? '.');
const version = String(process.argv[3] ?? '').trim();
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) throw new TypeError('A semantic release version is required');
const naming = await loadReleaseNaming({ rootDirectory: root });
const names = releaseArtifactNames(naming, version);
const archivePath = path.join(root, 'release', names.sourceArchive);
const report = await certifyPublishedSourceArchive({
  archivePath,
  expectedVersion: version,
  expectedProduct: naming.product,
  probes: [
    { id: 'version-coherence', command: process.execPath, args: ['scripts/verify-version-coherence.mjs', '.'], timeoutMs: 120_000 },
    { id: 'evidence-freshness', command: process.execPath, args: ['scripts/verify-nolane-evidence-freshness.mjs'], timeoutMs: 120_000 },
    { id: 'evidence-quality', command: process.execPath, args: ['scripts/verify-nolane-evidence-quality.mjs'], timeoutMs: 120_000 },
    { id: 'full-node-suite', command: process.execPath, args: ['scripts/run-node-test-suite.mjs'], timeoutMs: 20 * 60_000 },
  ],
});
const reportName = `clean-room-certification-${version}.json`;
const reportPath = path.join(root, 'release', reportName);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o644 });

const manifestPath = path.join(root, 'release', `release-manifest-${version}.json`);
const releaseManifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const sourceArtifact = releaseManifest.artifacts?.find((artifact) => artifact.fileName === names.sourceArchive);
if (!sourceArtifact || sourceArtifact.sha256 !== report.archiveSha256) throw new Error('Clean-room report does not match the release source artifact');
const updatedManifest = {
  ...releaseManifest,
  certifications: {
    ...(releaseManifest.certifications ?? {}),
    cleanRoom: {
      status: 'pass', report: reportName, receiptSha256: report.receiptSha256,
      archiveSha256: report.archiveSha256, reportSha256: sha256(await readFile(reportPath)),
    },
  },
};
await writeFile(manifestPath, `${JSON.stringify(updatedManifest, null, 2)}\n`, { mode: 0o644 });
process.stdout.write(`${JSON.stringify({ status: report.status, version, report: `release/${reportName}`, receiptSha256: report.receiptSha256 })}\n`);
