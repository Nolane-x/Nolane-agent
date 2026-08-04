import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { redactSecrets } from '../security/redaction.mjs';

const HASH = /^[a-f0-9]{64}$/i;
const COMPLETION_EVENTS = /^(?:task\.(?:completed|failed)|review\.(?:accepted|completed)|artifact\.(?:created|published)|checkpoint\.(?:created|saved)|verification\.(?:passed|completed))$/i;

function required(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required`);
  return text;
}
function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function money(value) { return Math.round(finite(value) * 1e8) / 1e8; }
function clip(value, max = 500) { return value == null ? null : String(value).slice(0, max); }
function unique(values) { return [...new Set(values.filter(Boolean).map((value) => String(value)))]; }
function safeHash(value) { const text = String(value ?? ''); return HASH.test(text) ? text.toLowerCase() : null; }
function freeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) freeze(child, seen);
  return Object.freeze(value);
}
function statusCounts(items = []) {
  const counts = { total: items.length, pending: 0, approved: 0, denied: 0, resolved: 0 };
  for (const item of items) {
    const status = String(item?.status ?? '').toLowerCase();
    if (status in counts) counts[status] += 1;
  }
  return counts;
}
function usageFrom(tasks = [], runs = []) {
  const result = { promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0 };
  for (const record of [...tasks, ...runs]) {
    const usage = record?.metadata?.candidateUsage ?? record?.metadata?.usage ?? record?.usage ?? {};
    result.promptTokens += finite(usage.promptTokens);
    result.completionTokens += finite(usage.completionTokens);
    result.totalTokens += finite(usage.totalTokens, finite(usage.promptTokens) + finite(usage.completionTokens));
    result.costUsd += finite(usage.costUsd);
  }
  result.costUsd = money(result.costUsd);
  return result;
}
function verificationSummary(records = []) {
  let run = 0; let passed = 0; let failed = 0;
  const commands = [];
  for (const item of records) {
    const kind = String(item?.kind ?? '');
    if (!/verification|test/i.test(kind)) continue;
    const payload = item?.payload ?? {};
    const total = Math.max(0, finite(payload.total, 1));
    const failedCount = Math.max(0, finite(payload.failed, item?.status === 'pass' ? 0 : total));
    const passedCount = Math.max(0, finite(payload.passed, item?.status === 'pass' ? total : Math.max(0, total - failedCount)));
    run += total; passed += passedCount; failed += failedCount;
    if (payload.command) commands.push(String(payload.command));
  }
  return freeze({ run, passed, failed, status: failed > 0 ? 'fail' : run > 0 ? 'pass' : 'pending', commands: unique(commands) });
}
function milestoneFingerprints(events = [], evidence = []) {
  const fingerprints = new Set();
  for (const event of events) {
    if (!COMPLETION_EVENTS.test(String(event?.type ?? ''))) continue;
    const hash = safeHash(event?.payload?.receiptSha256 ?? event?.receiptSha256);
    fingerprints.add(hash ? `event:${hash}` : `event:${canonicalSha256({ type: event.type, taskId: event?.refs?.taskId ?? null, payload: event?.payload ?? {} })}`);
  }
  for (const item of evidence) {
    if (String(item?.status ?? '').toLowerCase() !== 'pass') continue;
    if (!/verification|test/i.test(String(item?.kind ?? ''))) continue;
    const hash = safeHash(item?.receiptSha256);
    fingerprints.add(hash ? `evidence:${hash}` : `evidence:${canonicalSha256({ id: item?.id, taskId: item?.taskId, kind: item?.kind, payload: item?.payload ?? {} })}`);
  }
  return fingerprints;
}
function publicEnvironment(item = {}) {
  return freeze({
    id: clip(item.id, 200),
    status: clip(item.status, 80),
    pid: Number.isInteger(Number(item.pid)) ? Number(item.pid) : null,
    health: item.health == null ? null : clip(item.health?.status ?? item.health, 80),
    updatedAt: clip(item.updatedAt ?? item.checkedAt, 80),
  });
}
function publicGrant(item = {}) {
  return freeze({
    id: clip(item.id, 200), capabilityId: clip(item.capabilityId, 200), effect: clip(item.effect, 40), mode: clip(item.mode, 80),
    active: !item.revokedAt, receiptSha256: safeHash(item.receiptSha256),
  });
}

export class MissionStateProgressService {
  constructor({ store, environmentControl = null, capabilityLedger = null, clock = () => Date.now(), stallActivityThreshold = 5 } = {}) {
    if (!store?.getProject || !store?.getMission || !store?.listTasks || !store?.listEvidence || !store?.listEvents) throw new TypeError('MissionStateProgressService store is required');
    this.store = store;
    this.environmentControl = environmentControl;
    this.capabilityLedger = capabilityLedger;
    this.clock = clock;
    this.stallActivityThreshold = Math.max(1, Number(stallActivityThreshold) || 5);
  }

  #scope({ projectId, missionId, principalId } = {}) {
    const projectKey = required(projectId, 'projectId');
    const missionKey = required(missionId, 'missionId');
    const principal = required(principalId, 'An authenticated principal');
    const project = this.store.getProject(projectKey);
    if (!project) throw Object.assign(new Error('Unknown project'), { statusCode: 404, code: 'MISSION_PROGRESS_PROJECT_NOT_FOUND' });
    const mission = this.store.getMission(missionKey);
    if (!mission) throw Object.assign(new Error('Unknown mission'), { statusCode: 404, code: 'MISSION_PROGRESS_MISSION_NOT_FOUND' });
    if (String(mission.projectId) !== projectKey) throw Object.assign(new Error('Mission project scope denied'), { statusCode: 403, code: 'MISSION_PROGRESS_SCOPE_DENIED' });
    return { projectId: projectKey, missionId: missionKey, principalId: principal, project, mission };
  }

  #records(scope) {
    const tasks = this.store.listTasks({ projectId: scope.projectId, missionId: scope.missionId }) ?? [];
    const runs = this.store.listRuns?.({ projectId: scope.projectId, missionId: scope.missionId }) ?? [];
    const evidence = tasks.flatMap((task) => this.store.listEvidence({ projectId: scope.projectId, missionId: scope.missionId, taskId: task.id }) ?? []);
    const interrupts = this.store.listInterrupts?.({ projectId: scope.projectId, missionId: scope.missionId }) ?? [];
    const events = (this.store.listEvents({ projectId: scope.projectId, missionId: scope.missionId, limit: 50_000 }) ?? []).filter((event) => {
      const refs = event?.refs ?? {};
      return (!refs.projectId || String(refs.projectId) === scope.projectId) && (!refs.missionId || String(refs.missionId) === scope.missionId);
    });
    return { tasks, runs, evidence, interrupts, events };
  }

  snapshot(input = {}) {
    const scope = this.#scope(input);
    const { tasks, runs, evidence, interrupts, events } = this.#records(scope);
    const usage = usageFrom(tasks, runs);
    const limitUsd = Number.isFinite(Number(scope.mission?.metadata?.costLimitUsd)) ? money(scope.mission.metadata.costLimitUsd) : null;
    const completionCriteria = unique(tasks.flatMap((task) => task?.metadata?.taskContract?.successCriteria ?? []).concat(scope.mission?.metadata?.completionCriteria ?? []));
    const hypotheses = unique([...(scope.mission?.metadata?.hypotheses ?? []), ...events.map((event) => event?.payload?.hypothesis)]).slice(0, 100);
    const milestones = milestoneFingerprints(events, evidence);
    const activity = events.length;
    const missionStatus = String(scope.mission.status ?? '').toLowerCase();
    const progressStatus = /done|complete|success/.test(missionStatus) ? 'completed' : activity >= this.stallActivityThreshold && milestones.size <= 1 ? 'stalled' : milestones.size > 0 ? 'progressing' : 'idle';
    const environments = this.environmentControl?.list?.({ projectId: scope.projectId, missionId: scope.missionId }) ?? [];
    const grants = this.capabilityLedger?.listGrants?.({ projectId: scope.projectId, missionId: scope.missionId, principalId: scope.principalId }) ?? [];
    const byRole = new Map();
    for (const task of tasks) {
      const role = String(task?.role ?? '').trim(); if (!role) continue;
      if (!byRole.has(role)) byRole.set(role, { role, total: 0, pending: 0, running: 0, done: 0, failed: 0 });
      const row = byRole.get(role); row.total += 1;
      const status = String(task?.status ?? 'pending').toLowerCase();
      if (/done|complete|success/.test(status)) row.done += 1;
      else if (/fail|error|blocked/.test(status)) row.failed += 1;
      else if (/run|active|work/.test(status)) row.running += 1;
      else row.pending += 1;
    }
    const repositorySeed = { projectId: scope.projectId, name: scope.project?.name ?? null, repositoryRemote: scope.project?.metadata?.repositoryRemote ?? null };
    const base = redactSecrets({
      schema: 'forge.mission-state-progress.v1',
      generatedAt: new Date(this.clock()).toISOString(),
      projectId: scope.projectId,
      missionId: scope.missionId,
      userId: scope.principalId,
      repositoryId: `repo_${canonicalSha256(repositorySeed).slice(0, 24)}`,
      mission: freeze({ status: clip(scope.mission.status, 80), objective: clip(scope.mission.objective, 1_000) }),
      completionCriteria,
      hypotheses,
      tests: verificationSummary(evidence),
      usage: freeze(usage),
      cost: freeze({ limitUsd, usedUsd: usage.costUsd, remainingUsd: limitUsd == null ? null : money(Math.max(0, limitUsd - usage.costUsd)), exceeded: limitUsd != null && usage.costUsd > limitUsd }),
      sandbox: freeze(environments.map(publicEnvironment)),
      approvals: freeze({ ...statusCounts(interrupts), grants: grants.map(publicGrant) }),
      subagents: freeze([...byRole.values()].sort((a, b) => a.role.localeCompare(b.role)).map((item) => freeze(item))),
      progress: freeze({ status: progressStatus, milestones: milestones.size, activityEvents: activity, stalled: progressStatus === 'stalled' }),
    });
    return freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  assertWithinCostLimit(input = {}) {
    const scope = this.#scope(input);
    const projectedCostUsd = money(input.projectedCostUsd);
    if (!(projectedCostUsd >= 0)) throw new TypeError('projectedCostUsd must be a non-negative number');
    const { tasks, runs } = this.#records(scope);
    const usedUsd = usageFrom(tasks, runs).costUsd;
    const limitUsd = Number.isFinite(Number(scope.mission?.metadata?.costLimitUsd)) ? money(scope.mission.metadata.costLimitUsd) : null;
    const projectedTotalUsd = money(usedUsd + projectedCostUsd);
    const base = { schema: 'forge.mission-cost-check.v1', projectId: scope.projectId, missionId: scope.missionId, userId: scope.principalId, usedUsd, projectedCostUsd, projectedTotalUsd, limitUsd, allowed: limitUsd == null || projectedTotalUsd <= limitUsd };
    const result = freeze({ ...base, receiptSha256: canonicalSha256(base) });
    if (!result.allowed) throw Object.assign(new Error(`Mission cost limit exceeded: projected ${projectedTotalUsd} USD exceeds ${limitUsd} USD`), { statusCode: 409, code: 'MISSION_COST_LIMIT_EXCEEDED', receiptSha256: result.receiptSha256, details: result });
    return result;
  }
}
