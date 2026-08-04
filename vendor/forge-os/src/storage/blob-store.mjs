import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { canonicalStringify } from '../core/canonical-json.mjs';

function bytes(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'string') return Buffer.from(value, 'utf8');
  return Buffer.from(`${canonicalStringify(value)}\n`, 'utf8');
}

export class BlobStore {
  #root;
  constructor(root) { this.#root = path.resolve(root); }
  get root() { return this.#root; }
  #file(digest) {
    if (!/^[a-f0-9]{64}$/.test(digest)) throw new TypeError('Invalid blob digest');
    return path.join(this.#root, digest.slice(0, 2), digest.slice(2, 4), digest);
  }
  async put(value, { mimeType = 'application/json' } = {}) {
    const payload = bytes(value);
    const sha256 = createHash('sha256').update(payload).digest('hex');
    const file = this.#file(sha256);
    await mkdir(path.dirname(file), { recursive: true });
    try { await stat(file); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
      const handle = await open(temp, 'wx', 0o600);
      try { await handle.writeFile(payload); await handle.sync(); }
      finally { await handle.close(); }
      try { await rename(temp, file); }
      catch (renameError) {
        if (renameError.code !== 'EEXIST') throw renameError;
      } finally { await rm(temp, { force: true }).catch(() => {}); }
    }
    return { sha256, size: payload.byteLength, mimeType, uri: `forge://blob/${sha256}` };
  }
  async read(digest) { return readFile(this.#file(digest)); }
  async verify(digest) {
    try { return createHash('sha256').update(await this.read(digest)).digest('hex') === digest; }
    catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  }
}
