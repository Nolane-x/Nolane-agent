const ROLES = new Set(['coordinator', 'scout', 'builder', 'reviewer', 'integrator']);
const SYSTEM_DENIED_PATHS = Object.freeze(['.env', '.env.*', '**/*.pem', '**/*.key']);

function extractJson(text) {
  const source = String(text ?? '').trim();
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced ?? source;
  try { return JSON.parse(candidate); }
  catch (error) { throw new Error(`Planner output must be valid JSON: ${error.message}`); }
}

function strings(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) throw new Error(`${label} must be an array of strings`);
  return [...value];
}

function deniedPaths(value, label) {
  return [...new Set([...SYSTEM_DENIED_PATHS, ...strings(value ?? [], label)])];
}

function validate(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.tasks)) throw new Error('Planner output must contain a tasks array');
  if (value.tasks.length < 1 || value.tasks.length > 64) throw new Error('Planner task count must be between 1 and 64');
  const ids = new Set();
  const tasks = value.tasks.map((task, index) => {
    if (!task || typeof task !== 'object') throw new Error(`Planner task ${index + 1} must be an object`);
    const id = String(task.id ?? '').trim();
    const title = String(task.title ?? '').trim();
    const objective = String(task.objective ?? '').trim();
    const role = String(task.role ?? '').trim();
    if (!id || ids.has(id)) throw new Error(`Planner task id is missing or duplicated: ${id || index + 1}`);
    if (!title || !objective) throw new Error(`Planner task ${id} requires title and objective`);
    if (!ROLES.has(role)) throw new Error(`Planner task ${id} has unsupported role: ${role}`);
    ids.add(id);
    return {
      id, title, objective, role,
      dependencies: strings(task.dependencies ?? [], `${id}.dependencies`),
      allowedPaths: strings(task.allowedPaths ?? [], `${id}.allowedPaths`),
      deniedPaths: deniedPaths(task.deniedPaths, `${id}.deniedPaths`),
      metadata: task.metadata && typeof task.metadata === 'object' ? structuredClone(task.metadata) : {},
    };
  });
  for (const task of tasks) for (const dependency of task.dependencies) if (!ids.has(dependency) || dependency === task.id) throw new Error(`Planner task ${task.id} has invalid dependency: ${dependency}`);
  const builders = tasks.filter((task) => task.role === 'builder');
  const reviewers = tasks.filter((task) => task.role === 'reviewer');
  if (builders.length && !reviewers.length) throw new Error('Planner must assign an independent reviewer for builder work');
  for (const builder of builders) if (!reviewers.some((reviewer) => reviewer.dependencies.includes(builder.id))) throw new Error(`Planner builder ${builder.id} lacks a dependent reviewer`);
  return Object.freeze({ summary: String(value.summary ?? '').trim(), tasks: Object.freeze(tasks) });
}

function planningPrompt(objective) {
  return `Create a minimal executable coding mission DAG for this objective:

${String(objective)}

Return JSON only with schema {"summary":string,"tasks":[{"id":string,"title":string,"objective":string,"role":"coordinator|scout|builder|reviewer|integrator","dependencies":string[],"allowedPaths":string[],"deniedPaths":string[],"metadata":{"taskKind"?:string,"verificationCommands"?:Array<{"command":string,"args":string[],"cwd":string}>,"testMatrix"?:{"changedPaths":string[],"relatedTests":string[],"requireFull":boolean,"timeoutMs"?:number},"selfFix"?:{"enabled":boolean,"maxAttempts":number,"maxStagnantAttempts":number}}}]}.
Constraints: 1-64 tasks; use the fewest tasks that preserve safety; every builder requires a separate reviewer depending on it; avoid overlapping write ownership among parallel builders; reviewers must be able to read the candidate; deny secrets and credential files; commands must use argv arrays and no shell pipelines; builder and integrator tasks should include testMatrix with requireFull=true and selfFix with enabled=true, maxAttempts<=3, maxStagnantAttempts<=1; do not include markdown.`;
}

export class PlanningInputRequiredError extends Error {
  constructor({ inputRequest, preflightReceiptSha256 } = {}) {
    super('Planning requires additional user input');
    this.name = 'PlanningInputRequiredError';
    this.code = 'PLANNING_INPUT_REQUIRED';
    this.inputRequest = inputRequest ?? null;
    this.preflightReceiptSha256 = String(preflightReceiptSha256 ?? '');
  }
}

export class MissionPlanner {
  constructor({ router, maxAttempts = 2, evidenceGovernance = null } = {}) {
    if (!router?.select) throw new TypeError('MissionPlanner provider router is required');
    this.router = router;
    this.evidenceGovernance = evidenceGovernance;
    if (evidenceGovernance && (!evidenceGovernance.preflight || !evidenceGovernance.enrichPlan)) throw new TypeError('MissionPlanner evidenceGovernance must provide preflight and enrichPlan');
    this.maxAttempts = Number(maxAttempts);
    if (!Number.isInteger(this.maxAttempts) || this.maxAttempts < 1 || this.maxAttempts > 3) throw new TypeError('maxAttempts must be between 1 and 3');
  }

  async plan({ projectId, objective, providerId = 'auto', modelId = null, effort = null, signal = null, changedPaths = [] } = {}) {
    const preflight = this.evidenceGovernance ? await this.evidenceGovernance.preflight({ projectId, objective, changedPaths }) : null;
    if (preflight?.status === 'needs-input') throw new PlanningInputRequiredError({ inputRequest: preflight.inputRequest, preflightReceiptSha256: preflight.receiptSha256 });
    const provider = this.router.select({ providerId, requiredCapabilities: ['coding', 'structured-output', 'governed-actions'] });
    let lastError;
    let prior = '';
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const instruction = attempt === 1 ? planningPrompt(objective) : `${planningPrompt(objective)}\n\nYour previous response was invalid: ${lastError.message}. Produce corrected JSON only. Previous response:\n${prior.slice(0, 4000)}`;
      const completion = await provider.complete({
        messages: [
          { role: 'system', content: 'You are the Forge Studio mission planner. You may only produce a bounded plan; you have no tools and may not perform side effects.' },
          { role: 'user', content: instruction },
        ],
        tools: [],
        ...(modelId ? { model: String(modelId) } : {}),
        ...(effort ? { effort: String(effort) } : {}),
        signal,
      });
      prior = String(completion.text ?? '');
      try {
        const plan = validate(extractJson(prior));
        const planningEvidence = this.evidenceGovernance ? this.evidenceGovernance.enrichPlan({ preflight, plan }) : null;
        return Object.freeze({
          ...plan,
          ...(planningEvidence ? { tasks: planningEvidence.tasks, planningEvidence } : {}),
          metadata: Object.freeze({ projectId: String(projectId ?? ''), providerId: provider.id, modelId: modelId ? String(modelId) : (completion.model ?? null), ...(effort ? { effort: String(effort) } : {}), attempts: attempt, ...(planningEvidence ? { planningEvidenceReceiptSha256: planningEvidence.receiptSha256 } : {}) }),
        });
      } catch (error) { lastError = error; }
    }
    throw new Error(`Planner failed after ${this.maxAttempts} attempt(s): ${lastError?.message ?? 'unknown error'}`);
  }
}
