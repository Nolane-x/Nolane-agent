import { lstat, opendir, realpath } from 'node:fs/promises';
import path from 'node:path';

function boundedInteger(value, fallback, minimum, maximum, label) {
  const number = value == null ? fallback : Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) throw new TypeError(`${label} must be between ${minimum} and ${maximum}`);
  return number;
}

export async function measureWorkspace(root, { maxEntries = 100_000, maxBytes = Number.MAX_SAFE_INTEGER } = {}) {
  const entryLimit = boundedInteger(maxEntries, 100_000, 1, 1_000_000, 'maxEntries');
  const byteLimit = boundedInteger(maxBytes, Number.MAX_SAFE_INTEGER, 1, Number.MAX_SAFE_INTEGER, 'maxBytes');
  const resolvedRoot = await realpath(path.resolve(String(root ?? '')));
  const stack = [resolvedRoot];
  let bytes = 0;
  let files = 0;
  let directories = 1;
  let symlinks = 0;
  let entries = 0;
  let truncated = false;
  let reason = null;

  while (stack.length && !truncated) {
    const directory = stack.pop();
    const handle = await opendir(directory);
    try {
      for await (const entry of handle) {
        entries += 1;
        if (entries > entryLimit) { truncated = true; reason = 'entry-limit'; break; }
        const candidate = path.join(directory, entry.name);
        const info = await lstat(candidate);
        if (info.isSymbolicLink()) { symlinks += 1; continue; }
        if (info.isDirectory()) { directories += 1; stack.push(candidate); continue; }
        if (!info.isFile()) continue;
        files += 1;
        bytes += Number(info.size) || 0;
        if (bytes > byteLimit) { truncated = true; reason = 'byte-limit'; break; }
      }
    } finally {
      await handle.close().catch(() => {});
    }
  }

  return Object.freeze({ root: resolvedRoot, bytes, files, directories, symlinks, entries: Math.min(entries, entryLimit), truncated, reason });
}
