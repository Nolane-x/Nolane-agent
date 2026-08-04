export function recordSkillUtility(previous = {}, { skill, success, qualityDelta = 0, tokenDelta = 0, evaluationRunSha256 = null }) {
  const current = previous[skill] ?? { runs: 0, successes: 0, qualityDelta: 0, tokenDelta: 0, score: 0.5 };
  const next = {
    runs: current.runs + 1,
    successes: current.successes + (success ? 1 : 0),
    qualityDelta: current.qualityDelta + Number(qualityDelta || 0),
    tokenDelta: current.tokenDelta + Number(tokenDelta || 0),
  };
  const successRate = next.successes / next.runs;
  const quality = Math.max(-1, Math.min(1, next.qualityDelta / Math.max(1, next.runs * 100)));
  const costPenalty = Math.max(0, next.tokenDelta / Math.max(1, next.runs * 100_000));
  next.score = Math.max(0, Math.min(1, successRate * 0.7 + (quality + 1) * 0.15 - costPenalty * 0.1));
  if (evaluationRunSha256) next.lastEvaluationRunSha256 = evaluationRunSha256;
  next.updatedAt = new Date().toISOString();
  return { ...previous, [skill]: next };
}
