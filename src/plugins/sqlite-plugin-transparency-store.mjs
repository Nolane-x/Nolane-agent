import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export class SqlitePluginTransparencyStore {
  constructor(file) {
    this.file = path.resolve(String(file));
    mkdirSync(path.dirname(this.file), { recursive: true });
    this.db = new DatabaseSync(this.file);
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS plugin_transparency_entries(
        idx INTEGER PRIMARY KEY,
        entry_json TEXT NOT NULL,
        entry_hash TEXT NOT NULL UNIQUE
      );
    `);
    this.insert = this.db.prepare(`
      INSERT INTO plugin_transparency_entries(idx, entry_json, entry_hash)
      VALUES(?, ?, ?)
    `);
  }

  loadAll() {
    return this.db.prepare('SELECT entry_json FROM plugin_transparency_entries ORDER BY idx ASC')
      .all()
      .map((row) => JSON.parse(row.entry_json));
  }

  append(entry) {
    this.insert.run(entry.index, JSON.stringify(entry), entry.entryHash);
  }

  close() {
    this.db.close();
  }
}
