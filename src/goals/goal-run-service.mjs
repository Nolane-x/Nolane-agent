function uniqueActions(value) {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(['open', 'goto', 'snapshot', 'find', 'click', 'fill', 'press', 'tabs', 'screenshot', 'close', 'status']);
  return [...new Set(value.map(String))].filter((item) => allowed.has(item));
}

export class GoalRunService {
  constructor({ store, goalService, runCoordinator } = {}) {
    if (!store?.updateMission || !goalService?.create || !runCoordinator?.createRun) throw new TypeError('GoalRunService dependencies are required');
    this.store = store; this.goals = goalService; this.runs = runCoordinator;
  }

  createAndStart(input = {}) {
    const goal = this.goals.create({
      projectId: input.projectId,
      title: input.title ?? input.objective,
      objective: input.objective,
      successCriteria: input.successCriteria ?? [],
      budget: input.budget ?? {},
      schedule: input.schedule ?? { kind: 'manual' },
      assumptions: input.assumptions ?? [],
      metadata: input.metadata ?? {},
    });
    return this.start(goal.id, input);
  }

  start(goalId, options = {}) {
    const goal = this.goals.get(goalId);
    if (!goal) throw new Error(`Unknown goal: ${goalId}`);
    if (goal.status !== 'active') throw new Error(`Goal ${goalId} is not active`);
    const browserAllowedActions = uniqueActions(options.browserAllowedActions ?? goal.metadata?.browserAllowedActions ?? []);
    const run = this.runs.createRun({
      projectId: goal.projectId,
      objective: options.objective ?? goal.objective,
      autonomyProfile: options.autonomyProfile ?? goal.metadata?.autonomyProfile ?? 'workspace-autopilot',
      providerId: options.providerId ?? goal.metadata?.providerId ?? 'auto',
      budgets: options.budgets ?? goal.budget,
      maxTasks: options.maxTasks ?? goal.metadata?.maxTasks ?? 64,
      mcpAllowedTools: options.mcpAllowedTools ?? goal.metadata?.mcpAllowedTools ?? [],
    });
    const mission = this.store.updateMission(run.mission.id, {
      metadata: {
        ...run.mission.metadata,
        goalId: goal.id,
        browserAllowedActions,
        goalAutoApplyPlanPatches: options.autoApplyPlanPatches ?? goal.metadata?.goalAutoApplyPlanPatches ?? goal.metadata?.autoApplyPlanPatches ?? true,
        createdFrom: 'goal-os',
      },
    });
    const linked = this.goals.attachMission(goal.id, mission.id, { relation: 'primary' });
    return Object.freeze({ goal: linked, run: Object.freeze({ ...run, mission }) });
  }

  async startAndWait(goalId, options = {}) {
    if (typeof this.runs.whenSettled !== 'function') throw new TypeError('GoalRunService requires runCoordinator.whenSettled for scheduled runs');
    const started = this.start(goalId, options);
    const missionId = String(started?.run?.mission?.id ?? '').trim();
    if (!missionId) throw new Error('Scheduled goal did not create a mission');
    await this.runs.whenSettled(missionId);
    const mission = this.store.getMission(missionId);
    if (mission?.status !== 'completed') throw Object.assign(new Error(`Scheduled goal mission did not complete: ${mission?.status ?? 'missing'}`), { code: 'GOAL_SCHEDULED_RUN_INCOMPLETE', missionId, missionStatus: mission?.status ?? 'missing' });
    return Object.freeze({ ...started, runId: missionId, missionStatus: mission.status });
  }
}
