import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalJson } from './canonical-json.mjs';

const SCHEMA = 'nolane.update-migration-journal.v1';

function version(value, label) {
  const text = String(value ?? '');
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(text)) throw new TypeError(`${label} is invalid`);
  return text;
}

function withReceipt(value) {
  const { receiptSha256: _old, ...base } = value;
  return Object.freeze({ ...base, receiptSha256: createHash('sha256').update(canonicalJson(base)).digest('hex') });
}

async function atomicWrite(file, value) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  await rename(temporary, file);
}

export class UpdateMigrationJournal {
  constructor({ dataDir, clock = () => new Date().toISOString() } = {}) {
    this.file = path.join(path.resolve(String(dataDir ?? '.')), 'updates', 'migration-journal.json');
    this.clock = clock;
  }

  async read() {
    try {
      const value = JSON.parse(await readFile(this.file, 'utf8'));
      if (value.schema !== SCHEMA) throw Object.assign(new Error('Update migration journal is incompatible'), { code: 'update_journal_incompatible' });
      return Object.freeze(structuredClone(value));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async prepare({ fromVersion, toVersion, snapshot } = {}) {
    const now = this.clock();
    const current = await this.read();
    const base = {
      ...(current && typeof current === 'object' ? current : {}),
      schema: SCHEMA,
      journalId: current?.journalId ?? `journal_${randomUUID().replaceAll('-', '')}`,
      fromVersion: version(fromVersion, 'fromVersion'),
      toVersion: version(toVersion, 'toVersion'),
      state: 'prepared',
      startedAt: current?.startedAt ?? now,
      updatedAt: now,
      completedAt: null,
      snapshot: {
        id: String(snapshot?.snapshotId ?? ''),
        manifestPath: String(snapshot?.manifestPath ?? ''),
        receiptSha256: String(snapshot?.receiptSha256 ?? ''),
      },
      steps: [
        { id: 'pre-update-snapshot', state: 'completed', completedAt: now, receiptSha256: String(snapshot?.receiptSha256 ?? '') },
        { id: 'runtime-schema-open', state: 'pending', completedAt: null, receiptSha256: null },
      ],
    };
    const journal = withReceipt(base);
    await atomicWrite(this.file, journal);
    return journal;
  }

  async markRuntimeReady({ targetVersion } = {}) {
    const current = await this.read();
    if (!current) return Object.freeze({ state: 'no-journal', targetVersion: version(targetVersion, 'targetVersion') });
    const target = version(targetVersion, 'targetVersion');
    if (current.toVersion !== target) return Object.freeze({ state: current.state, targetVersion: current.toVersion, currentVersion: target, receiptSha256: current.receiptSha256 });
    const now = this.clock();
    const steps = current.steps.map((step) => step.id === 'runtime-schema-open'
      ? { ...step, state: 'completed', completedAt: step.completedAt ?? now, receiptSha256: step.receiptSha256 ?? createHash('sha256').update(`${current.journalId}:${target}:runtime-schema-open`).digest('hex') }
      : step);
    const journal = withReceipt({ ...current, state: 'runtime-ready', steps, updatedAt: now, completedAt: now });
    await atomicWrite(this.file, journal);
    return journal;
  }
}
