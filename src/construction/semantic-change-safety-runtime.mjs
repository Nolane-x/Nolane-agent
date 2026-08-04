import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { selectCandidate } from './candidate-patch-selector.mjs';
import { signed, strings, text } from './construction-utils.mjs';

const execFileAsync = promisify(execFile);
const SHA256 = /^[a-f0-9]{64}$/i;
const REVIEW_REQUIRED = new Set(['public-api', 'security', 'multi-module-contract']);

function sha(value, label) {
  const output = String(value ?? '').toLowerCase();
  if (!SHA256.test(output)) throw new TypeError(`${label} must be SHA-256`);
  return output;
}
function array(value) { return Array.isArray(value) ? value : []; }
function stable(value) { return JSON.stringify(value ?? null); }
function list(value) { return [...new Set(array(value).map(String))].sort(); }
function cited(edge) { return Boolean(edge?.citation && SHA256.test(String(edge.citation.sourceHash ?? ''))); }
function tokenize(value) { return new Set(String(value ?? '').toLowerCase().match(/[a-z0-9_]+/g) ?? []); }
function similarity(left, right) {
  const a = tokenize(left); const b = tokenize(right); const union = new Set([...a, ...b]);
  if (!union.size) return 0;
  let intersection = 0; for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / union.size;
}
function defaultRunner(command, args, options = {}) { return execFileAsync(command, args, { cwd: options.cwd, windowsHide: true, timeout: options.timeoutMs ?? 30_000, maxBuffer: 1_000_000 }); }

export class SemanticChangeSafetyRuntime {
  constructor({ duplicateThreshold = 0.82, runner = defaultRunner } = {}) {
    this.duplicateThreshold = Math.max(0, Math.min(1, Number(duplicateThreshold) || 0.82));
    this.runner = runner;
  }

  diffApi({ before = [], after = [] } = {}) {
    const beforeMap = new Map(array(before).map((item) => [text(item.symbolId, 'before.symbolId', 512), item]));
    const afterMap = new Map(array(after).map((item) => [text(item.symbolId, 'after.symbolId', 512), item]));
    const symbolIds = [...new Set([...beforeMap.keys(), ...afterMap.keys()])].sort();
    const changes = [];
    const dimensions = new Set();
    for (const symbolId of symbolIds) {
      const left = beforeMap.get(symbolId) ?? null; const right = afterMap.get(symbolId) ?? null;
      const changed = [];
      if (!left) changed.push('added');
      else if (!right) changed.push('removed');
      else {
        if (stable(left.signature) !== stable(right.signature)) changed.push('signature');
        if (stable(left.type) !== stable(right.type)) changed.push('type');
        if (stable(list(left.errors)) !== stable(list(right.errors))) changed.push('errors');
        if (stable(left.defaultValue) !== stable(right.defaultValue)) changed.push('default');
        if (stable(list(left.events)) !== stable(list(right.events))) changed.push('events');
        if (stable(list(left.sideEffects)) !== stable(list(right.sideEffects))) changed.push('side-effects');
      }
      if (!changed.length) continue;
      changed.forEach((item) => dimensions.add(item));
      changes.push({
        symbolId, dimensions: changed,
        beforeCitation: left?.citation ?? null, afterCitation: right?.citation ?? null,
        breaking: changed.some((item) => ['removed', 'signature', 'type', 'errors', 'default', 'events', 'side-effects'].includes(item)),
      });
    }
    const breaking = changes.some((change) => change.breaking);
    return signed({
      schema: 'forge.semantic-api-diff.v1', changes, dimensionsChanged: [...dimensions].sort(), breaking,
      claims: { textualDiffOnly: false, compatibilityAutomaticallyGuaranteed: false },
    });
  }

  blastRadius({ changedSymbolIds = [], callerEdges = [], testEdges = [], schemaEdges = [], runtimeEdges = [] } = {}) {
    const changed = new Set(strings(changedSymbolIds, 'changedSymbolIds', 10_000, 512));
    const groups = { callers: callerEdges, tests: testEdges, schemas: schemaEdges, runtime: runtimeEdges };
    const impacted = { callers: [], tests: [], schemas: [], runtime: [] };
    let uncitedEdgesRejected = 0;
    const evidence = [];
    for (const [group, edges] of Object.entries(groups)) {
      for (const edge of array(edges)) {
        if (!changed.has(String(edge.to)) && !changed.has(String(edge.from))) continue;
        if (!cited(edge)) { uncitedEdgesRejected += 1; continue; }
        const other = changed.has(String(edge.to)) ? String(edge.from) : String(edge.to);
        impacted[group].push(other);
        evidence.push({ group, from: String(edge.from), to: String(edge.to), citation: edge.citation });
      }
      impacted[group] = [...new Set(impacted[group])].sort();
    }
    return signed({
      schema: 'forge.semantic-blast-radius.v1', changedSymbolIds: [...changed].sort(), impacted, evidence,
      uncitedEdgesRejected, complete: uncitedEdgesRejected === 0,
      claims: { uncitedRelationsGuessed: false, runtimeImpactObservedWhenPresent: impacted.runtime.length > 0 },
    });
  }

  detectExistingAbstraction({ proposedName, proposedBehavior, symbols = [] } = {}) {
    const name = text(proposedName, 'proposedName', 512); const behavior = text(proposedBehavior, 'proposedBehavior', 4096);
    const matches = [];
    let uncitedRejected = 0;
    for (const symbol of array(symbols)) {
      if (!cited(symbol)) { uncitedRejected += 1; continue; }
      const behaviorScore = similarity(behavior, symbol.behavior);
      const nameScore = similarity(name, symbol.name);
      const score = Math.max(behaviorScore, behaviorScore * 0.85 + nameScore * 0.15);
      if (score >= this.duplicateThreshold) matches.push({ symbolId: String(symbol.symbolId), name: String(symbol.name), score: Number(score.toFixed(4)), citation: symbol.citation });
    }
    matches.sort((a, b) => b.score - a.score || a.symbolId.localeCompare(b.symbolId));
    return signed({
      schema: 'forge.existing-abstraction-search.v1', proposedName: name, matches, allowCreate: matches.length === 0,
      uncitedRejected, claims: { repositorySearched: true, semanticEquivalenceProven: false },
    });
  }

  migrationImpact({ schemaChanges = [], configChanges = [], migrations = [], rollbackPlan = null } = {}) {
    const schema = list(schemaChanges); const config = list(configChanges); const migrationList = list(migrations);
    const requirements = [];
    if (schema.length && !migrationList.length) requirements.push('forward-migration');
    if ((schema.length || config.length) && (!rollbackPlan || !array(rollbackPlan.steps).length)) requirements.push('rollback-plan');
    if (rollbackPlan?.verificationReceiptSha256 && !SHA256.test(String(rollbackPlan.verificationReceiptSha256))) requirements.push('valid-rollback-verification-receipt');
    return signed({
      schema: 'forge.migration-impact.v1', status: requirements.length ? 'blocked' : 'ready', schemaChanges: schema, configChanges: config,
      migrations: migrationList, rollbackPlan: rollbackPlan ? { steps: list(rollbackPlan.steps), verificationReceiptSha256: rollbackPlan.verificationReceiptSha256 ? sha(rollbackPlan.verificationReceiptSha256, 'rollbackPlan.verificationReceiptSha256') : null } : null,
      requirements, claims: { rollbackExecuted: false, migrationApplied: false },
    });
  }

  async compareCandidates({ verificationContractSha256, candidates = [], verifyCandidate } = {}) {
    const contract = sha(verificationContractSha256, 'verificationContractSha256');
    if (typeof verifyCandidate !== 'function') throw new TypeError('verifyCandidate is required');
    if (!Array.isArray(candidates) || candidates.length < 2 || candidates.length > 3) throw new TypeError('candidate comparison requires 2-3 candidates');
    const results = [];
    for (const candidate of candidates) {
      if (candidate.verificationContractSha256 !== contract || candidate.isolated !== true || !candidate.worktreePath) throw new Error(`candidate isolation or contract invalid: ${candidate.candidateId}`);
      const inside = (await this.runner('git', ['rev-parse', '--is-inside-work-tree'], { cwd: candidate.worktreePath })).stdout.trim() === 'true';
      const head = (await this.runner('git', ['rev-parse', 'HEAD'], { cwd: candidate.worktreePath })).stdout.trim();
      if (!inside || head !== candidate.headSha) throw new Error(`candidate worktree provenance invalid: ${candidate.candidateId}`);
      const verification = await verifyCandidate({ candidateId: candidate.candidateId, worktreePath: candidate.worktreePath, verificationContractSha256: contract });
      if (verification.verificationContractSha256 !== contract || verification.status !== 'pass') throw new Error(`candidate verification failed: ${candidate.candidateId}`);
      sha(verification.receiptSha256, 'verification.receiptSha256');
      results.push({
        candidateId: String(candidate.candidateId), worktreePath: candidate.worktreePath, headSha: head, isolated: true, cleanBase: true,
        verificationContractSha256: contract, isolationReceiptId: candidate.isolationReceiptSha256 ?? canonicalSha256(candidate),
        verifiedCriteriaScore: Number(verification.verifiedCriteriaScore), requiredCriteriaScore: Number(verification.requiredCriteriaScore),
        criticalInvariantFailures: Number(verification.criticalInvariantFailures), regressionFailures: Number(verification.regressionFailures),
        semanticFootprint: Number(verification.semanticFootprint), tokenCost: Number(verification.tokenCost), rssMbSeconds: Number(verification.rssMbSeconds),
        editCost: Number(verification.editCost), changedLines: Number(verification.changedLines), verificationReceiptSha256: verification.receiptSha256,
      });
    }
    const selection = selectCandidate({ verificationContractSha256: contract, candidates: results });
    return signed({
      schema: 'forge.isolated-candidate-comparison.v1', verificationContractSha256: contract, selectedCandidateId: selection.selectedCandidateId,
      candidates: results, selectionReceiptSha256: selection.receiptSha256,
      claims: { sameVerificationContract: true, candidateWorktreesCreatedDirectly: false, winnerApplied: false },
    });
  }

  reviewGate({ executorId, executorProviderId = null, changeKinds = [], risk = 0, reviewReceipt = null } = {}) {
    const executor = text(executorId, 'executorId', 256); const kinds = strings(changeKinds, 'changeKinds', 64, 128);
    const required = Number(risk) >= 0.7 || kinds.some((kind) => REVIEW_REQUIRED.has(kind));
    const reasons = [];
    if (required && !reviewReceipt) reasons.push('independent-review-required');
    if (reviewReceipt) {
      if (String(reviewReceipt.reviewerId ?? '') === executor) reasons.push('reviewer-not-independent');
      if (executorProviderId && String(reviewReceipt.providerId ?? '') === String(executorProviderId)) reasons.push('review-provider-not-independent');
      if (reviewReceipt.status !== 'approved') reasons.push('review-not-approved');
      if (!SHA256.test(String(reviewReceipt.receiptSha256 ?? ''))) reasons.push('review-receipt-invalid');
    }
    const approved = !reasons.length;
    return signed({
      schema: 'forge.semantic-change-review-gate.v1', status: approved ? 'approved' : 'blocked', required, independent: approved && Boolean(reviewReceipt),
      executorId: executor, changeKinds: kinds, risk: Number(risk), reasons,
      review: reviewReceipt ? { reviewerId: String(reviewReceipt.reviewerId), providerId: String(reviewReceipt.providerId ?? ''), receiptSha256: String(reviewReceipt.receiptSha256 ?? '').toLowerCase() } : null,
      claims: { selfReviewAcceptedForRequiredChange: false },
    });
  }
}
