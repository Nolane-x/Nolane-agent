import { boundedNumber, signed, strings, text } from './construction-utils.mjs';

export class GoalConflictResolver {
  resolve({ hardConstraints = [], negotiableGoals = [], options = [] } = {}) {
    if (!Array.isArray(hardConstraints) || !Array.isArray(negotiableGoals) || !Array.isArray(options) || options.length < 1 || options.length > 64) throw new TypeError('hardConstraints, negotiableGoals and 1-64 options are required');
    const hardIds = hardConstraints.map((item, index) => text(item.constraintId, `hardConstraints[${index}].constraintId`, 256));
    const goals = negotiableGoals.map((item, index) => ({ goalId: text(item.goalId, `negotiableGoals[${index}].goalId`, 256), weight: boundedNumber(item.weight, 1, 0, 100, `negotiableGoals[${index}].weight`) }));
    const rejectedOptions = []; const compliant = [];
    for (const [index, option] of options.entries()) {
      const optionId = text(option.optionId, `options[${index}].optionId`, 256);
      const violates = strings(option.violates ?? [], `options[${index}].violates`, 256, 256);
      const hardViolations = violates.filter((id) => hardIds.includes(id));
      if (hardViolations.length) { rejectedOptions.push({ optionId, reason: 'hard-constraint-violation', hardViolations }); continue; }
      const satisfies = strings(option.satisfies ?? [], `options[${index}].satisfies`, 256, 256);
      const missingHard = hardIds.filter((id) => !satisfies.includes(id));
      if (missingHard.length) { rejectedOptions.push({ optionId, reason: 'hard-constraint-unproven', hardViolations: missingHard }); continue; }
      const score = goals.reduce((sum, goal) => sum + goal.weight * Number(option.tradeoffs?.[goal.goalId] ?? 0), 0);
      compliant.push({ optionId, score });
    }
    compliant.sort((a, b) => b.score - a.score || a.optionId.localeCompare(b.optionId));
    return signed({ schema: 'forge.goal-conflict-resolution.v1', selectedOptionId: compliant[0]?.optionId ?? null, compliantOptions: compliant, rejectedOptions, unresolvedConflicts: compliant.length ? [] : ['no-hard-constraint-compliant-option'], claims: { hardConstraintsWeakened: false, acceptanceCriteriaRewritten: false } });
  }
}
