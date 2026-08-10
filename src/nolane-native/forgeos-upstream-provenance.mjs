import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { verifyForgeOsVendor } from './forgeos-vendor-manifest.mjs';

const REPOSITORY = 'https://github.com/Nolane-x/forge-os';
const SHA = /^[a-f0-9]{40,64}$/i;

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const freeze = (value) => Object.freeze(value);

async function json(file, label) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    throw new Error(`ForgeOS ${label} is unavailable or invalid: ${error.message}`, { cause: error });
  }
}

function requiredSha(value, label) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!SHA.test(normalized)) throw new Error(`ForgeOS ${label} must be a hexadecimal commit or tree id`);
  return normalized;
}

function optionalSha(value, label) {
  if (value == null || value === '') return null;
  return requiredSha(value, label);
}

/**
 * Verify the local ForgeOS snapshot without pretending that a vendored copy is
 * a freshly fetched or externally certified upstream source.
 *
 * The vendor manifest proves the exact local file tree. UPSTREAM.json binds
 * that tree to a declared repository/commit, while remote freshness remains a
 * separate claim until a current remote ref and archive digest are recorded.
 */
export async function verifyForgeOsUpstream(rootDirectory = process.cwd()) {
  const root = path.resolve(rootDirectory);
  const vendorRoot = path.join(root, 'vendor', 'forge-os');
  const metadata = await json(path.join(root, 'vendor', 'forge-os-upstream.json'), 'upstream metadata');
  const project = await json(path.join(vendorRoot, 'project-manifest.json'), 'project manifest');
  const packageMetadata = await json(path.join(vendorRoot, 'package.json'), 'package metadata');

  if (metadata.schema !== 'nolane.forgeos.upstream.v1') throw new Error('ForgeOS upstream metadata schema is invalid');
  if (metadata.repository !== REPOSITORY) throw new Error('ForgeOS upstream repository is not the designated Nolane source');
  const pinnedCommit = requiredSha(metadata.pinnedCommit, 'pinnedCommit');
  const pinnedTree = requiredSha(metadata.pinnedTree, 'pinnedTree');
  const snapshotCommit = requiredSha(project.source?.commit, 'snapshot commit');
  const snapshotTree = requiredSha(project.source?.tree, 'snapshot tree');
  const blockers = [];
  let vendorVerification;
  try {
    vendorVerification = await verifyForgeOsVendor(root);
  } catch (error) {
    vendorVerification = { status: 'blocked', rootSha256: null, files: null };
    blockers.push(`local ForgeOS vendor manifest could not be verified: ${String(error.message).slice(0, 240)}`);
  }

  if (snapshotCommit !== pinnedCommit) blockers.push('snapshot commit does not match pinned commit');
  if (snapshotTree !== pinnedTree) blockers.push('snapshot tree does not match pinned tree');
  if (String(metadata.version) !== String(project.version ?? packageMetadata.version)) blockers.push('release version does not match project metadata');
  if (String(metadata.license) !== String(packageMetadata.license ?? 'MIT')) blockers.push('license does not match package metadata');
  if (vendorVerification.rootSha256 && String(metadata.snapshotRootSha256 ?? '').toLowerCase() !== String(vendorVerification.rootSha256).toLowerCase()) blockers.push('snapshot root checksum does not match vendor manifest');
  if (project.source?.dirty === true) blockers.push('vendored ForgeOS snapshot is marked dirty');

  const remoteHead = optionalSha(metadata.remoteHeadAtCheck, 'remoteHeadAtCheck');
  const remoteArchive = optionalSha(metadata.remoteArchiveSha256, 'remoteArchiveSha256');
  const remoteFreshnessVerified = remoteHead === pinnedCommit && Boolean(remoteArchive);
  const base = {
    schema: 'nolane.forgeos.upstream-verification.v1',
    status: blockers.length ? 'blocked' : 'pass',
    repository: metadata.repository,
    pinnedCommit,
    pinnedTree,
    snapshotCommit,
    snapshotTree,
    releaseVersion: String(project.version ?? packageMetadata.version ?? metadata.version),
    license: String(packageMetadata.license ?? metadata.license ?? 'unknown'),
    snapshotRootSha256: vendorVerification.rootSha256 ?? null,
    vendorFiles: vendorVerification.files,
    remoteHeadAtCheck: remoteHead,
    remoteArchiveSha256: remoteArchive,
    blockers: freeze([...blockers]),
    claims: freeze({
      sourceIdentityVerified: blockers.length === 0,
      localManifestVerified: vendorVerification.status === 'pass',
      remoteFreshnessVerified,
      externallyCertified: false,
    }),
  };
  return freeze({ ...base, receiptSha256: sha256(JSON.stringify(base)) });
}
