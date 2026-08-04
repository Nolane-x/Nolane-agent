function compactText(value, max = 400) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function evidenceSummary(item) {
  return compactText(item?.payload?.summary || `${item.kind} ${item.status}`, 240);
}

function changeSummary(task) {
  return compactText(task.metadata?.handoff?.output || task.metadata?.candidateOutput || task.objective, 500);
}

const EVIDENCE_PRIORITY = Object.freeze({ 'diff-check': 10, 'verification-command': 20, security: 30 });

function orderedEvidence(items) {
  return [...items].sort((left, right) => {
    const priority = (EVIDENCE_PRIORITY[left.kind] ?? 100) - (EVIDENCE_PRIORITY[right.kind] ?? 100);
    if (priority !== 0) return priority;
    return String(left.createdAt ?? '').localeCompare(String(right.createdAt ?? '')) || String(left.id ?? '').localeCompare(String(right.id ?? ''));
  });
}

export class ReviewSummary {
  constructor({ store, gitInspector = null } = {}) {
    if (!store?.getMission || !store?.listTasks || !store?.listEvidence) {
      throw new TypeError('ReviewSummary store is required');
    }
    this.store = store;
    this.gitInspector = gitInspector;
  }

  async #change(task, mission) {
    let files = [];
    let diffStat = '';
    if (this.gitInspector?.snapshot) {
      try {
        const snapshot = await this.gitInspector.snapshot({ projectId: mission.projectId, taskId: task.id });
        files = [...new Set((snapshot.status ?? []).map((entry) => String(entry.path ?? '').trim()).filter(Boolean))].slice(0, 200);
        diffStat = compactText(snapshot.diffStat, 500);
      } catch {
        // A removed or unavailable worktree should not make the human review page fail.
      }
    }
    return Object.freeze({
      taskId: task.id,
      title: task.title,
      status: task.status,
      summary: changeSummary(task),
      files: Object.freeze(files),
      diffStat,
    });
  }

  async snapshot(missionId) {
    const mission = this.store.getMission(String(missionId ?? ''));
    if (!mission) throw new Error(`Unknown mission: ${missionId}`);
    const tasks = this.store.listTasks({ missionId: mission.id });
    const evidence = orderedEvidence(tasks.flatMap((task) => this.store.listEvidence({ taskId: task.id })));
    const builders = tasks.filter((task) => ['builder', 'integrator'].includes(task.role));
    const changes = await Promise.all(builders.map((task) => this.#change(task, mission)));
    const passed = evidence.filter((item) => item.status === 'pass').length;
    const failed = evidence.filter((item) => item.status !== 'pass').length;
    const checks = evidence.map(evidenceSummary).filter(Boolean).slice(0, 100);
    const rolledBackAt = mission.metadata?.rolledBackAt ?? null;
    const hasManagedCandidate = builders.some((task) => task.metadata?.worktree?.path);

    return Object.freeze({
      schema: 'forge.review.summary.v1',
      missionId: mission.id,
      objective: mission.objective,
      status: mission.status,
      summary: compactText(mission.metadata?.summary || mission.objective, 800),
      progress: Object.freeze({
        total: tasks.length,
        done: tasks.filter((task) => task.status === 'done').length,
        failed: tasks.filter((task) => ['failed', 'cancelled'].includes(task.status)).length,
      }),
      changes: Object.freeze(changes),
      verification: Object.freeze({
        status: failed > 0 ? 'fail' : evidence.length > 0 && passed === evidence.length ? 'pass' : 'pending',
        passed,
        total: evidence.length,
        checks: Object.freeze(checks),
      }),
      canRollback: Boolean(hasManagedCandidate && !rolledBackAt),
      rolledBackAt,
      previewUrl: mission.metadata?.previewUrl ?? null,
    });
  }
}
