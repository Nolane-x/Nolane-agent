import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SCHEMA = 'nolane.personalization-metadata.v1';
const MAX_HISTORY = 200;

async function readJson(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function atomicJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, file);
}

function initial(profileId, now) {
  return { schema: SCHEMA, profileId, revision: 0, createdAt: now, updatedAt: now, fields: {}, history: [], importedExtensions: {} };
}

export class PersonalizationMetadataStore {
  constructor({ dataDir, profileId = 'default', clock = () => new Date().toISOString() } = {}) {
    this.profileId = String(profileId || 'default');
    this.clock = clock;
    this.file = path.join(path.resolve(String(dataDir ?? '.')), 'personalization', `${this.profileId}.metadata.json`);
  }

  async read() {
    const value = await readJson(this.file);
    if (!value) return Object.freeze(initial(this.profileId, this.clock()));
    if (value.schema !== SCHEMA || value.profileId !== this.profileId) throw Object.assign(new Error('Personalization metadata is incompatible'), { code: 'personalization_metadata_incompatible' });
    return Object.freeze(structuredClone(value));
  }

  async record({ paths = [], source = 'explicit', receiptSha256 = null, importedExtensions = null } = {}) {
    const current = structuredClone(await this.read());
    const changedAt = this.clock();
    current.revision = Number(current.revision || 0) + 1;
    current.updatedAt = changedAt;
    for (const fieldPath of [...new Set(paths.map(String))]) current.fields[fieldPath] = { source: String(source), lastChangedAt: changedAt, revision: current.revision };
    if (importedExtensions && typeof importedExtensions === 'object') current.importedExtensions = structuredClone(importedExtensions);
    current.history.push({ revision: current.revision, source: String(source), changedAt, paths: [...new Set(paths.map(String))].sort(), receiptSha256 });
    current.history = current.history.slice(-MAX_HISTORY);
    await atomicJson(this.file, current);
    return Object.freeze(structuredClone(current));
  }
}
