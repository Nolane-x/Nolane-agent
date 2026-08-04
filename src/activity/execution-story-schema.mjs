import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { redactSecrets } from '../security/redaction.mjs';

export const EXECUTION_STORY_SCHEMA = 'nolane.execution-story.v1';
export const EXECUTION_STORY_EVENT_SCHEMA = 'nolane.execution-story-event.v1';
export const EXECUTION_STORY_PHASE_SCHEMA = 'nolane.execution-story-phase.v1';
export const EXECUTION_STORY_LEVELS = Object.freeze(['everyday', 'workspace', 'studio', 'expert']);

const LEVEL_RANK = Object.freeze(Object.fromEntries(EXECUTION_STORY_LEVELS.map((level, index) => [level, index])));
const SECRET = /(?:api[-_]?key|access[-_]?token|refresh[-_]?token|password|secret|credential|authorization|cookie)/i;
const RECEIPT = /^[a-f0-9]{64}$/i;

function freeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) freeze(child, seen);
  return Object.freeze(value);
}

function safeText(value, max = 600) {
  return String(value ?? '').replace(/(?:sk|key|token)-[A-Za-z0-9._-]+/gi, '[REDACTED]').slice(0, max);
}

function safeObject(value, depth = 0) {
  if (depth > 6) return '[TRUNCATED]';
  if (Array.isArray(value)) return value.slice(0, 64).map((item) => safeObject(item, depth + 1));
  if (!value || typeof value !== 'object') return typeof value === 'string' ? safeText(value, 2_000) : value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !SECRET.test(key)).slice(0, 96).map(([key, child]) => [key, safeObject(child, depth + 1)]));
}

function eventCategory(event) {
  const type = String(event?.type ?? '').toLowerCase();
  const tool = String(event?.payload?.tool ?? event?.payload?.toolName ?? '').toLowerCase();
  if (/fail|error|denied|rejected/.test(type)) return 'failure';
  if (/recover|retry|resume/.test(type)) return 'recovery';
  if (/approval|permission|capabilit/.test(type)) return 'approval';
  if (/verification|verify|test|lint|build/.test(type) || tool === 'process.run' && /(?:test|lint|build|check)/i.test(String(event?.payload?.target ?? event?.payload?.command ?? ''))) return 'test';
  if (/review/.test(type)) return 'review';
  if (/artifact|output|export/.test(type)) return 'artifact';
  if (/browser|web\.|search\.web/.test(type) || tool.startsWith('browser.')) return 'browser';
  if (/mcp|plugin|hook|skill/.test(type) || tool.startsWith('mcp.')) return /skill/.test(type) ? 'skill' : 'tool';
  if (/subagent|delegate|worker|lane/.test(type)) return 'subagent';
  if (/model|provider|routing/.test(type)) return 'model';
  if (tool === 'process.run' || /command|shell|terminal|process/.test(type)) return 'command';
  if (/fs\.|file|patch|write|read/.test(type) || /^fs\./.test(tool)) return 'file';
  if (/plan|goal|mission\.created|run\.created/.test(type)) return 'planning';
  if (/context|instruction|repository|understand|search/.test(type)) return 'understanding';
  if (/complete|finished|succeeded/.test(type)) return 'completion';
  if (/wait|paused|blocked/.test(type)) return 'waiting';
  return 'activity';
}

function eventState(event, activity) {
  const value = `${event?.type ?? ''} ${event?.payload?.status ?? ''} ${activity?.status ?? ''}`.toLowerCase();
  if (/fail|error|denied|rejected/.test(value)) return 'failed';
  if (/waiting|blocked|paused|approval|required/.test(value)) return 'waiting';
  if (/started|requested|running|active|checking|planning/.test(value)) return 'active';
  if (/completed|pass|passed|done|verified|success|succeeded/.test(value)) return 'completed';
  return 'observed';
}

function minimumLevel() { return 'everyday'; }

function target(event) {
  const payload = event?.payload ?? {};
  return payload.path ?? payload.target ?? payload.file ?? payload.relativePath ?? null;
}

function titleFor(category, state, event, activity, language, level) {
  if (activity?.title && level !== 'everyday') return safeText(activity.title, 240);
  const vi = language === 'vi';
  const active = state === 'active';
  const labels = {
    understanding: vi ? (active ? 'Đang hiểu yêu cầu' : 'Đã chuẩn bị ngữ cảnh') : (active ? 'Understanding the request' : 'Context prepared'),
    planning: vi ? (active ? 'Đang lập kế hoạch' : 'Kế hoạch đã được ghi nhận') : (active ? 'Planning the work' : 'Plan recorded'),
    file: vi ? (active ? 'Đang thao tác với tệp' : 'Đã thao tác với tệp') : (active ? 'Working with files' : 'File operation completed'),
    command: vi ? (active ? 'Đang chạy lệnh' : 'Đã chạy lệnh') : (active ? 'Running a command' : 'Command completed'),
    tool: vi ? (active ? 'Đang dùng công cụ' : 'Công cụ đã hoàn tất') : (active ? 'Using a tool' : 'Tool completed'),
    skill: vi ? 'Đã dùng kỹ năng' : 'Skill used',
    model: vi ? (active ? 'Model đang xử lý' : 'Model đã phản hồi') : (active ? 'Model is working' : 'Model responded'),
    subagent: vi ? (active ? 'Subagent đang thực hiện' : 'Subagent đã hoàn tất') : (active ? 'Subagent is working' : 'Subagent completed'),
    browser: vi ? (active ? 'Đang dùng trình duyệt' : 'Đã hoàn tất thao tác trình duyệt') : (active ? 'Using the browser' : 'Browser work completed'),
    test: vi ? (active ? 'Đang kiểm thử' : state === 'failed' ? 'Kiểm thử thất bại' : 'Kiểm thử hoàn tất') : (active ? 'Running verification' : state === 'failed' ? 'Verification failed' : 'Verification completed'),
    approval: vi ? (state === 'waiting' ? 'Đang chờ phê duyệt' : 'Quyết định quyền đã được ghi nhận') : (state === 'waiting' ? 'Waiting for approval' : 'Approval decision recorded'),
    artifact: vi ? 'Đã tạo đầu ra' : 'Output created',
    review: vi ? (active ? 'Đang đánh giá' : 'Đánh giá hoàn tất') : (active ? 'Reviewing the work' : 'Review completed'),
    recovery: vi ? 'Đang phục hồi và thử lại' : 'Recovering and retrying',
    failure: vi ? 'Một bước đã thất bại' : 'A step failed',
    completion: vi ? 'Nhiệm vụ đã hoàn thành' : 'Mission completed',
    waiting: vi ? 'Công việc đang tạm dừng' : 'Work is paused',
    activity: vi ? 'Hoạt động agent' : 'Agent activity',
  };
  return labels[category] ?? labels.activity;
}

function summaryFor(event, activity, language) {
  if (activity?.explanation) return safeText(activity.explanation, 800);
  const payload = event?.payload ?? {};
  const message = payload.summary ?? payload.message ?? payload.reason ?? payload.error ?? payload.description;
  if (message) return safeText(message, 800);
  return language === 'vi' ? 'Sự kiện được ghi lại trong execution ledger.' : 'The event was recorded in the execution ledger.';
}

function receipts(event) {
  const values = [];
  const visit = (value, key = '') => {
    if (values.length >= 32 || value == null) return;
    if (typeof value === 'string' && (RECEIPT.test(value) || /receipt/i.test(key) && value.length <= 256)) values.push(value);
    else if (Array.isArray(value)) value.slice(0, 32).forEach((item) => visit(item, key));
    else if (typeof value === 'object') Object.entries(value).slice(0, 96).forEach(([childKey, child]) => visit(child, childKey));
  };
  visit(event?.payload ?? {});
  return [...new Set(values)].slice(0, 16);
}

function references(event) {
  const payload = event?.payload ?? {};
  const toolName = String(payload.tool ?? payload.toolName ?? '').toLowerCase();
  const eventType = String(event?.type ?? '').toLowerCase();
  const value = payload.path ?? payload.relativePath ?? ((toolName.startsWith('fs.') || /file|patch|write|read/.test(eventType)) ? target(event) : null);
  const files = [value, ...(Array.isArray(payload.files) ? payload.files.map((item) => item?.path ?? item) : [])].filter(Boolean).map((item) => safeText(item, 1_000));
  return {
    files: [...new Set(files)].slice(0, 32),
    command: payload.command == null ? null : safeText(payload.command, 1_000),
    args: Array.isArray(payload.args) ? payload.args.slice(0, 64).map((item) => safeText(item, 300)) : [],
    tool: payload.tool ?? payload.toolName ?? null,
    skill: payload.skillId ?? payload.skillName ?? null,
    model: payload.modelId ?? payload.model ?? null,
    provider: payload.providerId ?? null,
    artifactIds: [payload.artifactId, ...(Array.isArray(payload.artifactIds) ? payload.artifactIds : [])].filter(Boolean).map(String).slice(0, 32),
    evidenceIds: [payload.evidenceId, ...(Array.isArray(payload.evidenceIds) ? payload.evidenceIds : [])].filter(Boolean).map(String).slice(0, 32),
    receiptSha256: receipts(event),
  };
}

export function normalizeExperienceLevel(level) {
  const value = String(level ?? 'workspace').toLowerCase();
  return EXECUTION_STORY_LEVELS.includes(value) ? value : 'workspace';
}

export function createExecutionStoryEvent(event, { activity = null, level = 'workspace', language = 'en' } = {}) {
  if (!event?.id || !event?.type) throw new TypeError('Committed event is required');
  const normalizedLevel = normalizeExperienceLevel(level);
  const category = eventCategory(event);
  const state = eventState(event, activity);
  const refs = references(event);
  const detail = LEVEL_RANK[normalizedLevel] >= LEVEL_RANK.studio ? refs : {
    files: normalizedLevel === 'workspace' ? refs.files.slice(0, 8) : [],
    command: null, args: [], tool: normalizedLevel === 'workspace' ? refs.tool : null,
    skill: refs.skill, model: refs.model, provider: refs.provider,
    artifactIds: refs.artifactIds, evidenceIds: refs.evidenceIds,
    receiptSha256: refs.receiptSha256,
  };
  const metadata = normalizedLevel === 'expert' ? safeObject(redactSecrets(event.payload ?? {})) : null;
  const base = {
    schema: EXECUTION_STORY_EVENT_SCHEMA,
    id: `story:${event.id}`,
    sourceEventId: event.id,
    sourceEventType: event.type,
    seq: Number(event.seq ?? 0) || null,
    time: String(event.time ?? new Date().toISOString()),
    durationMs: Number.isFinite(Number(event.payload?.durationMs)) ? Math.max(0, Number(event.payload.durationMs)) : null,
    category,
    state,
    minimumLevel: minimumLevel(category),
    phase: activity?.phase ?? category,
    title: titleFor(category, state, event, activity, language, normalizedLevel),
    summary: summaryFor(event, activity, language),
    correlation: {
      projectId: event.refs?.projectId ?? null,
      goalId: event.refs?.goalId ?? null,
      missionId: event.refs?.missionId ?? event.payload?.missionId ?? null,
      taskId: event.refs?.taskId ?? event.payload?.taskId ?? null,
      threadId: event.refs?.threadId ?? event.payload?.threadId ?? null,
      planId: event.refs?.planId ?? event.payload?.planId ?? null,
      laneId: event.refs?.laneId ?? event.payload?.laneId ?? null,
      runId: event.refs?.runId ?? event.payload?.runId ?? null,
    },
    references: detail,
    metadata,
  };
  return freeze({ ...base, receiptSha256: canonicalSha256(base) });
}

export function visibleAt(event, level) {
  return LEVEL_RANK[normalizeExperienceLevel(level)] >= LEVEL_RANK[event.minimumLevel ?? 'everyday'];
}

export function createExecutionStoryPhase(events, { language = 'en' } = {}) {
  if (!events.length) throw new TypeError('Phase requires at least one event');
  const category = events[0].phase ?? events[0].category;
  const failed = events.some((item) => item.state === 'failed');
  const active = events.some((item) => item.state === 'active');
  const waiting = events.some((item) => item.state === 'waiting');
  const state = failed ? 'failed' : waiting ? 'waiting' : active ? 'active' : 'completed';
  const uniqueFiles = new Set(events.flatMap((item) => item.references?.files ?? []));
  const commands = events.filter((item) => item.category === 'command').length;
  const tests = events.filter((item) => item.category === 'test').length;
  const title = events.length === 1 ? events[0].title : (language === 'vi' ? `${events[0].title} · ${events.length} sự kiện` : `${events[0].title} · ${events.length} events`);
  const base = {
    schema: EXECUTION_STORY_PHASE_SCHEMA,
    id: `phase:${events[0].sourceEventId}:${events.at(-1).sourceEventId}`,
    category,
    state,
    title,
    summary: events.at(-1).summary,
    startedAt: events[0].time,
    endedAt: state === 'active' ? null : events.at(-1).time,
    eventCount: events.length,
    metrics: { files: uniqueFiles.size, commands, tests, failures: events.filter((item) => item.state === 'failed').length },
    eventIds: events.map((item) => item.id),
  };
  return freeze({ ...base, receiptSha256: canonicalSha256(base) });
}
