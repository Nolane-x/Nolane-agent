import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { redactSecrets } from '../security/redaction.mjs';

const OUTPUT_POLICIES = new Set(['report', 'branch', 'pull-request-draft', 'patch-draft']);
const id = (prefix) => `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 24)}`;

function required(value, label) { const text = String(value ?? '').trim(); if (!text) throw new TypeError(`${label} is required`); return text; }
function stringList(value, label, max = 100) { if (value === undefined) return []; if (!Array.isArray(value) || value.length > max) throw new TypeError(`${label} must be an array with at most ${max} entries`); return [...new Set(value.map(String).filter(Boolean))].sort(); }
function json(value, maxBytes, label) { const safe = redactSecrets(value ?? {}, {}); const encoded = JSON.stringify(safe); if (Buffer.byteLength(encoded) > maxBytes) throw new Error(`${label} exceeds ${maxBytes} byte limit`); return encoded; }

function normalizeTrigger(trigger) {
  if (!trigger || typeof trigger !== 'object') throw new TypeError('automation trigger is required');
  const kind = String(trigger.kind ?? 'manual');
  if (kind === 'manual') return Object.freeze({ kind });
  if (kind === 'interval') {
    const everyMs = Number(trigger.everyMs);
    if (!Number.isInteger(everyMs) || everyMs < 1_000 || everyMs > 365 * 24 * 60 * 60_000) throw new TypeError('interval everyMs must be between 1000 and 31536000000');
    return Object.freeze({ kind, everyMs });
  }
  if (kind === 'event') {
    const eventTypes = stringList(trigger.eventTypes, 'trigger eventTypes', 100);
    if (eventTypes.length === 0) throw new TypeError('event trigger requires eventTypes');
    return Object.freeze({ kind, eventTypes });
  }
  throw new TypeError(`Unsupported automation trigger: ${kind}`);
}

export class DurableAutomationService {
  constructor({ file = ':memory:', runner, clock = Date.now, retryBaseMs = 30_000, maxAttempts = 5 } = {}) {
    if (typeof runner !== 'function') throw new TypeError('automation runner is required');
    this.file = file === ':memory:' ? file : path.resolve(file); if (this.file !== ':memory:') mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(this.file); this.runner = runner; this.clock = clock; this.retryBaseMs = Math.max(1, Number(retryBaseMs) || 30_000); this.maxAttempts = Math.max(1, Math.trunc(Number(maxAttempts) || 5));
    this.db.exec(`
      PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS automation_definitions(
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, objective TEXT NOT NULL,
        trigger_json TEXT NOT NULL, output_policy TEXT NOT NULL, capabilities_json TEXT NOT NULL,
        skills_json TEXT NOT NULL, mcp_servers_json TEXT NOT NULL, enabled INTEGER NOT NULL,
        running INTEGER NOT NULL DEFAULT 0, next_run_at INTEGER, last_run_id TEXT, last_run_status TEXT,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS automation_events(
        event_id TEXT PRIMARY KEY, type TEXT NOT NULL, project_id TEXT NOT NULL, payload_json TEXT NOT NULL, received_at INTEGER NOT NULL, event_sha256 TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS automation_runs(
        id TEXT PRIMARY KEY, automation_id TEXT NOT NULL REFERENCES automation_definitions(id) ON DELETE CASCADE,
        event_id TEXT NOT NULL, event_json TEXT NOT NULL, status TEXT NOT NULL, attempt INTEGER NOT NULL,
        available_at INTEGER NOT NULL, started_at INTEGER, completed_at INTEGER, output_json TEXT, error TEXT, memory TEXT,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(automation_id,event_id)
      );
      CREATE INDEX IF NOT EXISTS automation_runs_due ON automation_runs(status,available_at,created_at);
    `);
  }

  create({ projectId, name, objective, trigger = { kind: 'manual' }, outputPolicy = 'report', capabilities = [], skills = [], mcpServers = [] } = {}) {
    if (!OUTPUT_POLICIES.has(String(outputPolicy))) throw new TypeError(`Unsupported automation output policy: ${outputPolicy}`);
    const normalizedTrigger = normalizeTrigger(trigger); const stamp = Math.trunc(this.clock()); const automationId = id('automation');
    const nextRunAt = normalizedTrigger.kind === 'interval' ? stamp : null;
    this.db.prepare(`INSERT INTO automation_definitions(id,project_id,name,objective,trigger_json,output_policy,capabilities_json,skills_json,mcp_servers_json,enabled,running,next_run_at,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,1,0,?,?,?)`).run(automationId, required(projectId, 'projectId'), required(name, 'automation name'), required(objective, 'automation objective'), JSON.stringify(normalizedTrigger), outputPolicy, JSON.stringify(stringList(capabilities, 'capabilities')), JSON.stringify(stringList(skills, 'skills')), JSON.stringify(stringList(mcpServers, 'mcpServers')), nextRunAt, stamp, stamp);
    return this.get(automationId);
  }

  get(automationId) { const row = this.db.prepare('SELECT * FROM automation_definitions WHERE id=?').get(String(automationId)); return row ? Object.freeze(this.#automation(row)) : null; }
  list({ projectId = null } = {}) { const rows = projectId == null ? this.db.prepare('SELECT * FROM automation_definitions ORDER BY created_at,id').all() : this.db.prepare('SELECT * FROM automation_definitions WHERE project_id=? ORDER BY created_at,id').all(String(projectId)); return rows.map((row) => Object.freeze(this.#automation(row))); }

  ingestEvent({ eventId, type, projectId, payload = {}, secretValues = [] } = {}) {
    const event = { eventId: required(eventId, 'eventId'), type: required(type, 'event type'), projectId: required(projectId, 'projectId'), payload: redactSecrets(payload, { secretValues }) };
    const encoded = json(event.payload, 1_000_000, 'automation event payload'); const stamp = Math.trunc(this.clock());
    const inserted = this.db.prepare('INSERT OR IGNORE INTO automation_events(event_id,type,project_id,payload_json,received_at,event_sha256) VALUES(?,?,?,?,?,?)').run(event.eventId, event.type, event.projectId, encoded, stamp, canonicalSha256(event)).changes;
    if (!inserted) return Object.freeze({ duplicate: true, queued: 0, eventId: event.eventId });
    let queued = 0;
    for (const automation of this.list({ projectId: event.projectId })) {
      if (!automation.enabled || automation.trigger.kind !== 'event' || !automation.trigger.eventTypes.includes(event.type)) continue;
      queued += Number(this.#enqueue(automation.id, event, stamp));
    }
    return Object.freeze({ duplicate: false, queued, eventId: event.eventId });
  }

  enqueue(automationId, event) {
    const automation = this.get(automationId); if (!automation) throw new Error(`Unknown automation: ${automationId}`);
    const normalized = { eventId: required(event?.eventId, 'eventId'), type: required(event?.type, 'event type'), projectId: required(event?.projectId ?? automation.projectId, 'projectId'), payload: redactSecrets(event?.payload ?? {}, {}) };
    if (normalized.projectId !== automation.projectId) throw new Error('Automation event project does not match automation project');
    return Object.freeze({ queued: Number(this.#enqueue(automation.id, normalized, Math.trunc(this.clock()))) });
  }

  async tick() {
    const stamp = Math.trunc(this.clock()); const started = []; const skipped = [];
    for (const automation of this.list()) {
      if (automation.running) { skipped.push({ automationId: automation.id, reason: 'already-running' }); continue; }
      if (!automation.enabled || automation.trigger.kind !== 'interval' || automation.nextRunAt === null || automation.nextRunAt > stamp) continue;
      const event = { eventId: `interval:${automation.id}:${automation.nextRunAt}`, type: 'schedule.interval', projectId: automation.projectId, payload: { scheduledAt: automation.nextRunAt } };
      this.#enqueue(automation.id, event, stamp);
    }
    const due = this.db.prepare("SELECT * FROM automation_runs WHERE status IN ('queued','retry-wait') AND available_at<=? ORDER BY available_at,created_at,id").all(stamp);
    for (const run of due) {
      const automation = this.get(run.automation_id); if (!automation?.enabled) { skipped.push({ runId: run.id, reason: 'disabled' }); continue; }
      const claimed = this.db.prepare('UPDATE automation_definitions SET running=1,updated_at=? WHERE id=? AND running=0').run(stamp, automation.id).changes;
      if (!claimed) { skipped.push({ automationId: automation.id, runId: run.id, reason: 'already-running' }); continue; }
      const attempt = Number(run.attempt) + 1;
      this.db.prepare("UPDATE automation_runs SET status='running',attempt=?,started_at=?,updated_at=? WHERE id=?").run(attempt, stamp, stamp, run.id);
      try {
        const priorMemory = this.db.prepare("SELECT memory FROM automation_runs WHERE automation_id=? AND status='pass' AND memory IS NOT NULL ORDER BY completed_at DESC LIMIT 8").all(automation.id).map((row) => row.memory);
        const event = JSON.parse(run.event_json);
        const result = await this.runner(Object.freeze({ schema: 'forge.automation-run-request.v1', automationId: automation.id, runId: run.id, projectId: automation.projectId, objective: automation.objective, outputPolicy: automation.outputPolicy, capabilities: automation.capabilities, skills: automation.skills, mcpServers: automation.mcpServers, event, priorMemory }));
        const completed = Math.trunc(this.clock()); const status = result?.status === 'fail' ? 'fail' : 'pass';
        if (status !== 'pass') throw new Error(String(result?.error ?? 'automation runner failed'));
        const output = json(result?.output ?? {}, 2_000_000, 'automation output'); const memory = result?.memory == null ? null : String(result.memory).slice(0, 20_000);
        this.db.prepare("UPDATE automation_runs SET status='pass',completed_at=?,output_json=?,memory=?,updated_at=? WHERE id=?").run(completed, output, memory, completed, run.id);
        const nextRunAt = automation.trigger.kind === 'interval' ? completed + automation.trigger.everyMs : automation.nextRunAt;
        this.db.prepare('UPDATE automation_definitions SET running=0,next_run_at=?,last_run_id=?,last_run_status=?,updated_at=? WHERE id=?').run(nextRunAt, run.id, 'pass', completed, automation.id);
        started.push({ automationId: automation.id, runId: run.id, status: 'pass' });
      } catch (error) {
        const completed = Math.trunc(this.clock()); const terminal = attempt >= this.maxAttempts; const status = terminal ? 'failed' : 'retry-wait'; const availableAt = terminal ? completed : completed + (this.retryBaseMs * (2 ** (attempt - 1)));
        this.db.prepare('UPDATE automation_runs SET status=?,available_at=?,completed_at=?,error=?,updated_at=? WHERE id=?').run(status, availableAt, completed, String(error?.message ?? error).slice(0, 2_000), completed, run.id);
        this.db.prepare('UPDATE automation_definitions SET running=0,last_run_id=?,last_run_status=?,updated_at=? WHERE id=?').run(run.id, status, completed, automation.id);
        skipped.push({ automationId: automation.id, runId: run.id, reason: status, error: String(error?.message ?? error) });
      }
    }
    return Object.freeze({ started: Object.freeze(started), skipped: Object.freeze(skipped) });
  }

  listRuns(automationId, { limit = 100 } = {}) { return this.db.prepare('SELECT * FROM automation_runs WHERE automation_id=? ORDER BY created_at DESC,id DESC LIMIT ?').all(String(automationId), Math.max(1, Math.min(1_000, Number(limit) || 100))).map((row) => Object.freeze({ id: row.id, automationId: row.automation_id, eventId: row.event_id, status: row.status, attempt: Number(row.attempt), availableAt: Number(row.available_at), startedAt: row.started_at == null ? null : Number(row.started_at), completedAt: row.completed_at == null ? null : Number(row.completed_at), output: row.output_json == null ? null : JSON.parse(row.output_json), error: row.error, memory: row.memory })); }

  #enqueue(automationId, event, stamp) {
    const runId = id('automation_run');
    return this.db.prepare("INSERT OR IGNORE INTO automation_runs(id,automation_id,event_id,event_json,status,attempt,available_at,created_at,updated_at) VALUES(?,?,?,?, 'queued',0,?,?,?)").run(runId, automationId, event.eventId, json(event, 1_100_000, 'automation event'), stamp, stamp, stamp).changes;
  }

  #automation(row) { return { id: row.id, projectId: row.project_id, name: row.name, objective: row.objective, trigger: JSON.parse(row.trigger_json), outputPolicy: row.output_policy, capabilities: JSON.parse(row.capabilities_json), skills: JSON.parse(row.skills_json), mcpServers: JSON.parse(row.mcp_servers_json), enabled: Boolean(row.enabled), running: Boolean(row.running), nextRunAt: row.next_run_at == null ? null : Number(row.next_run_at), lastRunId: row.last_run_id, lastRunStatus: row.last_run_status, createdAt: Number(row.created_at), updatedAt: Number(row.updated_at) }; }
  close() { this.db.close(); }
}
