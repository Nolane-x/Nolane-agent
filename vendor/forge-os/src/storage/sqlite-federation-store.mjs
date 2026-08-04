import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { canonicalSha256 } from '../core/canonical-json.mjs';

export class SqliteFederationCatalogStore {
  constructor(file, { busyTimeoutMs = 5_000 } = {}) {
    this.file = path.resolve(file);
    mkdirSync(path.dirname(this.file), { recursive: true });
    this.db = new DatabaseSync(this.file);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=${Math.max(1, Math.floor(busyTimeoutMs))};`);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS forge_federation_meta (
        singleton INTEGER PRIMARY KEY CHECK(singleton=1),
        schema_version INTEGER NOT NULL,
        revision INTEGER NOT NULL,
        head_sha256 TEXT
      ) STRICT;
      CREATE TABLE IF NOT EXISTS forge_federation_providers (
        provider_id TEXT PRIMARY KEY,
        capability_id TEXT NOT NULL,
        status TEXT NOT NULL,
        source_id TEXT NOT NULL,
        payload TEXT NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS forge_federation_capability_idx ON forge_federation_providers(capability_id,status);
      CREATE TABLE IF NOT EXISTS forge_federation_events (
        revision INTEGER PRIMARY KEY,
        event_id TEXT NOT NULL UNIQUE,
        at TEXT NOT NULL,
        prev_sha256 TEXT,
        providers_sha256 TEXT NOT NULL,
        event_sha256 TEXT NOT NULL UNIQUE,
        payload TEXT NOT NULL
      ) STRICT;
    `);
  }
  close() { this.db.close(); }
  async health() { try { this.db.prepare('SELECT 1').get(); return { ok: true, backend: 'sqlite-wal' }; } catch (error) { return { ok: false, backend: 'sqlite-wal', reason: error.code ?? 'sqlite-error' }; } }
  async initialize() {
    this.db.prepare('INSERT OR IGNORE INTO forge_federation_meta(singleton,schema_version,revision,head_sha256) VALUES(1,1,0,NULL)').run();
    return this.read();
  }
  #providers() { return this.db.prepare('SELECT payload FROM forge_federation_providers ORDER BY provider_id').all().map((row) => JSON.parse(row.payload)); }
  #events() { return this.db.prepare('SELECT payload FROM forge_federation_events ORDER BY revision').all().map((row) => JSON.parse(row.payload)); }
  async read() {
    const meta = this.db.prepare('SELECT schema_version,revision,head_sha256 FROM forge_federation_meta WHERE singleton=1').get();
    if (!meta) return this.initialize();
    return { schemaVersion: meta.schema_version, revision: meta.revision, providers: this.#providers(), events: this.#events(), headSha256: meta.head_sha256 };
  }
  #begin(expectedRevision) {
    this.db.exec('BEGIN IMMEDIATE');
    const meta = this.db.prepare('SELECT revision,head_sha256 FROM forge_federation_meta WHERE singleton=1').get();
    if (!meta) throw new Error('Federation catalog is not initialized');
    if (expectedRevision !== null && expectedRevision !== undefined && meta.revision !== expectedRevision) throw new Error(`Federation revision conflict: expected ${expectedRevision}, got ${meta.revision}`);
    return meta;
  }
  #finish(meta, action, metadata = {}) {
    const revision = meta.revision + 1;
    const providersSha256 = canonicalSha256(this.#providers());
    const event = { id: `fedevent_${randomUUID().replaceAll('-', '')}`, revision, at: new Date().toISOString(), action, metadata, prevSha256: meta.head_sha256, providersSha256 };
    event.eventSha256 = canonicalSha256(event);
    this.db.prepare('INSERT INTO forge_federation_events(revision,event_id,at,prev_sha256,providers_sha256,event_sha256,payload) VALUES(?,?,?,?,?,?,?)').run(revision, event.id, event.at, event.prevSha256, providersSha256, event.eventSha256, JSON.stringify(event));
    this.db.prepare('UPDATE forge_federation_meta SET revision=?,head_sha256=? WHERE singleton=1 AND revision=?').run(revision, event.eventSha256, meta.revision);
    this.db.exec('COMMIT');
  }
  async importProvider(provider, { expectedRevision = null } = {}) {
    const meta = this.#begin(expectedRevision);
    try {
      this.db.prepare('INSERT INTO forge_federation_providers(provider_id,capability_id,status,source_id,payload) VALUES(?,?,?,?,?)').run(provider.providerId, provider.capabilityId, provider.status, provider.sourceId, JSON.stringify(provider));
      this.#finish(meta, 'provider-imported', { providerId: provider.providerId });
      return this.read();
    } catch (error) { try { this.db.exec('ROLLBACK'); } catch {} if (String(error.code).includes('CONSTRAINT')) throw new Error(`Duplicate provider: ${provider.providerId}`); throw error; }
  }
  async replaceProvider(provider, { expectedRevision = null } = {}) {
    const meta = this.#begin(expectedRevision);
    try {
      const result = this.db.prepare('UPDATE forge_federation_providers SET capability_id=?,status=?,source_id=?,payload=? WHERE provider_id=?').run(provider.capabilityId, provider.status, provider.sourceId, JSON.stringify(provider), provider.providerId);
      if (result.changes !== 1) throw new Error(`Unknown provider: ${provider.providerId}`);
      this.#finish(meta, 'provider-replaced', { providerId: provider.providerId });
      return this.read();
    } catch (error) { try { this.db.exec('ROLLBACK'); } catch {} throw error; }
  }
  async seedProviders(providers, { expectedRevision = null } = {}) {
    if (!Array.isArray(providers)) throw new TypeError('providers must be an array');
    const meta = this.#begin(expectedRevision);
    try {
      const insert = this.db.prepare('INSERT OR IGNORE INTO forge_federation_providers(provider_id,capability_id,status,source_id,payload) VALUES(?,?,?,?,?)');
      let changes = 0;
      for (const provider of providers) changes += Number(insert.run(provider.providerId, provider.capabilityId, provider.status, provider.sourceId, JSON.stringify(provider)).changes);
      if (changes === 0) { this.db.exec('COMMIT'); return this.read(); }
      this.#finish(meta, 'built-in-providers-seeded', { added: changes });
      return this.read();
    } catch (error) { try { this.db.exec('ROLLBACK'); } catch {} throw error; }
  }
}
