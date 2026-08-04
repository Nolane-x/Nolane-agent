import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const MODES = Object.freeze({
  intelligence: Object.freeze({ quality: 20, cost: 2, latency: 1, context: 4, outcome: 35 }),
  balance: Object.freeze({ quality: 12, cost: 8, latency: 4, context: 2, outcome: 45 }),
  cost: Object.freeze({ quality: 4, cost: 30, latency: 6, context: 1, outcome: 25 }),
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min = 0, max = 1) { return Math.max(min, Math.min(max, finite(value))); }

function profileOf(provider, detection = null) {
  const view = typeof provider.publicView === 'function' ? provider.publicView() : {};
  const source = { ...view, ...(provider.profile ?? {}), ...(detection ?? {}) };
  return Object.freeze({
    capabilities: new Set((source.capabilities ?? ['text']).map(String)),
    qualityTier: finite(source.qualityTier, 1),
    costTier: finite(source.costTier, 1),
    latencyTier: finite(source.latencyTier, 2),
    contextTier: finite(source.contextTier, source.capabilities?.includes?.('long-context') ? 4 : 1),
    local: source.local === true,
    available: source.available !== false,
    authenticated: source.authenticated !== false,
    healthy: source.healthy !== false,
    cacheIdentity: String(source.cacheIdentity ?? provider.id),
    specialties: new Set((source.specialties ?? []).map(String)),
  });
}

export class OutcomeMetricsStore {
  constructor({ file = ':memory:', clock = Date.now } = {}) {
    this.file = file === ':memory:' ? file : path.resolve(file);
    this.clock = clock;
    if (this.file !== ':memory:') mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(this.file);
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS provider_outcomes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id TEXT NOT NULL,
        task_kind TEXT NOT NULL,
        verified INTEGER NOT NULL,
        accepted INTEGER NOT NULL,
        retained_lines INTEGER NOT NULL,
        generated_lines INTEGER NOT NULL,
        correction_count INTEGER NOT NULL,
        cost_usd REAL NOT NULL,
        latency_ms REAL NOT NULL,
        created_at INTEGER NOT NULL,
        event_key TEXT,
        task_id TEXT,
        actor TEXT,
        evidence_receipt_sha256 TEXT,
        verified_known INTEGER NOT NULL DEFAULT 1,
        accepted_known INTEGER NOT NULL DEFAULT 1
      );
    `);
    const columns = new Set(this.db.prepare('PRAGMA table_info(provider_outcomes)').all().map((column) => column.name));
    for (const [name, definition] of Object.entries({ event_key: 'TEXT', task_id: 'TEXT', actor: 'TEXT', evidence_receipt_sha256: 'TEXT', verified_known: 'INTEGER NOT NULL DEFAULT 1', accepted_known: 'INTEGER NOT NULL DEFAULT 1' })) {
      if (!columns.has(name)) this.db.exec(`ALTER TABLE provider_outcomes ADD COLUMN ${name} ${definition}`);
    }
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_provider_outcomes_lookup ON provider_outcomes(provider_id, task_kind, created_at);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_outcomes_event_key ON provider_outcomes(event_key) WHERE event_key IS NOT NULL;
      CREATE TABLE IF NOT EXISTS provider_decision_efficiency (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id TEXT NOT NULL,
        task_kind TEXT NOT NULL,
        verified_value REAL NOT NULL,
        token_yield REAL NOT NULL,
        memory_yield REAL NOT NULL,
        edit_yield REAL NOT NULL,
        receipt_sha256 TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_provider_decision_efficiency_lookup ON provider_decision_efficiency(provider_id, task_kind, created_at);
    `);
    this.insert = this.db.prepare(`INSERT OR IGNORE INTO provider_outcomes
      (provider_id, task_kind, verified, accepted, retained_lines, generated_lines, correction_count, cost_usd, latency_ms, created_at, event_key, task_id, actor, evidence_receipt_sha256, verified_known, accepted_known)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    this.insertDecisionEfficiency = this.db.prepare(`INSERT INTO provider_decision_efficiency
      (provider_id, task_kind, verified_value, token_yield, memory_yield, edit_yield, receipt_sha256, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  }

  record({ eventKey = null, taskId = null, actor = null, evidenceReceiptSha256 = null, providerId, taskKind = 'general', verified = null, accepted = null, retainedLines = 0, generatedLines = 0, correctionCount = 0, costUsd = 0, latencyMs = 0 } = {}) {
    const id = String(providerId ?? '');
    if (!id) throw new TypeError('providerId is required');
    const key = eventKey == null ? null : String(eventKey).trim();
    if (eventKey != null && !key) throw new TypeError('eventKey cannot be empty');
    const receipt = evidenceReceiptSha256 == null ? null : String(evidenceReceiptSha256);
    if (receipt !== null && !/^[a-f0-9]{64}$/i.test(receipt)) throw new TypeError('evidenceReceiptSha256 must be a SHA-256 hash');
    const retained = Math.max(0, Math.trunc(finite(retainedLines)));
    const generated = Math.max(0, Math.trunc(finite(generatedLines)));
    const corrections = Math.max(0, Math.trunc(finite(correctionCount)));
    const result = this.insert.run(id, String(taskKind || 'general'), verified === true ? 1 : 0, accepted === true ? 1 : 0, retained, generated, corrections, Math.max(0, finite(costUsd)), Math.max(0, finite(latencyMs)), Math.trunc(this.clock()), key, taskId == null ? null : String(taskId), actor == null ? null : String(actor), receipt, verified == null ? 0 : 1, accepted == null ? 0 : 1);
    return Object.freeze({ recorded: Number(result.changes ?? 0) > 0, eventKey: key, providerId: id, taskKind: String(taskKind || 'general') });
  }

  recordDecisionEfficiency({ providerId, taskKind = 'general', verifiedValue = 0, tokenYield = 0, memoryYield = 0, editYield = 0, receiptSha256 } = {}) {
    const id = String(providerId ?? '').trim(); if (!id) throw new TypeError('providerId is required');
    const receipt = String(receiptSha256 ?? '').trim().toLowerCase(); if (!/^[a-f0-9]{64}$/.test(receipt)) throw new TypeError('receiptSha256 must be a SHA-256 hash');
    this.insertDecisionEfficiency.run(id, String(taskKind || 'general'), Math.max(0, finite(verifiedValue)), Math.max(0, finite(tokenYield)), Math.max(0, finite(memoryYield)), Math.max(0, finite(editYield)), receipt, Math.trunc(this.clock()));
    return Object.freeze({ recorded: true, providerId: id, taskKind: String(taskKind || 'general'), receiptSha256: receipt });
  }

  decisionEfficiencySummary(providerId, taskKind = null) {
    const where = taskKind === null ? 'provider_id = ?' : 'provider_id = ? AND task_kind = ?';
    const args = taskKind === null ? [String(providerId)] : [String(providerId), String(taskKind)];
    const row = this.db.prepare(`SELECT COUNT(*) AS samples, AVG(verified_value) AS verified_value, AVG(token_yield) AS token_yield, AVG(memory_yield) AS memory_yield, AVG(edit_yield) AS edit_yield FROM provider_decision_efficiency WHERE ${where}`).get(...args);
    return Object.freeze({ providerId: String(providerId), taskKind: taskKind === null ? null : String(taskKind), samples: Number(row?.samples ?? 0), verifiedValue: Math.max(0, finite(row?.verified_value)), tokenYield: Math.max(0, finite(row?.token_yield)), memoryYield: Math.max(0, finite(row?.memory_yield)), editYield: Math.max(0, finite(row?.edit_yield)), mode: 'shadow' });
  }

  summary(providerId, taskKind = null) {
    const where = taskKind === null ? 'provider_id = ?' : 'provider_id = ? AND task_kind = ?';
    const args = taskKind === null ? [String(providerId)] : [String(providerId), String(taskKind)];
    const row = this.db.prepare(`SELECT
      COUNT(*) AS samples,
      SUM(verified_known) AS verified_samples,
      SUM(accepted_known) AS accepted_samples,
      SUM(CASE WHEN generated_lines > 0 THEN 1 ELSE 0 END) AS retention_samples,
      AVG(CASE WHEN verified_known = 1 THEN verified END) AS verified_rate,
      AVG(CASE WHEN accepted_known = 1 THEN accepted END) AS accepted_rate,
      AVG(CASE WHEN generated_lines > 0 THEN CAST(retained_lines AS REAL) / generated_lines END) AS retention_rate,
      AVG(correction_count) AS correction_count,
      AVG(cost_usd) AS cost_usd,
      AVG(latency_ms) AS latency_ms
      FROM provider_outcomes WHERE ${where}`).get(...args);
    const samples = Number(row?.samples ?? 0);
    return Object.freeze({
      providerId: String(providerId),
      taskKind: taskKind === null ? null : String(taskKind),
      samples,
      verifiedSamples: Number(row?.verified_samples ?? 0),
      acceptedSamples: Number(row?.accepted_samples ?? 0),
      retentionSamples: Number(row?.retention_samples ?? 0),
      verifiedRate: samples ? clamp(row.verified_rate) : 0,
      acceptedRate: samples ? clamp(row.accepted_rate) : 0,
      retentionRate: samples ? clamp(row.retention_rate) : 0,
      correctionCount: samples ? Math.max(0, finite(row.correction_count)) : 0,
      averageCostUsd: samples ? Math.max(0, finite(row.cost_usd)) : 0,
      averageLatencyMs: samples ? Math.max(0, finite(row.latency_ms)) : 0,
    });
  }

  publicView() {
    return this.db.prepare('SELECT DISTINCT provider_id, task_kind FROM provider_outcomes ORDER BY provider_id, task_kind').all().map((row) => this.summary(row.provider_id, row.task_kind));
  }

  close() { this.db.close(); }
}

function outcomeSignal(summary) {
  if (!summary || summary.samples === 0) return 0;
  const confidence = Math.min(1, summary.samples / 8);
  const correctionScore = 1 / (1 + summary.correctionCount);
  const components = [
    summary.verifiedSamples > 0 ? [summary.verifiedRate, 0.4] : null,
    summary.acceptedSamples > 0 ? [summary.acceptedRate, 0.2] : null,
    summary.retentionSamples > 0 ? [summary.retentionRate, 0.3] : null,
    [correctionScore, 0.1],
  ].filter(Boolean);
  const totalWeight = components.reduce((sum, item) => sum + item[1], 0);
  const quality = components.reduce((sum, item) => sum + (item[0] * item[1]), 0) / totalWeight;
  return quality * confidence;
}

export class OutcomeAwareProviderRouter {
  constructor({ registry, outcomeStore = null, verifiedOutcomeBandit = null, clock = Date.now, failureThreshold = 2, cooldownMs = 60_000 } = {}) {
    if (!registry?.list || !registry?.get) throw new TypeError('provider registry is required');
    this.registry = registry;
    this.outcomeStore = outcomeStore;
    this.verifiedOutcomeBandit = verifiedOutcomeBandit;
    this.clock = clock;
    this.failureThreshold = Math.max(1, Math.trunc(finite(failureThreshold, 2)));
    this.cooldownMs = Math.max(1, finite(cooldownMs, 60_000));
    this.healthState = new Map();
  }

  health(providerId) { return { consecutiveFailures: 0, cooldownUntil: 0, lastError: null, ...(this.healthState.get(String(providerId)) ?? {}) }; }
  recordSuccess(providerId) { this.healthState.set(String(providerId), { consecutiveFailures: 0, cooldownUntil: 0, lastError: null }); }
  recordFailure(providerId, error) {
    const id = String(providerId); const current = this.health(id); const message = String(error?.message ?? error);
    const transient = /\b(408|409|425|429|500|502|503|504)\b|timed out|timeout|temporar|rate limit|ECONNRESET|EAI_AGAIN/i.test(message);
    const consecutiveFailures = transient ? current.consecutiveFailures + 1 : 0;
    this.healthState.set(id, { consecutiveFailures, cooldownUntil: transient && consecutiveFailures >= this.failureThreshold ? this.clock() + this.cooldownMs : 0, lastError: message.slice(0, 500) });
  }

  rank({ providerId = 'auto', mode = 'balance', task = {}, requiredCapabilities = [], localOnly = false, maxCostTier = Number.POSITIVE_INFINITY, prefer = [], currentCacheIdentity = null, promptCacheBytes = 0 } = {}) {
    const normalizedMode = Object.hasOwn(MODES, mode) ? mode : 'balance';
    const weights = MODES[normalizedMode];
    const taskKind = String(task.kind ?? 'general');
    const complexity = clamp(task.complexity ?? 0.5);
    const required = new Set(requiredCapabilities.map(String));
    const preferred = new Map(prefer.map((id, index) => [String(id), prefer.length - index]));
    const providers = providerId && providerId !== 'auto' ? [this.registry.get(providerId)] : this.registry.list();
    const now = this.clock();
    let ranked = providers.map((provider) => {
      const profile = profileOf(provider, this.registry.detection?.(provider.id));
      const health = this.health(provider.id);
      const missing = [...required].filter((capability) => !profile.capabilities.has(capability));
      let eligible = true; let reason = 'eligible';
      if (!profile.available) { eligible = false; reason = 'provider unavailable'; }
      else if (!profile.authenticated) { eligible = false; reason = 'provider authentication required'; }
      else if (!profile.healthy) { eligible = false; reason = 'provider connection is not healthy'; }
      else if (missing.length) { eligible = false; reason = `missing capabilities: ${missing.join(', ')}`; }
      else if (localOnly && !profile.local) { eligible = false; reason = 'not local'; }
      else if (profile.costTier > finite(maxCostTier, Number.POSITIVE_INFINITY)) { eligible = false; reason = `cost tier ${profile.costTier} exceeds ${maxCostTier}`; }
      else if (health.cooldownUntil > now) { eligible = false; reason = `cooldown until ${health.cooldownUntil}: ${health.lastError ?? 'recent failures'}`; }

      const complexityQualityMultiplier = 0.8 + (complexity * (normalizedMode === 'intelligence' ? 0.8 : normalizedMode === 'balance' ? 0.6 : 0.4));
      const summary = this.outcomeStore?.summary(provider.id, taskKind) ?? null;
      const outcome = outcomeSignal(summary) * weights.outcome;
      const cacheBytes = Math.max(0, finite(promptCacheBytes));
      const cache = currentCacheIdentity === null || cacheBytes === 0 ? 0 : profile.cacheIdentity === String(currentCacheIdentity) ? Math.min(20, cacheBytes / 10_000) : -Math.min(15, cacheBytes / 15_000);
      const specialty = profile.specialties.has(taskKind) ? 12 : 0;
      const preference = (preferred.get(provider.id) ?? 0) * 100;
      const scoreBreakdown = Object.freeze({
        quality: profile.qualityTier * weights.quality * complexityQualityMultiplier,
        cost: -(profile.costTier * weights.cost),
        latency: -(profile.latencyTier * weights.latency),
        context: profile.contextTier * weights.context * complexity,
        outcome,
        cache,
        specialty,
        preference,
      });
      const score = eligible ? Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0) : Number.NEGATIVE_INFINITY;
      const shadowDecisionEfficiency = this.outcomeStore?.decisionEfficiencySummary?.(provider.id, taskKind) ?? Object.freeze({ providerId: provider.id, taskKind, samples: 0, verifiedValue: 0, tokenYield: 0, memoryYield: 0, editYield: 0, mode: 'shadow' });
      return Object.freeze({ provider, eligible, reason: providerId !== 'auto' && eligible ? 'explicit override' : reason, score, scoreBreakdown, profile, outcome: summary, shadowDecisionEfficiency });
    });
    if (this.verifiedOutcomeBandit?.rank) {
      const features = { taskType: taskKind, language: task.language, repoSize: task.repoSize, risk: task.risk, symbolCount: task.symbolCount, contextTokens: task.contextTokens, toolCount: task.toolCount, localOnly };
      const shadow = this.verifiedOutcomeBandit.rank({
        taskId: String(task.id ?? task.taskId ?? `route-${taskKind}`),
        features,
        candidates: ranked.map((entry) => ({ providerId: entry.provider.id, harnessProfile: String(task.harnessProfilesByProvider?.[entry.provider.id] ?? task.harnessProfile ?? 'default'), eligible: entry.eligible, reason: entry.reason })),
      });
      const byPair = new Map(shadow.ranked.map((item) => [item.pairId, item]));
      ranked = ranked.map((entry) => {
        const harnessProfile = String(task.harnessProfilesByProvider?.[entry.provider.id] ?? task.harnessProfile ?? 'default');
        const item = byPair.get(`${entry.provider.id}::${harnessProfile}`);
        return Object.freeze({ ...entry, shadowBandit: Object.freeze({ mode: 'shadow', policyVersion: shadow.policyVersion, policySha256: shadow.policySha256, cohortIncluded: shadow.cohortIncluded, pairId: item?.pairId ?? null, score: item && Number.isFinite(item.score) ? item.score : null, samples: item?.samples ?? 0, selected: shadow.selectedPairId === item?.pairId }) });
      });
    }
    ranked.sort((left, right) => Number(right.eligible) - Number(left.eligible) || right.score - left.score || left.provider.id.localeCompare(right.provider.id));
    return ranked;
  }

  select(options = {}) {
    const ranked = this.rank(options); const selected = ranked.find((entry) => entry.eligible);
    if (!selected) throw new Error(`No eligible provider. ${ranked.map((entry) => `${entry.provider.id}: ${entry.reason}`).join('; ')}`);
    return selected.provider;
  }

  decide(options = {}) {
    const ranked = this.rank(options); const selected = ranked.find((entry) => entry.eligible);
    if (!selected) throw new Error(`No eligible provider. ${ranked.map((entry) => `${entry.provider.id}: ${entry.reason}`).join('; ')}`);
    const publicRanked = ranked.map((entry) => ({ providerId: entry.provider.id, eligible: entry.eligible, reason: entry.reason, score: Number.isFinite(entry.score) ? entry.score : null, scoreBreakdown: entry.scoreBreakdown }));
    const base = { schema: 'forge.model-route-decision.v2', mode: Object.hasOwn(MODES, options.mode) ? options.mode : 'balance', taskKind: String(options.task?.kind ?? 'general'), selectedProviderId: selected.provider.id, ranked: publicRanked };
    return Object.freeze({ ...base, provider: selected.provider, ranked, decisionSha256: canonicalSha256(base) });
  }
}
