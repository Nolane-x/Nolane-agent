import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const normalizePath = (value) => String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, '');

function frozen(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) frozen(item);
    return Object.freeze(value);
  }
  for (const item of Object.values(value)) frozen(item);
  return Object.freeze(value);
}

function runGit(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }).trim();
}

function normalizeOverlays(overlays = []) {
  return overlays.map((overlay) => {
    const content = String(overlay?.content ?? '');
    const computed = createHash('sha256').update(content).digest('hex');
    const sourceHash = String(overlay?.sha256 ?? computed).toLowerCase();
    if (!SHA256.test(sourceHash) || sourceHash !== computed) throw new TypeError(`editor overlay SHA-256 mismatch: ${overlay?.path ?? 'unknown'}`);
    const overlayPath = normalizePath(overlay?.path);
    if (!overlayPath) throw new TypeError('editor overlay path is required');
    return frozen({
      path: overlayPath,
      content,
      sha256: sourceHash,
      overlayId: String(overlay?.overlayId ?? `editor:${overlayPath}`),
    });
  }).sort((left, right) => left.path.localeCompare(right.path) || left.overlayId.localeCompare(right.overlayId));
}

function parseStatus(raw) {
  const parts = String(raw ?? '').split('\0').filter(Boolean);
  const changes = [];
  for (let index = 0; index < parts.length; index += 1) {
    const record = parts[index];
    const status = record.slice(0, 2);
    let filePath = normalizePath(record.slice(3));
    let originalPath = null;
    if (/^[RC]/.test(status) && parts[index + 1]) {
      originalPath = filePath;
      filePath = normalizePath(parts[index + 1]);
      index += 1;
    }
    changes.push(frozen({ status, path: filePath, originalPath }));
  }
  return changes.sort((left, right) => left.path.localeCompare(right.path));
}

export class RepositoryWorkspaceStateAdapter {
  inspect(workspaceRoot, { editorOverlays = [] } = {}) {
    const root = path.resolve(String(workspaceRoot));
    const overlays = normalizeOverlays(editorOverlays);
    const editorOverlayHash = overlays.length === 0 ? null : canonicalSha256(overlays.map(({ path: overlayPath, sha256, overlayId }) => ({ path: overlayPath, sha256, overlayId })));
    try {
      const branch = runGit(root, ['branch', '--show-current']) || null;
      const worktree = normalizePath(runGit(root, ['rev-parse', '--show-toplevel']));
      const headSha = runGit(root, ['rev-parse', 'HEAD']).toLowerCase();
      const rawStatus = execFileSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
      const uncommittedChanges = parseStatus(rawStatus);
      const dirtyHash = uncommittedChanges.length === 0 ? 'clean' : canonicalSha256(uncommittedChanges);
      const base = { available: true, branch, worktree, headSha, dirtyHash, editorOverlayHash, uncommittedChanges, editorOverlays: overlays };
      return frozen({ ...base, fingerprint: canonicalSha256(base) });
    } catch (error) {
      const base = {
        available: false,
        branch: null,
        worktree: normalizePath(root),
        headSha: null,
        dirtyHash: 'unknown',
        editorOverlayHash,
        uncommittedChanges: [],
        editorOverlays: overlays,
        reason: String(error?.message ?? error).slice(0, 500),
      };
      return frozen({ ...base, fingerprint: canonicalSha256(base) });
    }
  }
}
