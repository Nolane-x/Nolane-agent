import path from 'node:path';
import { canonicalSha256 } from '../core/canonical-json.mjs';
import { scanSkillPackage } from './security-scanner.mjs';

const MAX_FILES = 200;
const MAX_FILE_BYTES = 1_024 * 1_024;
const MAX_TOTAL_BYTES = 5 * 1_024 * 1_024;
const SHA256 = /^[a-f0-9]{64}$/;
const SOURCE_ID = /^[a-z0-9][a-z0-9._-]{2,159}$/;
const KNOWN_LICENSES = new Set(['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'MPL-2.0']);

function finding(code, severity, message) {
  return Object.freeze({ code, severity, file: null, message });
}

function normalizedPath(value) {
  const raw = String(value ?? '');
  const normalized = path.posix.normalize(raw.replaceAll('\\', '/'));
  if (!raw || raw.includes('\0') || normalized === '.' || normalized === '..' || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) return null;
  return normalized;
}

function normalizedContent(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n');
}

function sourceFindings(source) {
  const findings = [];
  if (!SOURCE_ID.test(String(source?.sourceId ?? ''))) findings.push(finding('source-id-invalid', 'review', 'Source identifier must be a stable lowercase identifier.'));
  if (typeof source?.sourceCoordinate !== 'string' || !source.sourceCoordinate.trim()) findings.push(finding('source-coordinate-missing', 'review', 'Source coordinate must bind the bundle to an immutable snapshot.'));
  if (!SHA256.test(String(source?.snapshotSha256 ?? '').toLowerCase())) findings.push(finding('source-snapshot-invalid', 'review', 'Source snapshot must have a SHA-256 digest.'));
  return findings;
}

function structureFindings(files) {
  const findings = [];
  const manifests = files.filter((file) => path.posix.basename(file.path).toLowerCase() === 'skill.md');
  if (manifests.length !== 1) findings.push(finding('skill-root-invalid', 'blocker', 'A skill intake bundle must contain exactly one SKILL.md root.'));
  const manifest = manifests[0];
  if (manifest && (!manifest.content.startsWith('---\n') || !/^name:\s*.+$/m.test(manifest.content) || !/^description:\s*.+$/m.test(manifest.content))) findings.push(finding('skill-frontmatter-incomplete', 'review', 'SKILL.md must declare name and description frontmatter.'));
  return findings;
}

export function assessSkillIntake({ source, files, existingContentDigests = [] } = {}) {
  const findings = [...sourceFindings(source)];
  if (!Array.isArray(files) || files.length === 0 || files.length > MAX_FILES) findings.push(finding('file-count-invalid', 'blocker', `Intake must contain 1-${MAX_FILES} files.`));
  const seen = new Set();
  let totalBytes = 0;
  const safeFiles = [];
  for (const item of Array.isArray(files) ? files : []) {
    const normalized = normalizedPath(item?.path);
    if (typeof item?.content !== 'string') {
      findings.push(finding('content-invalid', 'blocker', 'Intake file content must be text.'));
      continue;
    }
    const content = normalizedContent(item?.content);
    const bytes = Buffer.byteLength(content, 'utf8');
    if (!normalized) {
      findings.push(finding('path-invalid', 'blocker', 'Intake file path escapes or is outside the skill bundle.'));
      continue;
    }
    if (seen.has(normalized)) {
      findings.push(finding('path-duplicate', 'blocker', `Intake repeats ${normalized}.`));
      continue;
    }
    seen.add(normalized);
    totalBytes += bytes;
    if (bytes > MAX_FILE_BYTES) findings.push(finding('file-too-large', 'blocker', `${normalized} exceeds the per-file limit.`));
    safeFiles.push(Object.freeze({ path: normalized, content, bytes }));
  }
  if (totalBytes > MAX_TOTAL_BYTES) findings.push(finding('bundle-too-large', 'blocker', 'Intake bundle exceeds the total byte limit.'));
  findings.push(...structureFindings(safeFiles));
  const scan = scanSkillPackage(safeFiles, { sourceId: source?.sourceId, permissions: source?.permissions ?? [] });
  findings.push(...scan.findings.map((item) => Object.freeze({ ...item })));
  const licenseSpdx = String(source?.license ?? '').trim();
  const license = Object.freeze({ spdx: licenseSpdx || 'UNKNOWN', mode: KNOWN_LICENSES.has(licenseSpdx) ? 'vendor-allowed' : 'link-only', ambiguous: !KNOWN_LICENSES.has(licenseSpdx) });
  if (license.ambiguous) findings.push(finding('license-review-required', 'review', 'Unknown or ambiguous licenses require manual review.'));
  const canonicalFiles = safeFiles.map(({ path: filePath, content }) => ({ path: filePath, content })).sort((a, b) => a.path.localeCompare(b.path));
  const packageSha256 = canonicalSha256(canonicalFiles);
  const manifest = safeFiles.find((file) => path.posix.basename(file.path).toLowerCase() === 'skill.md');
  const contentDigest = manifest ? canonicalSha256(manifest.content) : canonicalSha256('');
  const normalizedKnown = new Set(existingContentDigests.map((value) => String(value).toLowerCase()));
  const blockers = findings.filter((item) => item.severity === 'blocker');
  const reviews = findings.filter((item) => item.severity === 'review' || item.severity === 'warning');
  const status = blockers.length ? 'quarantined' : normalizedKnown.has(contentDigest) ? 'duplicate' : reviews.length ? 'review' : 'candidate';
  const estimatedTokens = Math.ceil(safeFiles.reduce((sum, file) => sum + file.bytes, 0) / 4);
  return Object.freeze({
    schemaVersion: 1,
    status,
    packageSha256,
    contentDigest,
    archiveSha256: String(source?.snapshotSha256 ?? '').toLowerCase(),
    license,
    estimatedTokens,
    findings: Object.freeze(findings),
    files: Object.freeze(canonicalFiles.map((file) => Object.freeze(file))),
  });
}
