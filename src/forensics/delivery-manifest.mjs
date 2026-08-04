import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export async function createDeliveryManifest({ root = process.cwd(), artifactPaths = [], checkpoint, gitHead } = {}) {
  if (!Array.isArray(artifactPaths) || artifactPaths.length === 0) throw new TypeError('artifactPaths must be a non-empty array');
  if (new Set(artifactPaths).size !== artifactPaths.length) throw new Error('Duplicate artifact path in delivery manifest');
  if (typeof checkpoint !== 'string' || checkpoint.length === 0) throw new TypeError('checkpoint is required');
  if (!/^[a-f0-9]{40,64}$/i.test(gitHead ?? '')) throw new TypeError('gitHead must be a Git object ID');
  const artifacts = [];
  const safeRoot = path.resolve(root);
  for (const artifactPath of [...artifactPaths].sort()) {
    const absolute = path.resolve(root, artifactPath);
    if (absolute !== safeRoot && !absolute.startsWith(`${safeRoot}${path.sep}`)) throw new Error(`Artifact path escapes root: ${artifactPath}`);
    let value;
    try { value = await stat(absolute); } catch (error) { if (error?.code === 'ENOENT') throw new Error(`Missing delivery artifact: ${artifactPath}`); throw error; }
    if (!value.isFile()) throw new Error(`Delivery artifact is not a file: ${artifactPath}`);
    const bytes = await readFile(absolute);
    artifacts.push(Object.freeze({ path: artifactPath.replaceAll('\\', '/'), bytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') }));
  }
  return Object.freeze({ schema: 'nolane.forensics.delivery-manifest.v1', checkpoint, gitHead, artifacts: Object.freeze(artifacts) });
}

export async function createChecksumLines({ root = process.cwd(), artifactPaths = [] } = {}) {
  if (!Array.isArray(artifactPaths) || artifactPaths.length === 0) throw new TypeError('artifactPaths must be a non-empty array');
  if (new Set(artifactPaths).size !== artifactPaths.length) throw new Error('Duplicate artifact path in checksum manifest');
  const safeRoot = path.resolve(root);
  const lines = [];
  for (const artifactPath of [...artifactPaths].sort()) {
    const absolute = path.resolve(root, artifactPath);
    if (absolute !== safeRoot && !absolute.startsWith(`${safeRoot}${path.sep}`)) throw new Error(`Artifact path escapes root: ${artifactPath}`);
    let value;
    try { value = await stat(absolute); } catch (error) { if (error?.code === 'ENOENT') throw new Error(`Missing checksum artifact: ${artifactPath}`); throw error; }
    if (!value.isFile()) throw new Error(`Checksum artifact is not a file: ${artifactPath}`);
    const bytes = await readFile(absolute);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    lines.push(`${sha256}  ${artifactPath.replaceAll('\\', '/')}`);
  }
  return Object.freeze(lines);
}
