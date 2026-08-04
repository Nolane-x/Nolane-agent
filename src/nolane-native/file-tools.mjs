import { lstat, realpath, readFile, writeFile, rename, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function within(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function createFileTools({ workspaceRoot }) {
  if (!workspaceRoot) throw new TypeError('workspaceRoot is required');
  const root = path.resolve(workspaceRoot);

  async function resolveExisting(relativePath) {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)) throw new Error('file path traversal or outside workspace');
    const lexical = path.resolve(root, relativePath);
    if (!within(root, lexical)) throw new Error('file path traversal or outside workspace');
    const info = await lstat(lexical);
    if (info.isSymbolicLink()) throw new Error('symlink paths are denied');
    const resolved = await realpath(lexical);
    const realRoot = await realpath(root);
    if (!within(realRoot, resolved)) throw new Error('file is outside workspace');
    return { lexical, resolved, info };
  }

  return {
    async read(relativePath) {
      const { resolved, info } = await resolveExisting(relativePath);
      if (!info.isFile()) throw new Error('path is not a file');
      const bytes = await readFile(resolved);
      return { path: relativePath.replaceAll('\\', '/'), content: bytes.toString('utf8'), sha256: sha256(bytes), size: bytes.length };
    },

    async write(relativePath, content, { expectedSha256 } = {}) {
      const { resolved, info } = await resolveExisting(relativePath);
      if (!info.isFile()) throw new Error('path is not a file');
      const current = await readFile(resolved);
      const currentSha256 = sha256(current);
      if (expectedSha256 && expectedSha256 !== currentSha256) throw new Error('file conflict: expected sha256 does not match current file');
      const bytes = Buffer.from(String(content), 'utf8');
      const temp = `${resolved}.nolane-tmp-${process.pid}-${Date.now()}`;
      await mkdir(path.dirname(resolved), { recursive: true });
      await writeFile(temp, bytes, { mode: info.mode });
      await rename(temp, resolved);
      return { path: relativePath.replaceAll('\\', '/'), previousSha256: currentSha256, contentSha256: sha256(bytes), size: bytes.length };
    },

    async search(query) {
      const needle = String(query ?? '');
      if (!needle) return [];
      const results = [];
      const realRoot = await realpath(root);
      async function walk(directory) {
        const entries = await readdir(directory, { withFileTypes: true });
        entries.sort((a, b) => a.name.localeCompare(b.name));
        for (const entry of entries) {
          if (entry.isSymbolicLink()) continue;
          const absolute = path.join(directory, entry.name);
          if (entry.isDirectory()) await walk(absolute);
          else if (entry.isFile()) {
            const bytes = await readFile(absolute);
            const content = bytes.toString('utf8');
            if (content.includes(needle)) results.push({ path: path.relative(realRoot, absolute).replaceAll('\\', '/'), sha256: sha256(bytes) });
          }
        }
      }
      await walk(realRoot);
      return results;
    }
  };
}
