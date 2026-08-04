export const STOP_REASONS = Object.freeze({
  TOKEN_BUDGET: 'token-budget',
  TURN_BUDGET: 'turn-budget',
  WALL_CLOCK: 'wall-clock-budget',
  NO_PROGRESS: 'no-progress',
  ABORTED: 'aborted',
  CRITERIA_SATISFIED: 'criteria-satisfied',
});

const TRANSITIONS = Object.freeze({
  draft: new Set(['planning', 'cancelled']),
  planning: new Set(['executing', 'waiting', 'failed', 'cancelled']),
  executing: new Set(['planning', 'verifying', 'waiting', 'failed', 'cancelled']),
  waiting: new Set(['planning', 'executing', 'failed', 'cancelled']),
  verifying: new Set(['executing', 'completed', 'failed', 'cancelled']),
  completed: new Set(), failed: new Set(), cancelled: new Set(),
});
const TERMINAL = new Set(['completed', 'failed', 'cancelled']);

const finitePositive = (value, fallback) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback;

export function createAgentState({ missionId, objective, criteria = [], budgets = {}, startedAt = Date.now(), noProgressLimit = 3 } = {}) {
  if (!missionId || !objective) throw new Error('Agent state requires missionId and objective');
  const limits = Object.freeze({ maxTurns: finitePositive(budgets.maxTurns, 20), maxTokens: finitePositive(budgets.maxTokens, 10000), maxWallMs: finitePositive(budgets.maxWallMs, 300000), noProgressLimit: finitePositive(noProgressLimit, 3) });
  let status = 'draft'; let turns = 0; let tokens = 0; let noProgressTurns = 0; let aborted = false; let criteriaSatisfied = false; let lastAt = Number(startedAt);
  const history = [];
  return Object.freeze({
    transition(next, metadata = {}) {
      if (!TRANSITIONS[status]?.has(next)) throw new Error(`Illegal transition: ${status} -> ${next}`);
      history.push(Object.freeze({ from: status, to: next, at: Number(metadata.at ?? lastAt), reason: metadata.reason ?? null })); status = next;
    },
    recordTurn({ tokens: usedTokens = 0, progress = false, at = lastAt, criteriaMet = false } = {}) {
      if (TERMINAL.has(status)) throw new Error(`Cannot record turn in terminal state ${status}`);
      const used = Math.max(0, Number(usedTokens) || 0); turns += 1; tokens += used; noProgressTurns = progress ? 0 : noProgressTurns + 1; criteriaSatisfied ||= Boolean(criteriaMet); lastAt = Number(at);
    },
    abort() { aborted = true; }, markCriteriaSatisfied() { criteriaSatisfied = true; },
    shouldStop({ now = lastAt } = {}) {
      if (aborted) return STOP_REASONS.ABORTED;
      if (criteriaSatisfied) return STOP_REASONS.CRITERIA_SATISFIED;
      if (tokens >= limits.maxTokens) return STOP_REASONS.TOKEN_BUDGET;
      if (turns >= limits.maxTurns) return STOP_REASONS.TURN_BUDGET;
      if (Number(now) - Number(startedAt) >= limits.maxWallMs) return STOP_REASONS.WALL_CLOCK;
      if (noProgressTurns >= limits.noProgressLimit) return STOP_REASONS.NO_PROGRESS;
      return null;
    },
    snapshot() { return Object.freeze({ missionId: String(missionId), objective: String(objective), criteria: Object.freeze(criteria.map(String)), status, turns, tokens, noProgressTurns, startedAt: Number(startedAt), lastAt, budgets: limits, aborted, criteriaSatisfied, history: Object.freeze([...history]) }); },
  });
}
