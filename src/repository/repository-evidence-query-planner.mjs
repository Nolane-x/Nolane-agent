import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const STAGES = Object.freeze(['exact','lexical','ast-lsp','graph','git','test','semantic','runtime']);
const SHA256 = /^[a-f0-9]{64}$/;

function frozen(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) frozen(item);
    return Object.freeze(value);
  }
  for (const item of Object.values(value)) frozen(item);
  return Object.freeze(value);
}

function bounded(value, fallback, min, max) {
  const number = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(number) ? Math.floor(number) : fallback));
}

function validCitation(citation) {
  return Boolean(
    citation
    && typeof citation === 'object'
    && String(citation.path ?? '').length > 0
    && SHA256.test(String(citation.sourceHash ?? '').toLowerCase()),
  );
}

export class RepositoryEvidenceQueryPlanner {
  plan({ query, budget = 80 } = {}) {
    const normalizedBudget = bounded(budget, 80, 1, 100_000);
    const stages = STAGES.map((id) => ({ id, maxCost: Math.max(1, Math.ceil(normalizedBudget / STAGES.length)) }));
    const base = { schema: 'forge.repository-evidence-query-plan.v1', query: String(query ?? ''), budget: normalizedBudget, stages };
    return frozen({ ...base, planSha256: canonicalSha256(base) });
  }

  async execute(request = {}, providers = {}) {
    const plan = this.plan(request);
    const minCitedResults = request.stopWhen?.minCitedResults == null
      ? Number.POSITIVE_INFINITY
      : bounded(request.stopWhen.minCitedResults, 1, 1, 100_000);
    const minScore = Number.isFinite(Number(request.stopWhen?.minScore)) ? Number(request.stopWhen.minScore) : 0;
    let remainingBudget = plan.budget;
    let stoppedEarly = false;
    let stopReason = null;
    const stageReports = [];
    const citedResults = [];
    const ambiguousResults = [];
    const rejectedResults = [];

    for (const stage of plan.stages) {
      if (remainingBudget <= 0) {
        stopReason = 'budget-exhausted';
        break;
      }
      const provider = providers?.[stage.id];
      if (typeof provider !== 'function') {
        stageReports.push(frozen({ id: stage.id, status: 'unavailable', cost: 0, acceptedCount: 0, ambiguousCount: 0, rejectedCount: 0 }));
        continue;
      }
      const output = await provider({
        query: plan.query,
        stage: stage.id,
        remainingBudget,
        maxCost: Math.min(stage.maxCost, remainingBudget),
        request: frozen(structuredClone(request)),
      });
      const cost = bounded(output?.cost, 1, 0, remainingBudget);
      remainingBudget -= cost;
      let acceptedCount = 0;
      let ambiguousCount = 0;
      let rejectedCount = 0;
      for (const raw of output?.results ?? []) {
        const result = frozen({ ...structuredClone(raw), stage: raw?.stage ?? stage.id });
        if (result.status === 'ambiguous') {
          ambiguousResults.push(result);
          ambiguousCount += 1;
          continue;
        }
        if (result.status !== 'fact') {
          rejectedResults.push(frozen({ result, reason: 'unsupported-status' }));
          rejectedCount += 1;
          continue;
        }
        if (!validCitation(result.citation)) {
          rejectedResults.push(frozen({ result, reason: 'missing-citation' }));
          rejectedCount += 1;
          continue;
        }
        citedResults.push(result);
        acceptedCount += 1;
      }
      stageReports.push(frozen({
        id: stage.id,
        status: 'complete',
        cost,
        acceptedCount,
        ambiguousCount,
        rejectedCount,
        unknowns: [...(output?.unknowns ?? [])].map(String).sort(),
      }));
      const qualifying = citedResults.filter((result) => Number(result.score ?? 0) >= minScore).length;
      if (qualifying >= minCitedResults) {
        stoppedEarly = true;
        stopReason = 'acceptance-threshold-met';
        break;
      }
    }

    if (!stopReason && remainingBudget <= 0) stopReason = 'budget-exhausted';
    const base = {
      schema: 'forge.repository-evidence-query-result.v1',
      planSha256: plan.planSha256,
      query: plan.query,
      budget: plan.budget,
      remainingBudget,
      stages: stageReports,
      citedResults,
      ambiguousResults,
      rejectedResults,
      stoppedEarly,
      stopReason,
    };
    return frozen({ ...base, resultSha256: canonicalSha256(base) });
  }
}

export const REPOSITORY_EVIDENCE_QUERY_STAGES = STAGES;
