import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const parse = (value, fallback) => value == null ? fallback : JSON.parse(value);

export class HttpCache {
  static open(file) { return new HttpCache(file); }

  constructor(file) {
    this.file = path.resolve(String(file));
    mkdirSync(path.dirname(this.file), { recursive: true });
    this.db = new DatabaseSync(this.file);
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS http_cache(
        url TEXT PRIMARY KEY,
        status INTEGER NOT NULL,
        headers_json TEXT NOT NULL,
        body BLOB NOT NULL,
        content_sha256 TEXT NOT NULL,
        fetched_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        etag TEXT,
        last_modified TEXT
      );
    `);
  }

  close() { this.db.close(); }

  get(url) {
    const row = this.db.prepare('SELECT * FROM http_cache WHERE url=?').get(String(url));
    if (!row) return null;
    return {
      url: row.url,
      status: row.status,
      headers: parse(row.headers_json, {}),
      body: Buffer.from(row.body),
      contentSha256: row.content_sha256,
      fetchedAt: Number(row.fetched_at),
      expiresAt: Number(row.expires_at),
      etag: row.etag,
      lastModified: row.last_modified,
    };
  }

  put(entry) {
    this.db.prepare(`INSERT INTO http_cache(url,status,headers_json,body,content_sha256,fetched_at,expires_at,etag,last_modified)
      VALUES(?,?,?,?,?,?,?,?,?)
      ON CONFLICT(url) DO UPDATE SET status=excluded.status,headers_json=excluded.headers_json,body=excluded.body,content_sha256=excluded.content_sha256,fetched_at=excluded.fetched_at,expires_at=excluded.expires_at,etag=excluded.etag,last_modified=excluded.last_modified`)
      .run(entry.url, entry.status, JSON.stringify(entry.headers ?? {}), entry.body, entry.contentSha256, entry.fetchedAt, entry.expiresAt, entry.etag ?? null, entry.lastModified ?? null);
    return this.get(entry.url);
  }
}
