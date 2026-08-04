import { UpdateMigrationJournal } from './migration-journal.mjs';

const RUNNING = new Set(['running', 'executing', 'in_progress', 'active']);

function safeVersion(value) {
  const text = String(value ?? '');
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(text)) throw Object.assign(new TypeError('targetVersion is invalid'), { statusCode: 400, code: 'update_target_invalid' });
  return text;
}

export class UpdatePreparationService {
  constructor({ currentVersion, store, snapshotService, dataDir = null, journal = null } = {}) {
    if (!store?.listMissions) throw new TypeError('UpdatePreparationService requires StudioStore');
    if (!snapshotService?.create) throw new TypeError('UpdatePreparationService requires PreUpdateSnapshotService');
    this.currentVersion = safeVersion(currentVersion);
    this.store = store;
    this.snapshotService = snapshotService;
    this.journal = journal ?? new UpdateMigrationJournal({ dataDir });
  }

  async prepare({ targetVersion } = {}) {
    const target = safeVersion(targetVersion);
    const running = this.store.listMissions({}).filter((mission) => RUNNING.has(String(mission.status)));
    if (running.length) throw Object.assign(new Error('Running missions must checkpoint before update installation'), {
      statusCode: 409,
      code: 'update_active_missions',
      details: { missionIds: running.map((mission) => mission.id), count: running.length },
    });
    const snapshot = await this.snapshotService.create({ fromVersion: this.currentVersion, toVersion: target });
    const journal = await this.journal.prepare({ fromVersion: this.currentVersion, toVersion: target, snapshot });
    return Object.freeze({
      schema: 'nolane.update-preparation.v1',
      prepared: true,
      fromVersion: this.currentVersion,
      targetVersion: target,
      snapshotId: snapshot.snapshotId,
      snapshotManifestPath: snapshot.manifestPath,
      snapshotReceiptSha256: snapshot.receiptSha256,
      migrationJournalReceiptSha256: journal.receiptSha256,
      excludedCredentialMaterial: true,
      uncertifiedStores: snapshot.uncertifiedStores,
    });
  }

  async status() { return this.journal.read(); }

  async markPostUpdateRuntimeReady({ targetVersion } = {}) {
    return this.journal.markRuntimeReady({ targetVersion });
  }
}
