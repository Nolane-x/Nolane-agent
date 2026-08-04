const DEFAULT_BUDGETS = Object.freeze({ planner: 32_000, executor: 48_000, reviewer: 32_000, debugger: 48_000, subagent: 24_000 });

function boundedBudget(value, fallback) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10_000_000) throw new TypeError('context budget must be an integer between 1 and 10000000');
  return parsed;
}

export class ContextPlannerV2 {
  constructor({ budgets = {} } = {}) {
    this.budgets = Object.freeze(Object.fromEntries(Object.entries({ ...DEFAULT_BUDGETS, ...budgets }).map(([role, value]) => [role, boundedBudget(value, DEFAULT_BUDGETS[role] ?? 32_000)])));
  }

  plan({ role, items = [], budgetChars } = {}) {
    const normalizedRole = String(role ?? 'executor');
    const budget = boundedBudget(budgetChars, this.budgets[normalizedRole] ?? 32_000);
    if (!Array.isArray(items)) throw new TypeError('context items must be an array');
    const normalized = items.map((item, index) => {
      if (!item || typeof item !== 'object') throw new TypeError(`context item ${index} must be an object`);
      const text = String(item.text ?? '');
      return {
        ...item,
        id: String(item.id ?? `item-${index}`),
        category: String(item.category ?? 'other'),
        text,
        chars: text.length,
        priority: Number.isFinite(Number(item.priority)) ? Number(item.priority) : 0,
        roles: Array.isArray(item.roles) ? item.roles.map(String) : null,
        originalIndex: index,
      };
    });

    const eligible = [];
    const omissions = [];
    for (const item of normalized) {
      if (item.roles && !item.roles.includes(normalizedRole)) omissions.push({ id: item.id, category: item.category, reason: 'role_not_applicable', chars: item.chars });
      else eligible.push(item);
    }
    const defaultCategoryRank = { task: 100, system: 95, instructions: 90, diagnostics: 85, toolOutput: 80, code: 70, diff: 68, test: 65, memory: 40, history: 30 };
    const debuggerCategoryRank = { ...defaultCategoryRank, diagnostics: 120, toolOutput: 115, task: 100 };
    const categoryRank = normalizedRole === 'debugger' ? debuggerCategoryRank : defaultCategoryRank;
    eligible.sort((left, right) => (categoryRank[right.category] ?? 50) - (categoryRank[left.category] ?? 50) || right.priority - left.priority || left.originalIndex - right.originalIndex);

    const selected = [];
    let usedChars = 0;
    for (const item of eligible) {
      if (item.chars <= budget - usedChars) {
        selected.push({ ...item, selectionReason: `selected:${item.category}:priority=${item.priority}` });
        usedChars += item.chars;
      } else {
        omissions.push({ id: item.id, category: item.category, reason: item.chars > budget ? 'item_exceeds_role_budget' : 'remaining_budget_exhausted', chars: item.chars });
      }
    }
    return Object.freeze({ schema: 'forge.context-plan.v2', role: normalizedRole, budgetChars: budget, usedChars, remainingChars: budget - usedChars, selected: Object.freeze(selected), omissions: Object.freeze(omissions) });
  }
}
