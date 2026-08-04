import { randomUUID } from 'node:crypto';
import { mkdir, open, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { canonicalSha256, canonicalStringify } from '../core/canonical-json.mjs';

const UNSUPPORTED_DIRECTORY_SYNC = new Set(['EPERM', 'EINVAL', 'EISDIR']);

async function defaultDirectorySync(directory) {
  const handle = await open(directory, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function atomicWriteJson(file, value, {
  serialize = canonicalStringify,
  syncDirectory = defaultDirectorySync,
} = {}) {
  const target = path.resolve(file);
  const directory = path.dirname(target);
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  let handle;
  try {
    await mkdir(directory, { recursive: true });
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(`${serialize(value)}\n`, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporary, target);
    let directorySync = 'completed';
    try {
      await syncDirectory(directory);
    } catch (error) {
      if (!UNSUPPORTED_DIRECTORY_SYNC.has(error?.code)) throw error;
      directorySync = 'unsupported';
    }
    return Object.freeze({
      sha256: canonicalSha256(value),
      durability: Object.freeze({ fileSync: 'completed', directorySync }),
    });
  } catch (error) {
    await handle?.close().catch(() => {});
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}
