function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

const READ = ['read', 'search', 'history', 'diagnostics'];
const EDIT = [...READ, 'edit', 'test', 'terminal'];
const SPECIALIST = [...EDIT, 'git'];

function mode(id, label, description, overrides = {}) {
  const readOnly = overrides.readOnly === true;
  return deepFreeze({
    schema: 'forge.agent-mode.v1',
    id, label, description,
    category: overrides.category ?? (readOnly ? 'analysis' : 'execution'),
    autonomyProfile: overrides.autonomyProfile ?? (readOnly ? 'guided' : 'workspace-autopilot'),
    readOnly,
    writesAllowed: !readOnly,
    approvalPolicy: overrides.approvalPolicy ?? (readOnly ? 'always' : 'risk-based'),
    networkPolicy: overrides.networkPolicy ?? { mode: 'deny', domains: [], ports: [] },
    localOnly: overrides.localOnly === true,
    backgroundAllowed: overrides.backgroundAllowed === true,
    commitPolicy: overrides.commitPolicy ?? (readOnly ? 'deny' : 'ask'),
    allowChildAgents: overrides.allowChildAgents === true,
    requiredCapabilities: overrides.requiredCapabilities ?? (readOnly ? ['file.read', 'repository.search'] : ['file.read', 'repository.search', 'file.write', 'process.run']),
    toolGroups: overrides.toolGroups ?? (readOnly ? READ : EDIT),
    deniedToolGroups: overrides.deniedToolGroups ?? [],
    taskKinds: overrides.taskKinds ?? ['general'],
    routingMode: overrides.routingMode ?? 'balance',
    maxTurns: overrides.maxTurns ?? 20,
    maxTasks: overrides.maxTasks ?? 16,
    budgetTokens: overrides.budgetTokens ?? 40_000,
    contextBudget: overrides.contextBudget ?? 24_000,
    verificationDepth: overrides.verificationDepth ?? (readOnly ? 'none' : 'targeted'),
  });
}

const MODES = [
  mode('ask', 'Ask', 'Answer questions about the codebase without changing project state.', { readOnly: true, taskKinds: ['question-answer'], maxTurns: 12, maxTasks: 4, budgetTokens: 20_000, contextBudget: 18_000, routingMode: 'balance' }),
  mode('read-only', 'Read only', 'Investigate repository state with all mutating actions denied.', { readOnly: true, taskKinds: ['investigation'], maxTurns: 24, maxTasks: 12, budgetTokens: 45_000, contextBudget: 32_000, routingMode: 'intelligence' }),
  mode('plan', 'Plan', 'Research and produce an editable implementation plan without modifying files.', { readOnly: true, taskKinds: ['planning'], maxTurns: 28, maxTasks: 16, budgetTokens: 60_000, contextBudget: 40_000, routingMode: 'intelligence' }),
  mode('edit-approved', 'Edit with approval', 'Prepare exact changes and require approval for every state mutation.', { approvalPolicy: 'state-change', autonomyProfile: 'guided', toolGroups: EDIT, taskKinds: ['edit'], maxTasks: 16, commitPolicy: 'deny' }),
  mode('auto-edit', 'Auto edit', 'Apply reversible changes inside a managed worktree and verify them.', { toolGroups: SPECIALIST, taskKinds: ['feature', 'bugfix'], allowChildAgents: true, maxTasks: 32, maxTurns: 60, budgetTokens: 120_000, contextBudget: 48_000, verificationDepth: 'full' }),
  mode('review', 'Review', 'Review diffs, security and quality independently without editing.', { readOnly: true, taskKinds: ['review', 'security-review'], maxTurns: 32, maxTasks: 16, budgetTokens: 75_000, contextBudget: 48_000, routingMode: 'intelligence' }),
  mode('debug', 'Debug', 'Reproduce failures, inspect diagnostics and apply bounded verified fixes.', { toolGroups: SPECIALIST, taskKinds: ['debug'], maxTasks: 24, maxTurns: 80, budgetTokens: 140_000, contextBudget: 56_000, verificationDepth: 'full' }),
  mode('test-writer', 'Test writer', 'Create focused tests and run targeted then full verification.', { toolGroups: SPECIALIST, taskKinds: ['test'], maxTasks: 20, maxTurns: 48, budgetTokens: 90_000, verificationDepth: 'full' }),
  mode('refactor', 'Refactor', 'Restructure code while preserving behavior and minimizing patch size.', { toolGroups: SPECIALIST, taskKinds: ['refactor'], maxTasks: 28, maxTurns: 72, budgetTokens: 130_000, verificationDepth: 'full' }),
  mode('migration', 'Migration', 'Perform dependency, framework, schema or language migrations with staged verification.', { toolGroups: [...SPECIALIST, 'dependency'], taskKinds: ['migration'], allowChildAgents: true, maxTasks: 48, maxTurns: 120, budgetTokens: 220_000, contextBudget: 72_000, verificationDepth: 'full', networkPolicy: { mode: 'allowlist', domains: [], ports: [443] } }),
  mode('architecture', 'Architecture', 'Analyze structure, risks and alternatives without modifying files.', { readOnly: true, taskKinds: ['architecture'], maxTasks: 20, maxTurns: 48, budgetTokens: 110_000, contextBudget: 64_000, routingMode: 'intelligence' }),
  mode('project-create', 'Create project', 'Create a new project in a managed workspace with full verification.', { toolGroups: [...SPECIALIST, 'dependency'], taskKinds: ['project-create'], maxTasks: 40, maxTurns: 100, budgetTokens: 180_000, verificationDepth: 'full', networkPolicy: { mode: 'allowlist', domains: [], ports: [443] } }),
  mode('ci-repair', 'CI repair', 'Inspect CI configuration and repair failing pipelines locally.', { toolGroups: SPECIALIST, taskKinds: ['ci'], maxTasks: 24, maxTurns: 64, budgetTokens: 110_000, verificationDepth: 'full' }),
  mode('issue-resolution', 'Issue resolution', 'Translate an issue into scoped changes, tests and review evidence.', { toolGroups: SPECIALIST, taskKinds: ['issue'], allowChildAgents: true, maxTasks: 32, maxTurns: 80, budgetTokens: 145_000, verificationDepth: 'full' }),
  mode('background', 'Background', 'Run a trusted, durable local workflow that only prepares reviewable outputs.', { toolGroups: SPECIALIST, taskKinds: ['background'], allowChildAgents: true, backgroundAllowed: true, maxTasks: 48, maxTurns: 120, budgetTokens: 200_000, verificationDepth: 'full', commitPolicy: 'ask' }),
  mode('learn-codebase', 'Learn codebase', 'Build a cited understanding of architecture, conventions and workflows.', { readOnly: true, taskKinds: ['codebase-learning'], maxTasks: 24, maxTurns: 64, budgetTokens: 120_000, contextBudget: 72_000, routingMode: 'intelligence' }),
  mode('explain', 'Explain step by step', 'Explain code and decisions with cited evidence and no mutations.', { readOnly: true, taskKinds: ['explanation'], maxTasks: 12, maxTurns: 32, budgetTokens: 55_000, contextBudget: 40_000, routingMode: 'intelligence' }),
  mode('fast', 'Fast', 'Use a small bounded plan and cost-aware routing for low-latency work.', { toolGroups: EDIT, taskKinds: ['fast'], maxTasks: 6, maxTurns: 16, budgetTokens: 24_000, contextBudget: 16_000, routingMode: 'cost', verificationDepth: 'targeted', allowChildAgents: false }),
  mode('deep', 'Deep', 'Use larger budgets, multiple specialists and full verification for complex work.', { toolGroups: SPECIALIST, taskKinds: ['deep'], allowChildAgents: true, maxTasks: 64, maxTurns: 160, budgetTokens: 300_000, contextBudget: 96_000, routingMode: 'intelligence', verificationDepth: 'full', networkPolicy: { mode: 'allowlist', domains: [], ports: [443] }, commitPolicy: 'allow' }),
  mode('offline', 'Offline local', 'Run entirely with local models and deny all network access.', { toolGroups: [...SPECIALIST, 'dependency'], taskKinds: ['offline'], allowChildAgents: true, maxTasks: 24, maxTurns: 72, budgetTokens: 120_000, contextBudget: 48_000, localOnly: true, routingMode: 'cost', networkPolicy: { mode: 'deny', domains: [], ports: [] }, verificationDepth: 'full' }),
];

export const AGENT_MODE_IDS = Object.freeze(MODES.map((item) => item.id));
const BY_ID = new Map(MODES.map((item) => [item.id, item]));

export class AgentModeRegistry {
  list() { return Object.freeze([...MODES]); }
  get(id) { return BY_ID.get(String(id ?? '').trim()) ?? null; }
  require(id) {
    const item = this.get(id);
    if (!item) throw Object.assign(new Error(`Unknown agent mode: ${id}`), { code: 'AGENT_MODE_UNKNOWN' });
    return item;
  }
}
