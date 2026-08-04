import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { SESSION_RESTORE_SCHEMA, SESSION_STATE_VERSION, initialSessionRestore, normalizeSessionRestorePatch, stateReceipt } from './session-state-schema.mjs';

async function atomicJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, file);
}

export class SessionRestoreStore {
  constructor({ dataDir, clock = () => new Date().toISOString() } = {}) {
    this.clock = clock;
    this.file = path.join(path.resolve(String(dataDir ?? '.')), 'session', 'restore.json');
  }

  async read() {
    try {
      const value = JSON.parse(await readFile(this.file, 'utf8'));
      if (value.schema !== SESSION_RESTORE_SCHEMA || Number(value.version) !== SESSION_STATE_VERSION) throw Object.assign(new Error('Session restore state is incompatible'), { statusCode: 409, code: 'session_restore_incompatible' });
      return Object.freeze(structuredClone(value));
    } catch (error) {
      if (error.code === 'ENOENT') return initialSessionRestore(this.clock());
      if (error instanceof SyntaxError) throw Object.assign(new Error('Session restore state is corrupt'), { statusCode: 409, code: 'session_restore_corrupt' });
      throw error;
    }
  }

  async update(input = {}) {
    const current = structuredClone(await this.read());
    const patch = normalizeSessionRestorePatch(input);
    const now = this.clock();
    const next = { ...current, ...structuredClone(patch), schema: SESSION_RESTORE_SCHEMA, version: SESSION_STATE_VERSION, createdAt: current.createdAt ?? now, updatedAt: now };
    delete next.receiptSha256;
    next.receiptSha256 = stateReceipt(next);
    await atomicJson(this.file, next);
    return Object.freeze(structuredClone(next));
  }
}
