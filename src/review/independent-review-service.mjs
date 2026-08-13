import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { redactSecrets } from '../security/redaction.mjs';
import { rejectPrivate } from '../construction/construction-utils.mjs';

const SEVERITIES = new Set(['info', 'low', 'medium', 'high', 'critical']);
const id = (prefix) => `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 24)}`;

function boundedText(value, max, label) {
  const text = String(value ?? '');
  if (Buffer.byteLength(text) > max) throw new Error(`${label} exceeds ${max} byte limit`);
  return text;
}

function normalizeRules(rules) {
  if (!Array.isArray(rules)) throw new TypeError('review rules must be an array');
  const output = []; let bytes = 0;
  for (const raw of rules.slice(0, 100)) {
    const value = String(raw).replace(/\s+/g, ' ').trim().slice(0, 2_000);
    if (!value) continue;
    const next = Buffer.byteLength(value);
    if (bytes + next > 8_000) break;
    output.push(value); bytes += next;
  }
  return output;
}


function normalizeReviewContext(value) {
  if (value == null) return Object.freeze({ schema: 'forge.review-context.v1', requirements: [], evidence: [], testReceipts: [], residualRisks: [], semanticFindings: [] });
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('reviewContext must be an object');
  rejectPrivate(value, 'reviewContext');
  const normalizeArray = (items, label, maxItems, maxBytes) => {
    if (!Array.isArray(items ?? [])) throw new TypeError(`${label} must be an array`);
    const out = [];
    let bytes = 0;
    for (const item of (items ?? []).slice(0, maxItems)) {
      const text = JSON.stringify(item);
      const next = Buffer.byteLength(text);
      if (bytes + next > maxBytes) break;
      out.push(JSON.parse(text));
      bytes += next;
    }
    return Object.freeze(out);
  };
  return Object.freeze({
    schema: 'forge.review-context.v1',
    requirements: normalizeArray(value.requirements, 'reviewContext.requirements', 200, 32_000),
    evidence: normalizeArray(value.evidence, 'reviewContext.evidence', 500, 128_000),
    testReceipts: normalizeArray(value.testReceipts, 'reviewContext.testReceipts', 500, 64_000),
    residualRisks: normalizeArray(value.residualRisks, 'reviewContext.residualRisks', 200, 32_000),
    semanticFindings: normalizeArray(value.semanticFindings, 'reviewContext.semanticFindings', 500, 64_000),
  });
}

function changedLines(diff) {
  const result = [];
  let currentPath = null; let currentHunk = null;
  for (const line of String(diff).split(/\r?\n/)) {
    if (line.startsWith('diff --git ')) {
      const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
      currentPath = match?.[2] ?? null; currentHunk = null;
    } else if (line.startsWith('+++ b/')) currentPath = line.slice(6);
    else if (line.startsWith('@@ ')) currentHunk = line;
    else if ((line.startsWith('+') && !line.startsWith('+++')) || (line.startsWith('-') && !line.startsWith('---'))) result.push({ path: currentPath, hunk: currentHunk, line });
  }
  return result;
}

function incrementalDiff(previous, next) {
  const prior = new Map();
  for (const item of changedLines(previous)) {
    const key = `${item.path ?? ''}\0${item.line}`;
    prior.set(key, (prior.get(key) ?? 0) + 1);
  }
  const selected = [];
  for (const item of changedLines(next)) {
    const key = `${item.path ?? ''}\0${item.line}`;
    const count = prior.get(key) ?? 0;
    if (count > 0) { prior.set(key, count - 1); continue; }
    selected.push(item);
  }
  if (selected.length === 0) return '';
  const output = [];
  let activePath = null; let activeHunk = null;
  for (const item of selected) {
    if (item.path !== activePath) {
      activePath = item.path;
      activeHunk = null;
      output.push(`diff --git a/${activePath ?? 'unknown'} b/${activePath ?? 'unknown'}`, `--- a/${activePath ?? 'unknown'}`, `+++ b/${activePath ?? 'unknown'}`);
    }
    if (item.hunk && item.hunk !== activeHunk) { output.push(item.hunk); activeHunk = item.hunk; }
    output.push(item.line);
  }
  return `${output.join('\n')}\n`;
}

function normalizeFinding(raw, source = 'reviewer') {
  if (!raw || typeof raw !== 'object') throw new TypeError('review finding must be an object');
  const severity = SEVERITIES.has(String(raw.severity)) ? String(raw.severity) : 'medium';
  const finding = {
    path: String(raw.path ?? '').replaceAll('\\', '/').slice(0, 500),
    line: Math.max(1, Math.trunc(Number(raw.line) || 1)),
    severity,
    category: String(raw.category ?? 'quality').slice(0, 120),
    message: String(raw.message ?? '').trim().slice(0, 2_000),
    evidence: String(raw.evidence ?? '').trim().slice(0, 4_000),
    suggestion: raw.suggestion == null ? null : String(raw.suggestion).trim().slice(0, 4_000),
  };
  if (!finding.message) throw new TypeError('review finding message is required');
  return Object.freeze({ ...finding, source, sources: Object.freeze([source]), fingerprint: canonicalSha256(finding) });
}

function mergeFindings(findings) {
  const merged = new Map();
  for (const finding of findings) {
    const existing = merged.get(finding.fingerprint);
    if (!existing) { merged.set(finding.fingerprint, finding); continue; }
    const sources = Object.freeze([...new Set([...existing.sources, ...finding.sources])]);
    merged.set(finding.fingerprint, Object.freeze({ ...existing, sources }));
  }
  return [...merged.values()];
}

function storedFinding(finding) {
  const sources = Array.isArray(finding.sources) && finding.sources.length ? finding.sources : [finding.source].filter(Boolean);
  return Object.freeze({ ...finding, sources: Object.freeze(sources) });
}

function reviewLineageSha256({ executorId, baseSha, headSha }) {
  return canonicalSha256({ executorId: String(executorId), baseSha: baseSha ?? null, headSha: headSha ?? null });
}

export class IndependentReviewService {
  constructor({ file = ':memory:', reviewer, scanners = [], clock = Date.now, maxDiffBytes = 2_000_000 } = {}) {
    if (typeof reviewer !== 'function') throw new TypeError('independent reviewer function is required');
    this.file = file === ':memory:' ? file : path.resolve(file);
    if (this.file !== ':memory:') mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(this.file); this.reviewer = reviewer; this.scanners = scanners; this.clock = clock; this.maxDiffBytes = maxDiffBytes;
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS independent_reviews(
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        diff_sha256 TEXT NOT NULL,
        rules_sha256 TEXT NOT NULL,
        executor_id TEXT NOT NULL,
        reviewer_id TEXT NOT NULL,
        base_sha TEXT,
        head_sha TEXT,
        prior_review_id TEXT,
        full_diff TEXT NOT NULL,
        reviewed_diff TEXT NOT NULL,
        review_context_sha256 TEXT NOT NULL DEFAULT '',
        review_lineage_sha256 TEXT NOT NULL,
        findings_json TEXT NOT NULL,
        receipt_sha256 TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(project_id,diff_sha256,rules_sha256,reviewer_id,review_lineage_sha256)
      );
    `);
    const columns = new Set(this.db.prepare('PRAGMA table_info(independent_reviews)').all().map((column) => String(column.name)));
    if (!columns.has('review_lineage_sha256')) this.#migrateLegacyStorage();
  }

  async review({ projectId, diff, executorId, reviewerId, rules = [], reviewContext = null, baseSha = null, headSha = null, priorReviewId = null, secretValues = [] } = {}) {
    const project = String(projectId ?? '').trim(); const executor = String(executorId ?? '').trim(); const reviewerIdValue = String(reviewerId ?? '').trim();
    if (!project || !executor || !reviewerIdValue) throw new TypeError('projectId, executorId, and reviewerId are required');
    if (executor === reviewerIdValue) throw new Error('Reviewer must be different from executor');
    const fullDiff = redactSecrets(boundedText(diff, this.maxDiffBytes, 'review diff'), { secretValues });
    if (!fullDiff.trim()) throw new TypeError('review diff is required');
    const safeRules = normalizeRules(rules);
    const safeReviewContext = normalizeReviewContext(reviewContext);
    const reviewContextSha256 = canonicalSha256(safeReviewContext);
    const diffSha256 = canonicalSha256(fullDiff); const rulesSha256 = canonicalSha256({ rules: safeRules, reviewContextSha256 });
    const reviewLineage = reviewLineageSha256({ executorId: executor, baseSha, headSha });
    const duplicate = this.db.prepare('SELECT * FROM independent_reviews WHERE project_id=? AND diff_sha256=? AND rules_sha256=? AND reviewer_id=? AND review_lineage_sha256=?').get(project, diffSha256, rulesSha256, reviewerIdValue, reviewLineage);
    if (duplicate) return Object.freeze({ ...this.#row(duplicate), deduplicated: true });

    let reviewedDiff = fullDiff;
    if (priorReviewId) {
      const prior = this.db.prepare('SELECT * FROM independent_reviews WHERE id=? AND project_id=?').get(String(priorReviewId), project);
      if (!prior) throw new Error(`Unknown prior review: ${priorReviewId}`);
      reviewedDiff = incrementalDiff(prior.full_diff, fullDiff);
    }
    const modelResult = reviewedDiff.trim() ? await this.reviewer(Object.freeze({ schema: 'forge.review-request.v2', projectId: project, diff: reviewedDiff, rules: safeRules, reviewContext: safeReviewContext, baseSha, headSha, priorReviewId })) : { findings: [] };
    const findings = [];
    for (const raw of modelResult?.findings ?? []) findings.push(normalizeFinding(redactSecrets(raw, { secretValues }), 'reviewer'));
    for (const scanner of this.scanners) {
      if (!scanner?.id || typeof scanner.scan !== 'function') throw new TypeError('review scanner requires id and scan()');
      for (const raw of await scanner.scan({ projectId: project, diff: fullDiff, baseSha, headSha })) findings.push(normalizeFinding(redactSecrets(raw, { secretValues }), `scanner:${scanner.id}`));
    }
    const unique = mergeFindings(findings).sort((left, right) => ['critical', 'high', 'medium', 'low', 'info'].indexOf(left.severity) - ['critical', 'high', 'medium', 'low', 'info'].indexOf(right.severity) || left.path.localeCompare(right.path) || left.line - right.line);
    const reviewId = id('review'); const createdAt = Math.trunc(this.clock());
    const receiptBase = { schema: 'forge.independent-review-receipt.v2', reviewId, projectId: project, diffSha256, rulesSha256, reviewContextSha256, reviewLineageSha256: reviewLineage, executorId: executor, reviewerId: reviewerIdValue, baseSha, headSha, priorReviewId, reviewedDiffSha256: canonicalSha256(reviewedDiff), findingFingerprints: unique.map((finding) => finding.fingerprint), findingProvenance: unique.map((finding) => ({ fingerprint: finding.fingerprint, sources: finding.sources })), createdAt };
    const receiptSha256 = canonicalSha256(receiptBase);
    this.db.prepare(`INSERT INTO independent_reviews(id,project_id,diff_sha256,rules_sha256,executor_id,reviewer_id,base_sha,head_sha,prior_review_id,full_diff,reviewed_diff,review_context_sha256,review_lineage_sha256,findings_json,receipt_sha256,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(reviewId, project, diffSha256, rulesSha256, executor, reviewerIdValue, baseSha, headSha, priorReviewId, fullDiff, reviewedDiff, reviewContextSha256, reviewLineage, JSON.stringify(unique), receiptSha256, createdAt);
    return Object.freeze({ schema: 'forge.independent-review.v2', reviewId, projectId: project, diffSha256, rulesSha256, reviewContextSha256, reviewLineageSha256: reviewLineage, executorId: executor, reviewerId: reviewerIdValue, baseSha, headSha, priorReviewId, reviewedDiffSha256: receiptBase.reviewedDiffSha256, findings: Object.freeze(unique), receiptSha256, createdAt, deduplicated: false });
  }

  get(reviewId) {
    const row = this.db.prepare('SELECT * FROM independent_reviews WHERE id=?').get(String(reviewId));
    return row ? Object.freeze(this.#row(row)) : null;
  }

  createRepairHandoff(reviewId, { targetAgentProfile = 'fixer' } = {}) {
    const review = this.get(reviewId);
    if (!review) throw new Error(`Unknown review: ${reviewId}`);
    const base = { schema: 'forge.review-repair-handoff.v1', reviewId: review.reviewId, projectId: review.projectId, targetAgentProfile: String(targetAgentProfile), baseSha: review.baseSha, headSha: review.headSha, findings: review.findings.map((finding) => ({ fingerprint: finding.fingerprint, path: finding.path, line: finding.line, severity: finding.severity, category: finding.category, message: finding.message, evidence: finding.evidence, suggestion: finding.suggestion, sources: finding.sources })), sourceReceiptSha256: review.receiptSha256 };
    return Object.freeze({ ...base, handoffSha256: canonicalSha256(base) });
  }

  #row(row) {
    return { schema: 'forge.independent-review.v2', reviewId: row.id, projectId: row.project_id, diffSha256: row.diff_sha256, rulesSha256: row.rules_sha256, reviewContextSha256: row.review_context_sha256 || null, reviewLineageSha256: row.review_lineage_sha256, executorId: row.executor_id, reviewerId: row.reviewer_id, baseSha: row.base_sha, headSha: row.head_sha, priorReviewId: row.prior_review_id, reviewedDiffSha256: canonicalSha256(row.reviewed_diff), findings: Object.freeze(JSON.parse(row.findings_json).map(storedFinding)), receiptSha256: row.receipt_sha256, createdAt: Number(row.created_at), deduplicated: false };
  }

  #migrateLegacyStorage() {
    const rows = this.db.prepare('SELECT * FROM independent_reviews').all();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.exec(`CREATE TABLE independent_reviews_rebuild(
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL, diff_sha256 TEXT NOT NULL, rules_sha256 TEXT NOT NULL,
        executor_id TEXT NOT NULL, reviewer_id TEXT NOT NULL, base_sha TEXT, head_sha TEXT, prior_review_id TEXT,
        full_diff TEXT NOT NULL, reviewed_diff TEXT NOT NULL, review_context_sha256 TEXT NOT NULL DEFAULT '',
        review_lineage_sha256 TEXT NOT NULL, findings_json TEXT NOT NULL, receipt_sha256 TEXT NOT NULL, created_at INTEGER NOT NULL,
        UNIQUE(project_id,diff_sha256,rules_sha256,reviewer_id,review_lineage_sha256)
      )`);
      const insert = this.db.prepare(`INSERT INTO independent_reviews_rebuild(id,project_id,diff_sha256,rules_sha256,executor_id,reviewer_id,base_sha,head_sha,prior_review_id,full_diff,reviewed_diff,review_context_sha256,review_lineage_sha256,findings_json,receipt_sha256,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      for (const row of rows) insert.run(row.id, row.project_id, row.diff_sha256, row.rules_sha256, row.executor_id, row.reviewer_id, row.base_sha, row.head_sha, row.prior_review_id, row.full_diff, row.reviewed_diff, row.review_context_sha256 ?? '', reviewLineageSha256({ executorId: row.executor_id, baseSha: row.base_sha, headSha: row.head_sha }), row.findings_json, row.receipt_sha256, row.created_at);
      this.db.exec('DROP TABLE independent_reviews; ALTER TABLE independent_reviews_rebuild RENAME TO independent_reviews; COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  close() { this.db.close(); }
}
