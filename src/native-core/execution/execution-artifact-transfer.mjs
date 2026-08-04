import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
const inside = (root, candidate) => { const relative = path.relative(root, candidate); return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)); };
export class ExecutionArtifactTransfer {
  constructor({ sourceRoot, targetRoot, maxBytes = 100 * 1024 * 1024 } = {}) { if (!sourceRoot || !targetRoot) throw new TypeError('sourceRoot and targetRoot are required'); this.sourceRoot = path.resolve(sourceRoot); this.targetRoot = path.resolve(targetRoot); this.maxBytes = Math.max(1, Number(maxBytes) || 1); }
  async copy(sourceRelative, targetRelative) {
    const source = path.resolve(this.sourceRoot, String(sourceRelative)); const target = path.resolve(this.targetRoot, String(targetRelative));
    if (!inside(this.sourceRoot, source) || !inside(this.targetRoot, target)) throw Object.assign(new Error('Artifact path escape'), { code: 'PATH_OUTSIDE_ROOT' });
    const stat = await lstat(source); if (stat.isSymbolicLink()) throw Object.assign(new Error('Artifact symlinks are forbidden'), { code: 'SYMLINK_FORBIDDEN' }); if (!stat.isFile()) throw Object.assign(new Error('Artifact source must be a file'), { code: 'INVALID_ARTIFACT' }); if (stat.size > this.maxBytes) throw Object.assign(new Error('Artifact exceeds byte budget'), { code: 'ARTIFACT_TOO_LARGE' });
    const realSourceRoot = await realpath(this.sourceRoot); const realSource = await realpath(source); if (!inside(realSourceRoot, realSource)) throw Object.assign(new Error('Artifact symlink escape'), { code: 'SYMLINK_FORBIDDEN' });
    await mkdir(path.dirname(target), { recursive: true }); await copyFile(realSource, target); const bytes = await readFile(target); const sha256 = createHash('sha256').update(bytes).digest('hex');
    return Object.freeze({ schema: 'nolane.execution-artifact-transfer.v1', source: String(sourceRelative), target: String(targetRelative), bytes: bytes.length, sha256 });
  }
}
