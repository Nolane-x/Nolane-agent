import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { createExecutionStoryEvent, createExecutionStoryPhase, EXECUTION_STORY_SCHEMA, normalizeExperienceLevel, visibleAt } from './execution-story-schema.mjs';

function freeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) freeze(child, seen);
  return Object.freeze(value);
}

function bounded(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.floor(number))) : fallback;
}

function belongsToMission(event, mission, goalId) {
  return event.refs?.missionId === mission.id || event.payload?.missionId === mission.id || (goalId && (event.refs?.goalId === goalId || event.payload?.goalId === goalId));
}

function aggregate(events, language) {
  const phases = [];
  let bucket = [];
  for (const event of events) {
    const key = event.phase ?? event.category;
    const previous = bucket.at(-1);
    const breakPhase = previous && ((previous.phase ?? previous.category) !== key || previous.state === 'failed' || event.state === 'failed' || bucket.length >= 50);
    if (breakPhase) { phases.push(createExecutionStoryPhase(bucket, { language })); bucket = []; }
    bucket.push(event);
  }
  if (bucket.length) phases.push(createExecutionStoryPhase(bucket, { language }));
  return phases;
}

function metrics(events, technicalEvents = []) {
  const filesRead = new Set(); const filesChanged = new Set(); const receipts = new Set();
  let commands = 0; let tools = 0; let tests = 0; let approvals = 0; let failures = 0; let artifacts = 0;
  for (const source of technicalEvents) {
    const payload = source.payload ?? {};
    const tool = String(payload.tool ?? payload.toolName ?? '').toLowerCase();
    const type = String(source.type ?? '').toLowerCase();
    const file = payload.path ?? payload.relativePath ?? (tool.startsWith('fs.') ? payload.target : null);
    if (file) {
      if (tool === 'fs.read' || /read|context-selected/.test(type)) filesRead.add(String(file));
      else if (/^fs\.(?:write|patch|patchset|delete|rename)$/.test(tool) || /file.*(?:write|changed)|patch/.test(type)) filesChanged.add(String(file));
    }
    if (tool === 'process.run' || /command|shell|terminal|process/.test(type)) commands += 1;
    if (tool && tool !== 'process.run') tools += 1;
    if (/verification|verify|test|lint|build/.test(type) || tool === 'process.run' && /(?:test|lint|build|check)/i.test(String(payload.target ?? payload.command ?? ''))) tests += 1;
    if (/approval|permission|capabilit/.test(type)) approvals += 1;
    if (/fail|error|denied|rejected/.test(`${type} ${payload.status ?? ''}`)) failures += 1;
    if (/artifact|output|export/.test(type)) artifacts += 1;
  }
  for (const event of events) for (const value of event.references?.receiptSha256 ?? []) receipts.add(value);
  return { filesRead: filesRead.size, filesChanged: filesChanged.size, commands, tools, tests, approvals, failures, artifacts, receipts: receipts.size };
}

export class ExecutionStoryService {
  constructor({ store, activityProjection = null, clock = () => new Date().toISOString() } = {}) {
    if (!store?.getMission || !store?.listEvents) throw new TypeError('ExecutionStoryService store is required');
    this.store = store;
    this.activityProjection = activityProjection;
    this.clock = clock;
  }

  snapshot({ missionId, level = 'workspace', language = 'en', afterSeq = 0, limit = 2_000 } = {}) {
    const id = String(missionId ?? '').trim();
    if (!id) throw Object.assign(new TypeError('missionId is required'), { statusCode: 400, code: 'MISSION_ID_REQUIRED' });
    const mission = this.store.getMission(id);
    if (!mission) throw Object.assign(new Error(`Unknown mission: ${id}`), { statusCode: 404, code: 'MISSION_NOT_FOUND' });
    const normalizedLevel = normalizeExperienceLevel(level);
    const safeLimit = bounded(limit, 2_000, 1, 10_000);
    const cursor = Math.max(0, Number(afterSeq) || 0);
    const goalId = mission.metadata?.goalId ?? null;
    const technicalEvents = this.store.listEvents({ afterSeq: cursor, limit: 100_000 }).filter((event) => belongsToMission(event, mission, goalId)).slice(0, safeLimit);
    const storyEvents = technicalEvents.map((event) => createExecutionStoryEvent(event, {
      activity: this.activityProjection?.projectEvent?.(event) ?? null,
      level: normalizedLevel,
      language,
    })).filter((event) => visibleAt(event, normalizedLevel));
    const phases = aggregate(storyEvents, language);
    const taskList = this.store.listTasks?.({ missionId: mission.id }) ?? [];
    const base = {
      schema: EXECUTION_STORY_SCHEMA,
      generatedAt: this.clock(),
      mission: { id: mission.id, projectId: mission.projectId ?? null, objective: mission.objective ?? mission.title ?? null, status: mission.status, updatedAt: mission.updatedAt },
      level: normalizedLevel,
      language: language === 'vi' ? 'vi' : 'en',
      cursor: { afterSeq: cursor, nextSeq: storyEvents.at(-1)?.seq ?? cursor, sourceEventsScanned: technicalEvents.length },
      summary: {
        currentPhase: phases.findLast?.((phase) => phase.state === 'active')?.category ?? phases.at(-1)?.category ?? null,
        state: storyEvents.some((event) => event.state === 'failed') ? 'attention' : mission.status,
        events: storyEvents.length,
        phases: phases.length,
        tasks: taskList.length,
        completedTasks: taskList.filter((task) => ['completed', 'verified', 'pass', 'passed'].includes(String(task.status).toLowerCase())).length,
        ...metrics(storyEvents, technicalEvents),
      },
      phases,
      events: storyEvents,
    };
    return freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  exportBundle(input = {}) {
    const story = this.snapshot({ ...input, level: 'expert', limit: Math.min(10_000, Number(input.limit) || 10_000) });
    const base = { schema: 'nolane.execution-story-export.v1', exportedAt: this.clock(), story };
    return freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
}
