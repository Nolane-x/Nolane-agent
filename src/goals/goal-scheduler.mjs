import { createEvent } from '../protocol/events.mjs';

export class GoalScheduler {
  constructor({ store, goalService, runGoal, repositoryFingerprint = null, clock = Date.now, tickEveryMs = 30_000 } = {}) {
    if (!store?.getGoalScheduleState || !store?.upsertGoalScheduleState || !store?.appendEvent) throw new TypeError('GoalScheduler store is required');
    if (!goalService?.list) throw new TypeError('GoalScheduler goalService is required');
    if (typeof runGoal !== 'function') throw new TypeError('GoalScheduler runGoal is required');
    this.store = store; this.goals = goalService; this.runGoal = runGoal; this.repositoryFingerprint = repositoryFingerprint; this.clock = clock;
    this.tickEveryMs = Math.max(1_000, Number(tickEveryMs) || 30_000); this.timer = null; this.tickInFlight = null;
  }

  async tick() {
    const now = Number(this.clock()); const started = []; const skipped = [];
    for (const goal of this.goals.list({ status: 'active' })) {
      const schedule = goal.schedule ?? { kind: 'manual' };
      if (schedule.kind === 'manual') { skipped.push({ goalId: goal.id, reason: 'manual' }); continue; }
      let state = this.store.getGoalScheduleState(goal.id) ?? this.store.upsertGoalScheduleState(goal.id, {});
      if (state.running) { skipped.push({ goalId: goal.id, reason: 'already-running' }); continue; }
      let due = false; let currentFingerprint = null;
      if (schedule.kind === 'interval') due = state.lastRunAt == null || now >= Number(state.lastRunAt) + Number(schedule.everyMs);
      else if (schedule.kind === 'repository-change') {
        if (typeof this.repositoryFingerprint !== 'function') { skipped.push({ goalId: goal.id, reason: 'repository-fingerprint-unavailable' }); continue; }
        currentFingerprint = String(await this.repositoryFingerprint(goal));
        if (state.lastRepoFingerprint == null) {
          this.store.upsertGoalScheduleState(goal.id, { lastRepoFingerprint: currentFingerprint, pendingRepoFingerprint: null, pendingSince: null });
          skipped.push({ goalId: goal.id, reason: 'repository-baseline' }); continue;
        }
        if (currentFingerprint === state.lastRepoFingerprint) {
          if (state.pendingRepoFingerprint) this.store.upsertGoalScheduleState(goal.id, { pendingRepoFingerprint: null, pendingSince: null });
          skipped.push({ goalId: goal.id, reason: 'repository-unchanged' }); continue;
        }
        if (state.pendingRepoFingerprint !== currentFingerprint) {
          this.store.upsertGoalScheduleState(goal.id, { pendingRepoFingerprint: currentFingerprint, pendingSince: now });
          skipped.push({ goalId: goal.id, reason: 'repository-debounce' }); continue;
        }
        due = now - Number(state.pendingSince ?? now) >= Math.max(5_000, Number(schedule.debounceMs) || 30_000);
        if (!due) { skipped.push({ goalId: goal.id, reason: 'repository-debounce' }); continue; }
      }
      if (!due) { skipped.push({ goalId: goal.id, reason: 'not-due' }); continue; }

      state = this.store.upsertGoalScheduleState(goal.id, { running: true, runningSince: now });
      this.store.appendEvent(createEvent('goal.schedule.started', { schedule: schedule.kind }, { projectId: goal.projectId, goalId: goal.id }));
      try {
        const result = await this.runGoal(goal);
        const completedAt = Number(this.clock());
        this.store.upsertGoalScheduleState(goal.id, { running: false, runningSince: null, lastRunAt: completedAt, lastRunId: result?.runId ?? result?.id ?? null, nextRunAt: schedule.kind === 'interval' ? completedAt + Number(schedule.everyMs) : null, ...(schedule.kind === 'repository-change' ? { lastRepoFingerprint: currentFingerprint, pendingRepoFingerprint: null, pendingSince: null } : {}) });
        this.store.appendEvent(createEvent('goal.schedule.completed', { runId: result?.runId ?? result?.id ?? null }, { projectId: goal.projectId, goalId: goal.id }));
        started.push({ goalId: goal.id, runId: result?.runId ?? result?.id ?? null });
      } catch (error) {
        this.store.upsertGoalScheduleState(goal.id, { running: false, runningSince: null });
        this.store.appendEvent(createEvent('goal.schedule.failed', { error: String(error.message ?? error).slice(0, 2_000) }, { projectId: goal.projectId, goalId: goal.id }));
        skipped.push({ goalId: goal.id, reason: 'run-failed', error: String(error.message ?? error) });
      }
    }
    return Object.freeze({ started: Object.freeze(started), skipped: Object.freeze(skipped) });
  }

  start() {
    if (this.timer) return false;
    this.timer = setInterval(() => { if (!this.tickInFlight) this.tickInFlight = this.tick().finally(() => { this.tickInFlight = null; }); }, this.tickEveryMs);
    this.timer.unref?.();
    return true;
  }

  stop() { if (!this.timer) return false; clearInterval(this.timer); this.timer = null; return true; }
}
