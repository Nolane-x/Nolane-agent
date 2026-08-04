import { deepFreeze } from '../config.mjs';
import { redactSecrets } from '../security/redaction.mjs';

const BLOCKED_STATUSES = new Set(['blocked', 'failed', 'changes-requested']);
const ACTIVE_EVENT_TYPES = new Set([
  'agent.tool.started',
  'agent.model.requested',
  'agent.model.started',
  'mission.task.started',
  'browser.action.started',
]);

function boundedInteger(value, fallback, { min = 1, max = 100_000 } = {}) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new TypeError(`graph limit must be an integer between ${min} and ${max}`);
  return number;
}

function cleanEvent(event) {
  return redactSecrets({
    seq: event.seq,
    id: event.id,
    time: event.time,
    type: event.type,
    refs: event.refs ?? {},
    payload: event.payload ?? {},
  });
}

function eventTarget(event) {
  const payload = event?.payload ?? {};
  return payload.target ?? payload.path ?? payload.url ?? payload.file ?? payload.tool ?? payload.command ?? null;
}

function tokenUsage(events) {
  return events.reduce((sum, event) => {
    const usage = event.payload?.usage ?? {};
    sum.inputTokens += Number(usage.inputTokens ?? 0) || 0;
    sum.outputTokens += Number(usage.outputTokens ?? 0) || 0;
    sum.totalTokens += Number(usage.totalTokens ?? 0) || 0;
    sum.estimated ||= usage.estimated === true;
    return sum;
  }, { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimated: false });
}

function node(id, kind, label, metadata = {}) {
  return { id, kind, label, metadata };
}

function edge(from, to, kind, metadata = {}) {
  return { id: `${kind}:${from}:${to}`, from, to, kind, metadata };
}

export class MissionGraphProjection {
  constructor({ store, maxEvents = 500, maxNodes = 1_000, maxEdges = 2_000 } = {}) {
    if (!store?.getMission || !store?.listTasks || !store?.listEvents) throw new TypeError('MissionGraphProjection store is required');
    this.store = store;
    this.maxEvents = boundedInteger(maxEvents, 500, { max: 10_000 });
    this.maxNodes = boundedInteger(maxNodes, 1_000, { max: 10_000 });
    this.maxEdges = boundedInteger(maxEdges, 2_000, { max: 20_000 });
  }

  snapshot({ goalId = null, missionId = null } = {}) {
    if (!goalId && !missionId) throw new TypeError('goalId or missionId is required');

    let goal = goalId ? this.store.getGoal?.(String(goalId)) : null;
    if (goalId && !goal) throw new Error(`Unknown goal: ${goalId}`);
    const resolvedMissionId = missionId ?? goal?.activeMissionId ?? null;
    if (!resolvedMissionId) throw new Error(`Goal has no active mission: ${goalId}`);
    const mission = this.store.getMission(String(resolvedMissionId));
    if (!mission) throw new Error(`Unknown mission: ${resolvedMissionId}`);

    if (!goal && this.store.listGoals) {
      goal = this.store.listGoals({ projectId: mission.projectId }).find((item) => item.activeMissionId === mission.id
        || this.store.listGoalMissions?.(item.id)?.some((link) => link.missionId === mission.id)) ?? null;
    }
    if (goal && goal.projectId !== mission.projectId) throw new Error('Goal and mission must belong to the same project');

    const tasks = this.store.listTasks({ missionId: mission.id });
    const taskIds = new Set(tasks.map((task) => task.id));
    const runs = tasks.flatMap((task) => this.store.listRuns?.({ taskId: task.id }) ?? []);
    const runIds = new Set(runs.map((run) => run.id));

    const allMatchingEvents = this.store.listEvents({ afterSeq: 0, limit: 100_000 }).filter((event) => {
      const refs = event.refs ?? {};
      if (refs.missionId === mission.id) return true;
      if (goal && refs.goalId === goal.id) return true;
      if (refs.taskId && taskIds.has(refs.taskId)) return true;
      return Boolean(refs.runId && runIds.has(refs.runId));
    });
    const selectedEvents = allMatchingEvents.slice(-this.maxEvents);

    const rawNodes = [];
    const rawEdges = [];
    if (goal) {
      rawNodes.push(node(`goal:${goal.id}`, 'goal', goal.title, { status: goal.status, revision: goal.revision }));
      rawEdges.push(edge(`goal:${goal.id}`, `mission:${mission.id}`, 'contains'));
    }
    rawNodes.push(node(`mission:${mission.id}`, 'mission', mission.objective, { status: mission.status }));

    for (const task of tasks) {
      rawNodes.push(node(`task:${task.id}`, 'task', task.title, { status: task.status, role: task.role, updatedAt: task.updatedAt }));
      rawEdges.push(edge(`mission:${mission.id}`, `task:${task.id}`, 'contains'));
      for (const dependency of task.dependencies ?? []) {
        if (taskIds.has(dependency)) rawEdges.push(edge(`task:${dependency}`, `task:${task.id}`, 'depends-on'));
      }
    }

    const agentProviders = new Set();
    for (const run of runs) {
      agentProviders.add(run.providerId);
      rawNodes.push(node(`run:${run.id}`, 'run', `${run.providerId} run`, { state: run.state, taskId: run.taskId, updatedAt: run.updatedAt }));
      rawEdges.push(edge(`task:${run.taskId}`, `run:${run.id}`, 'executes'));
      rawEdges.push(edge(`agent:${run.providerId}`, `run:${run.id}`, 'owns'));
    }
    for (const event of selectedEvents) {
      const providerId = event.payload?.providerId;
      if (providerId) agentProviders.add(String(providerId));
    }
    for (const providerId of agentProviders) rawNodes.push(node(`agent:${providerId}`, 'agent', providerId, { providerId }));

    const activeEvent = [...selectedEvents].reverse().find((event) => ACTIVE_EVENT_TYPES.has(event.type)) ?? null;
    const active = activeEvent ? {
      eventId: activeEvent.id,
      type: activeEvent.type,
      time: activeEvent.time,
      providerId: activeEvent.payload?.providerId ?? runs.find((run) => run.id === activeEvent.refs?.runId)?.providerId ?? null,
      taskId: activeEvent.refs?.taskId ?? null,
      runId: activeEvent.refs?.runId ?? null,
      target: eventTarget(activeEvent),
      tool: activeEvent.payload?.tool ?? null,
    } : null;

    const discoveries = goal && this.store.listGoalFacts ? this.store.listGoalFacts(goal.id) : [];
    const planPatches = goal && this.store.listGoalPlanPatches ? this.store.listGoalPlanPatches(goal.id) : [];
    const blockers = tasks.filter((task) => BLOCKED_STATUSES.has(task.status)).map((task) => ({ taskId: task.id, title: task.title, status: task.status, reason: task.metadata?.blockedReason ?? task.metadata?.lastError ?? null }));

    const nodes = rawNodes.slice(0, this.maxNodes);
    const visibleNodeIds = new Set(nodes.map((item) => item.id));
    const edges = rawEdges.filter((item) => visibleNodeIds.has(item.from) && visibleNodeIds.has(item.to)).slice(0, this.maxEdges);

    return deepFreeze({
      schema: 'forge.studio.mission-graph.v1',
      generatedAt: new Date().toISOString(),
      projectId: mission.projectId,
      goal,
      mission,
      active,
      usage: tokenUsage(selectedEvents),
      discoveries,
      planPatches,
      blockers,
      nodes,
      edges,
      events: selectedEvents.map(cleanEvent),
      truncated: {
        events: allMatchingEvents.length > selectedEvents.length,
        nodes: rawNodes.length > nodes.length,
        edges: rawEdges.length > edges.length,
      },
    });
  }
}
