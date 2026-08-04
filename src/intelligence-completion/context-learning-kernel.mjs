import { boundedArray, finite, redacted, sha, signed, text } from './completion-utils.mjs';

const KINDS = Object.freeze(['symbol', 'stack', 'test', 'git', 'dependency', 'lexical', 'semantic', 'counter']);

function optionalArray(value, label, max) {
  if (value == null) return [];
  return boundedArray(value, label, max);
}

function pushQuery(items, seen, entry, limit) {
  if (items.length >= limit) return;
  const kind = text(entry.kind, 'query.kind', 64);
  if (!KINDS.includes(kind)) throw new TypeError(`unsupported query kind: ${kind}`);
  const query = redacted(entry.query, 2_000).trim();
  if (!query) return;
  const key = `${kind}:${query.toLocaleLowerCase('en-US')}`;
  if (seen.has(key)) return;
  seen.add(key);
  items.push({
    kind,
    query,
    reason: redacted(entry.reason ?? kind, 500),
    source: redacted(entry.source ?? 'task-input', 256),
    counterEvidence: entry.counterEvidence === true,
  });
}

function normalizeAdapterRows(value, max = 64) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, max);
}

function verifiedResult(result) {
  if (!result || result.verified !== true || result.verificationStatus !== 'passed') return null;
  return {
    score: finite(result.score, 'verification score', Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY),
    verificationReceiptSha256: sha(result.verificationReceiptSha256, 'verificationReceiptSha256'),
  };
}

export class ContextLearningKernel {
  constructor({ dependencyNeighbors = null, gitSignals = null, testSignals = null, maximumOutcomes = 10_000 } = {}) {
    this.adapters = { dependencyNeighbors, gitSignals, testSignals };
    this.maximumOutcomes = Math.max(1, Math.min(100_000, Math.floor(Number(maximumOutcomes) || 10_000)));
    this.outcomes = [];
    this.scores = new Map();
  }

  async expandQueries(input = {}) {
    const taskType = text(input.taskType ?? 'general', 'taskType', 128);
    const objective = text(input.objective, 'objective', 16_000);
    const maxQueries = Math.max(1, Math.min(64, Math.floor(Number(input.maxQueries) || 20)));
    const queries = [];
    const seen = new Set();

    for (const symbol of optionalArray(input.symbols, 'symbols', 128)) {
      pushQuery(queries, seen, { kind: 'symbol', query: String(symbol), reason: 'exact symbol', source: 'task.symbols' }, maxQueries);
    }
    for (const frame of optionalArray(input.stackFrames, 'stackFrames', 128)) {
      const symbol = String(frame?.symbol ?? frame?.function ?? '').trim();
      const path = String(frame?.path ?? frame?.file ?? '').trim();
      const line = Number(frame?.line ?? 0);
      pushQuery(queries, seen, { kind: 'stack', query: [symbol, path, line > 0 ? `line ${line}` : ''].filter(Boolean).join(' '), reason: 'stack frame', source: 'task.stackFrames' }, maxQueries);
    }

    if (typeof this.adapters.testSignals === 'function') {
      const rows = normalizeAdapterRows(await this.adapters.testSignals({ taskType, objective, input }));
      for (const row of rows) pushQuery(queries, seen, { kind: 'test', query: [row.testId ?? row.name, row.path].filter(Boolean).join(' '), reason: row.kind ?? 'failing test', source: 'test-adapter' }, maxQueries);
    }
    if (typeof this.adapters.gitSignals === 'function') {
      const rows = normalizeAdapterRows(await this.adapters.gitSignals({ taskType, objective, input }));
      for (const row of rows) pushQuery(queries, seen, { kind: 'git', query: [row.path, row.commit, row.kind].filter(Boolean).join(' '), reason: 'Git change evidence', source: 'git-adapter' }, maxQueries);
    }
    if (typeof this.adapters.dependencyNeighbors === 'function') {
      const rows = normalizeAdapterRows(await this.adapters.dependencyNeighbors({ taskType, objective, input }));
      for (const row of rows) pushQuery(queries, seen, { kind: 'dependency', query: [row.symbol, row.path, row.relation].filter(Boolean).join(' '), reason: 'dependency neighbor', source: 'dependency-adapter' }, maxQueries);
    }

    pushQuery(queries, seen, { kind: 'lexical', query: objective, reason: 'literal objective terms', source: 'task.objective' }, maxQueries);
    pushQuery(queries, seen, { kind: 'semantic', query: objective, reason: 'semantic fallback', source: 'task.objective' }, maxQueries);
    if (input.hypothesis) {
      pushQuery(queries, seen, { kind: 'counter', query: `contradict alternative evidence ${String(input.hypothesis)}`, reason: 'active-hypothesis counter evidence', source: 'task.hypothesis', counterEvidence: true }, maxQueries);
    }

    return signed({
      schema: 'forge.context-query-expansion.v1',
      taskType,
      objective: redacted(objective, 16_000),
      queries,
      claims: { unverifiedOutcomeUsedForExpansion: false, hiddenTaskIdUsed: false, counterEvidenceRequested: queries.some((item) => item.counterEvidence) },
    });
  }

  recordVerifiedOutcome(input = {}) {
    const taskType = text(input.taskType ?? 'general', 'taskType', 128);
    const evidenceType = text(input.evidenceType, 'evidenceType', 128);
    const accepted = input.verified === true && input.verificationStatus === 'passed' && /^[a-f0-9]{64}$/i.test(String(input.verificationReceiptSha256 ?? ''));
    if (accepted) {
      const useful = input.useful === true;
      const key = `${taskType}:${evidenceType}`;
      const current = this.scores.get(key) ?? { useful: 0, harmful: 0, count: 0 };
      current.count += 1;
      if (useful) current.useful += 1; else current.harmful += 1;
      this.scores.set(key, current);
    }
    const event = {
      taskType,
      evidenceType,
      accepted,
      useful: input.useful === true,
      verificationReceiptSha256: accepted ? sha(input.verificationReceiptSha256, 'verificationReceiptSha256') : null,
    };
    this.outcomes.push(event);
    while (this.outcomes.length > this.maximumOutcomes) this.outcomes.shift();
    return signed({ schema: 'forge.context-learning-outcome.v1', ...event, claims: { unverifiedOutcomeChangedLearning: false } });
  }

  rankEvidenceTypes(input = {}) {
    const taskType = text(input.taskType ?? 'general', 'taskType', 128);
    const scores = {};
    for (const outcome of this.outcomes) if (outcome.taskType === taskType) scores[outcome.evidenceType] ??= 0;
    for (const [key, value] of this.scores) {
      const separator = key.indexOf(':');
      const type = key.slice(0, separator); const evidenceType = key.slice(separator + 1);
      if (type !== taskType) continue;
      scores[evidenceType] = Number(((value.useful - value.harmful) / Math.max(1, value.count)).toFixed(6));
    }
    return signed({ schema: 'forge.context-evidence-utility-ranking.v1', taskType, scores, claims: { unverifiedOutcomesChangedLearning: false, routingChangedAutomatically: false } });
  }

  async runAblationReplay(input = {}) {
    const verificationContractSha256 = sha(input.verificationContractSha256, 'verificationContractSha256');
    const cards = boundedArray(input.evidenceCards, 'evidenceCards', 128).map((card, index) => ({
      ...card,
      cardId: text(card?.cardId ?? card?.id, `evidenceCards[${index}].cardId`, 256),
      tokenCost: Math.max(0, Math.floor(Number(card?.tokenCost) || 0)),
    }));
    if (typeof input.verifier !== 'function') throw new TypeError('verifier is required');

    let baseline;
    try {
      baseline = verifiedResult(await input.verifier({ evidenceCards: cards, removedCardId: null, verificationContractSha256 }));
    } catch (error) {
      throw new Error(`baseline verification failed: ${redacted(error?.message ?? error, 1_000)}`);
    }
    if (!baseline) throw new Error('baseline verification must be verified and passed');

    const items = [];
    for (const card of cards) {
      const remaining = cards.filter((candidate) => candidate.cardId !== card.cardId);
      try {
        const outcome = verifiedResult(await input.verifier({ evidenceCards: remaining, removedCardId: card.cardId, verificationContractSha256 }));
        if (!outcome) {
          items.push({ cardId: card.cardId, tokenCost: card.tokenCost, classification: 'inconclusive', scoreDelta: null, verificationReceiptSha256: null, reason: 'unverified ablation outcome' });
          continue;
        }
        const scoreDelta = Number((outcome.score - baseline.score).toFixed(6));
        items.push({
          cardId: card.cardId,
          tokenCost: card.tokenCost,
          classification: scoreDelta < 0 ? 'required' : 'unnecessary',
          scoreDelta,
          verificationReceiptSha256: outcome.verificationReceiptSha256,
          reason: scoreDelta < 0 ? 'verified score regressed after removal' : 'verified score did not regress after removal',
        });
      } catch (error) {
        items.push({ cardId: card.cardId, tokenCost: card.tokenCost, classification: 'inconclusive', scoreDelta: null, verificationReceiptSha256: null, reason: redacted(error?.message ?? error, 1_000) });
      }
    }

    return signed({
      schema: 'forge.context-ablation-replay.v1',
      verificationContractSha256,
      baselineScore: baseline.score,
      baselineVerificationReceiptSha256: baseline.verificationReceiptSha256,
      items,
      claims: { contextDeletedAutomatically: false, verificationContractChanged: false, unverifiedResultUsedForLearning: false },
    });
  }

  snapshot() {
    return signed({ schema: 'forge.context-learning-kernel-snapshot.v1', verifiedUtilityKeys: this.scores.size, outcomes: this.outcomes.slice(-100), claims: { rawPromptsStored: false, unverifiedOutcomesChangedLearning: false } });
  }
}
