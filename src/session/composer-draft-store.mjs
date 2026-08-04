import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { COMPOSER_DRAFT_SCHEMA, SESSION_STATE_VERSION, normalizeComposerDraft, stateReceipt } from './session-state-schema.mjs';

const COLLECTION_SCHEMA = 'nolane.composer-drafts.v1';

async function atomicJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, file);
}

function cleanScope(value) {
  const scope = String(value ?? 'home').trim().slice(0, 128);
  if (!/^[a-z0-9][a-z0-9._:-]*$/i.test(scope)) throw Object.assign(new Error('Composer draft scope is invalid'), { statusCode: 400, code: 'composer_scope_invalid' });
  return scope;
}

export class ComposerDraftStore {
  constructor({ dataDir, clock = () => new Date().toISOString() } = {}) {
    this.clock = clock;
    this.file = path.join(path.resolve(String(dataDir ?? '.')), 'session', 'composer-drafts.json');
  }

  async #collection() {
    try {
      const value = JSON.parse(await readFile(this.file, 'utf8'));
      if (value.schema !== COLLECTION_SCHEMA || Number(value.version) !== SESSION_STATE_VERSION || !value.drafts || typeof value.drafts !== 'object') throw Object.assign(new Error('Composer draft collection is incompatible'), { statusCode: 409, code: 'composer_drafts_incompatible' });
      return value;
    } catch (error) {
      if (error.code === 'ENOENT') return { schema: COLLECTION_SCHEMA, version: SESSION_STATE_VERSION, drafts: {}, updatedAt: this.clock() };
      if (error instanceof SyntaxError) throw Object.assign(new Error('Composer draft collection is corrupt'), { statusCode: 409, code: 'composer_drafts_corrupt' });
      throw error;
    }
  }

  async get(scope = 'home') {
    const key = cleanScope(scope);
    const collection = await this.#collection();
    return collection.drafts[key] ? Object.freeze(structuredClone(collection.drafts[key])) : null;
  }

  async put(scope = 'home', input = {}) {
    const key = cleanScope(scope);
    const collection = await this.#collection();
    const now = this.clock();
    const normalized = normalizeComposerDraft(input, { scope: key });
    const draft = { ...normalized, schema: COMPOSER_DRAFT_SCHEMA, version: SESSION_STATE_VERSION, updatedAt: now };
    draft.receiptSha256 = stateReceipt(draft);
    collection.drafts[key] = draft;
    collection.updatedAt = now;
    await atomicJson(this.file, collection);
    return Object.freeze(structuredClone(draft));
  }

  async delete(scope = 'home') {
    const key = cleanScope(scope);
    const collection = await this.#collection();
    const existed = Boolean(collection.drafts[key]);
    delete collection.drafts[key];
    collection.updatedAt = this.clock();
    await atomicJson(this.file, collection);
    return Object.freeze({ schema: 'nolane.composer-draft-delete.v1', scope: key, deleted: existed });
  }
}
