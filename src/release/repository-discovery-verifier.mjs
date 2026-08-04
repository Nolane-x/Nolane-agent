import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { RepositoryDiscoveryService } from '../repository/repository-discovery-service.mjs';

function assertVersion(value) {
  const version = String(value ?? '').trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new TypeError('Repository discovery verification requires a stable semantic version');
  return version;
}

function evidenceEntries(snapshot) {
  const output = [];
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.path === 'string' && Number.isInteger(value.startLine) && typeof value.sha256 === 'string') output.push(value);
    for (const child of Object.values(value)) visit(child);
  };
  visit(snapshot);
  return output;
}

function validateEvidence(snapshot) {
  const failures = [];
  for (const item of evidenceEntries(snapshot)) {
    if (!item.path || path.isAbsolute(item.path) || item.path.includes('..')) failures.push(`unsafe evidence path: ${item.path}`);
    if (item.startLine < 1 || item.endLine < item.startLine) failures.push(`invalid evidence lines: ${item.path}`);
    if (!/^[a-f0-9]{64}$/.test(item.sha256)) failures.push(`invalid evidence hash: ${item.path}`);
  }
  return failures;
}

export async function verifyRepositoryDiscovery({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory);
  const releaseVersion = assertVersion(version);
  const project = Object.freeze({ id: 'release-source', name: 'Forge Studio source', workspaceRoot: root });
  const store = { getProject: (id) => id === project.id ? project : null };
  const service = new RepositoryDiscoveryService({ version: releaseVersion, store });
  const snapshot = await service.snapshot({ projectId: project.id, principalId: 'release-matrix', refresh: true });
  const failures = validateEvidence(snapshot);
  if (snapshot.version !== releaseVersion) failures.push('snapshot version mismatch');
  if (!Array.isArray(snapshot.languages) || snapshot.languages.length === 0) failures.push('no source language detected');
  if (!Array.isArray(snapshot.packageManagers) || snapshot.packageManagers.length === 0) failures.push('no package manager detected');
  if (snapshot.commands?.test?.status !== 'detected') failures.push('test command is not evidenced');
  if (!Array.isArray(snapshot.configs) || !snapshot.configs.some((item) => item.path === 'package.json')) failures.push('package.json configuration evidence is missing');
  if (!/^[a-f0-9]{64}$/.test(String(snapshot.receiptSha256 ?? ''))) failures.push('snapshot receipt is invalid');
  const reportBase = {
    schema: 'forge.studio.repository-discovery-verification.v1',
    version: releaseVersion,
    status: failures.length === 0 ? 'pass' : 'fail',
    requiredEvidence: Object.freeze(['languages', 'package-managers', 'test-command', 'package-config', 'safe-relative-evidence']),
    failures: Object.freeze(failures),
    snapshot,
  };
  const report = Object.freeze({ ...reportBase, receiptSha256: canonicalSha256(reportBase) });
  if (outputFile) {
    const target = path.resolve(outputFile);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(report, null, 2)}\n`);
  }
  if (failures.length > 0) {
    const error = new Error(`Repository discovery verification failed: ${failures.join('; ')}`);
    error.code = 'REPOSITORY_DISCOVERY_VERIFICATION_FAILED';
    error.report = report;
    throw error;
  }
  return report;
}
