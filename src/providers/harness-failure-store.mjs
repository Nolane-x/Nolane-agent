import { DatabaseSync } from 'node:sqlite';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const ALLOWED = new Set(['providerId', 'harnessFamily', 'profileId', 'profileRevision', 'taskKind', 'failureClass', 'retryable', 'fingerprint', 'missionId', 'taskId', 'evidenceReceiptSha256', 'occurredAt']);
const SHA256 = /^[a-f0-9]{64}$/i;
const FAILURE_CLASSES = new Set(['provider-timeout', 'provider-rate-limit', 'provider-overloaded', 'context-overflow', 'malformed-tool-call', 'unavailable-tool', 'sandbox-denied', 'patch-conflict', 'test-regression', 'loop-no-progress', 'unknown']);

function bounded(value, label, max = 120, { nullable = false } = {}) {
  if (value == null && nullable) return null;
  const output = String(value ?? '').trim();
  if (!output || output.length > max) throw new TypeError(`${label} is invalid`);
  return output;
}

function integer(value, label, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new TypeError(`${label} is invalid`);
  return number;
}

function validate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('telemetry event is required');
  for (const key of Object.keys(input)) if (!ALLOWED.has(key)) throw new TypeError(`unsupported telemetry field: ${key}`);
  const failureClass = bounded(input.failureClass, 'failureClass', 80);
  if (!FAILURE_CLASSES.has(failureClass)) throw new TypeError('failureClass is invalid');
  const fingerprint = bounded(input.fingerprint, 'fingerprint', 64);
  if (!SHA256.test(fingerprint)) throw new TypeError('fingerprint must be SHA-256');
  const evidenceReceiptSha256 = input.evidenceReceiptSha256 == null ? null : bounded(input.evidenceReceiptSha256, 'evidenceReceiptSha256', 64);
  if (evidenceReceiptSha256 && !SHA256.test(evidenceReceiptSha256)) throw new TypeError('evidenceReceiptSha256 must be SHA-256');
  return Object.freeze({
    providerId: bounded(input.providerId, 'providerId'),
    harnessFamily: bounded(input.harnessFamily, 'harnessFamily', 80),
    profileId: bounded(input.profileId, 'profileId'),
    profileRevision: integer(input.profileRevision, 'profileRevision', 1, 1_000_000),
    taskKind: bounded(input.taskKind ?? 'general', 'taskKind', 80),
    failureClass,
    retryable: input.retryable === true,
    fingerprint: fingerprint.toLowerCase(),
    missionId: bounded(input.missionId, 'missionId', 160, { nullable: true }),
    taskId: bounded(input.taskId, 'taskId', 160, { nullable: true }),
    evidenceReceiptSha256: evidenceReceiptSha256?.toLowerCase() ?? null,
    occurredAt: integer(input.occurredAt ?? Date.now(), 'occurredAt', 0),
  });
}

function filters(input = {}) {
  const clauses = [];
  const args = [];
  for (const [key, column, max] of [['providerId', 'provider_id', 120], ['harnessFamily', 'harness_family', 80], ['profileId', 'profile_id', 120], ['failureClass', 'failure_class', 80], ['taskKind', 'task_kind', 80]]) {
    if (input[key] != null) { clauses.push(`${column}=?`); args.push(bounded(input[key], key, max)); }
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', args };
}

export class HarnessFailureStore {
  constructor({ file = ':memory:' } = {}) {
    this.db = new DatabaseSync(String(file));
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS harness_failures (
        event_key TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        harness_family TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        profile_revision INTEGER NOT NULL,
        task_kind TEXT NOT NULL,
        failure_class TEXT NOT NULL,
        retryable INTEGER NOT NULL,
        fingerprint TEXT NOT NULL,
        mission_id TEXT,
        task_id TEXT,
        evidence_receipt_sha256 TEXT,
        occurred_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_harness_failures_lookup ON harness_failures(provider_id, profile_id, failure_class, occurred_at);
      CREATE INDEX IF NOT EXISTS idx_harness_failures_family ON harness_failures(harness_family, task_kind, occurred_at);
    `);
    this.insert = this.db.prepare(`INSERT OR IGNORE INTO harness_failures
      (event_key,provider_id,harness_family,profile_id,profile_revision,task_kind,failure_class,retryable,fingerprint,mission_id,task_id,evidence_receipt_sha256,occurred_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  }

  record(input = {}) {
    const item = validate(input);
    const eventKey = canonicalSha256({ schema: 'forge.harness-failure-event.v1', ...item });
    const result = this.insert.run(eventKey, item.providerId, item.harnessFamily, item.profileId, item.profileRevision, item.taskKind, item.failureClass, item.retryable ? 1 : 0, item.fingerprint, item.missionId, item.taskId, item.evidenceReceiptSha256, item.occurredAt);
    return Object.freeze({ recorded: Number(result.changes ?? 0) > 0, eventKey, providerId: item.providerId, profileId: item.profileId, failureClass: item.failureClass });
  }

  summary(input = {}) {
    const { where, args } = filters(input);
    const row = this.db.prepare(`SELECT COUNT(*) AS total, COALESCE(SUM(retryable),0) AS retryable, COUNT(DISTINCT provider_id) AS providers, COUNT(DISTINCT profile_id) AS profiles, MIN(occurred_at) AS first_occurred_at, MAX(occurred_at) AS last_occurred_at FROM harness_failures ${where}`).get(...args);
    return Object.freeze({ total: Number(row.total ?? 0), retryable: Number(row.retryable ?? 0), providers: Number(row.providers ?? 0), profiles: Number(row.profiles ?? 0), firstOccurredAt: row.first_occurred_at == null ? null : Number(row.first_occurred_at), lastOccurredAt: row.last_occurred_at == null ? null : Number(row.last_occurred_at) });
  }

  clusters(input = {}) {
    const { where, args } = filters(input);
    return Object.freeze(this.db.prepare(`SELECT failure_class, COUNT(*) AS count, COALESCE(SUM(retryable),0) AS retryable, MIN(occurred_at) AS first_occurred_at, MAX(occurred_at) AS last_occurred_at FROM harness_failures ${where} GROUP BY failure_class ORDER BY failure_class`).all(...args).map((row) => Object.freeze({ failureClass: row.failure_class, count: Number(row.count), retryable: Number(row.retryable), firstOccurredAt: Number(row.first_occurred_at), lastOccurredAt: Number(row.last_occurred_at) })));
  }

  close() { this.db.close(); }
}
