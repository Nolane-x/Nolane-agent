import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { createEvent } from '../protocol/events.mjs';

const MAX_DIFF_BYTES = 4 * 1024 * 1024;
const MAX_FILES = 500;
const MAX_HUNKS = 2_000;
const DECISIONS = new Set(['accept', 'reject', 'pending']);

function required(value, label, max = 2_000) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required`);
  if (text.length > max) throw new TypeError(`${label} exceeds ${max} characters`);
  return text;
}

function actor(principal) {
  const subject = String(principal?.subject ?? '').trim();
  if (!subject) throw Object.assign(new Error('An authenticated principal is required for diff review decisions'), { statusCode: 401, code: 'DIFF_REVIEW_PRINCIPAL_REQUIRED' });
  return subject;
}

function cleanPath(value) {
  const text = String(value ?? '').trim();
  if (!text || text === '/dev/null') return null;
  return text.replace(/^[ab]\//, '').replaceAll('\\', '/');
}

function hunkHeader(hunk, reverse = false) {
  const oldStart = reverse ? hunk.newStart : hunk.oldStart;
  const oldCount = reverse ? hunk.newCount : hunk.oldCount;
  const newStart = reverse ? hunk.oldStart : hunk.newStart;
  const newCount = reverse ? hunk.oldCount : hunk.newCount;
  return `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`;
}

function reverseLine(line) {
  if (line.startsWith('+')) return `-${line.slice(1)}`;
  if (line.startsWith('-')) return `+${line.slice(1)}`;
  return line;
}

function reversePatch(file, hunk) {
  if (!file.oldPath || !file.newPath || file.oldPath !== file.newPath) {
    throw Object.assign(new Error('Partial reject currently supports modified files with identical old and new paths'), { code: 'DIFF_REVIEW_FILE_KIND_UNSUPPORTED', statusCode: 409 });
  }
  return `--- a/${file.oldPath}\n+++ b/${file.newPath}\n${hunkHeader(hunk, true)}\n${hunk.lines.map(reverseLine).join('\n')}\n`;
}

function freezeHunk(path, header, values, lines) {
  const base = Object.freeze({ path, header, ...values, lines: Object.freeze(lines) });
  return Object.freeze({ ...base, id: canonicalSha256(base) });
}

export function parseGitDiff(value) {
  const text = String(value ?? '').replaceAll('\r\n', '\n');
  if (Buffer.byteLength(text) > MAX_DIFF_BYTES) throw Object.assign(new Error(`Diff exceeds ${MAX_DIFF_BYTES} bytes`), { code: 'DIFF_REVIEW_TOO_LARGE' });
  if (!text.trim()) return Object.freeze([]);
  const lines = text.split('\n');
  const files = [];
  let current = null;
  let index = 0;
  let hunkCount = 0;
  while (index < lines.length) {
    const diffHeader = lines[index].match(/^diff --git a\/(.+) b\/(.+)$/);
    if (diffHeader) {
      if (files.length >= MAX_FILES) throw Object.assign(new Error(`Diff exceeds ${MAX_FILES} files`), { code: 'DIFF_REVIEW_TOO_LARGE' });
      current = { oldPath: cleanPath(diffHeader[1]), newPath: cleanPath(diffHeader[2]), hunks: [] };
      files.push(current);
      index += 1;
      continue;
    }
    if (!current) { index += 1; continue; }
    if (lines[index].startsWith('--- ')) current.oldPath = cleanPath(lines[index].slice(4));
    if (lines[index].startsWith('+++ ')) current.newPath = cleanPath(lines[index].slice(4));
    const match = lines[index].match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/);
    if (!match) { index += 1; continue; }
    hunkCount += 1;
    if (hunkCount > MAX_HUNKS) throw Object.assign(new Error(`Diff exceeds ${MAX_HUNKS} hunks`), { code: 'DIFF_REVIEW_TOO_LARGE' });
    const header = lines[index];
    const hunkLines = [];
    index += 1;
    while (index < lines.length && !lines[index].startsWith('diff --git ') && !lines[index].startsWith('@@ ')) {
      const line = lines[index];
      if (line === '\\ No newline at end of file') { index += 1; continue; }
      if (line === '' && index === lines.length - 1) { index += 1; break; }
      if (![' ', '+', '-'].includes(line[0])) break;
      hunkLines.push(line);
      index += 1;
    }
    const path = current.newPath ?? current.oldPath;
    current.hunks.push(freezeHunk(path, header, {
      oldStart: Number(match[1]), oldCount: Number(match[2] ?? 1),
      newStart: Number(match[3]), newCount: Number(match[4] ?? 1),
      context: String(match[5] ?? '').trim() || null,
    }, hunkLines));
  }
  return Object.freeze(files.map((file) => Object.freeze({
    oldPath: file.oldPath,
    newPath: file.newPath,
    path: file.newPath ?? file.oldPath,
    kind: !file.oldPath ? 'added' : !file.newPath ? 'deleted' : file.oldPath !== file.newPath ? 'renamed' : 'modified',
    hunks: Object.freeze(file.hunks),
  })));
}

function receipt(base) { return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) }); }

export class DiffReviewService {
  constructor({ store, gitInspector, mutator, clock = () => new Date() } = {}) {
    if (!store?.getMission || !store?.listTasks || !store?.updateMission || !store?.appendEvent) throw new TypeError('DiffReviewService store is required');
    if (!gitInspector?.snapshot) throw new TypeError('DiffReviewService gitInspector is required');
    if (typeof mutator !== 'function') throw new TypeError('DiffReviewService mutator is required');
    this.store = store;
    this.gitInspector = gitInspector;
    this.mutator = mutator;
    this.clock = clock;
  }

  #mission(missionId) {
    const id = required(missionId, 'missionId', 256);
    const mission = this.store.getMission(id);
    if (!mission) throw Object.assign(new Error(`Unknown mission: ${id}`), { statusCode: 404, code: 'MISSION_NOT_FOUND' });
    return mission;
  }

  #decisions(mission) { return mission.metadata?.diffReviewDecisions && typeof mission.metadata.diffReviewDecisions === 'object' ? mission.metadata.diffReviewDecisions : {}; }

  async snapshot(missionId) {
    const mission = this.#mission(missionId);
    const tasks = this.store.listTasks({ missionId: mission.id }).filter((task) => ['builder', 'integrator'].includes(task.role) && task.metadata?.worktree?.path);
    const decisions = this.#decisions(mission);
    const files = [];
    const sourceSnapshots = [];
    for (const task of tasks) {
      const source = await this.gitInspector.snapshot({ projectId: mission.projectId, taskId: task.id });
      if (source.truncated === true) throw Object.assign(new Error(`Diff snapshot is truncated for task ${task.id}`), { statusCode: 409, code: 'DIFF_REVIEW_TRUNCATED' });
      sourceSnapshots.push({ taskId: task.id, snapshotSha256: source.snapshotSha256 });
      for (const parsed of parseGitDiff(source.diff)) {
        files.push(Object.freeze({
          taskId: task.id,
          oldPath: parsed.oldPath,
          newPath: parsed.newPath,
          path: parsed.path,
          kind: parsed.kind,
          sourceSnapshotSha256: source.snapshotSha256,
          hunks: Object.freeze(parsed.hunks.map((hunk) => {
            const id = canonicalSha256({ taskId: task.id, sourceHunkId: hunk.id });
            const decision = decisions[`${task.id}:${id}`] ?? null;
            return Object.freeze({ ...hunk, id, decision: decision?.decision ?? 'pending', decisionActor: decision?.actor ?? null, decisionReason: decision?.reason ?? null, decisionReceiptSha256: decision?.receiptSha256 ?? null, mutationReceiptSha256: decision?.mutationReceiptSha256 ?? null, decidedAt: decision?.decidedAt ?? null });
          })),
        }));
      }
    }
    const base = Object.freeze({ schema: 'forge.diff-review.snapshot.v1', missionId: mission.id, projectId: mission.projectId, sourceSnapshots: Object.freeze(sourceSnapshots), files: Object.freeze(files) });
    return Object.freeze({ ...base, reviewSha256: canonicalSha256(base) });
  }

  async decide({ missionId, taskId, hunkId, decision, expectedReviewSha256, principal, reason } = {}) {
    const normalizedDecision = required(decision, 'decision', 16);
    if (!DECISIONS.has(normalizedDecision) || normalizedDecision === 'pending') throw new TypeError('decision must be accept or reject');
    const who = actor(principal);
    const explanation = required(reason, 'reason', 1_000);
    const expected = required(expectedReviewSha256, 'expectedReviewSha256', 64);
    const snapshot = await this.snapshot(missionId);
    if (snapshot.reviewSha256 !== expected) throw Object.assign(new Error('Diff review snapshot changed; refresh before deciding'), { statusCode: 409, code: 'DIFF_REVIEW_STALE', expected, actual: snapshot.reviewSha256 });
    const file = snapshot.files.find((entry) => entry.taskId === String(taskId) && entry.hunks.some((hunk) => hunk.id === String(hunkId)));
    const hunk = file?.hunks.find((entry) => entry.id === String(hunkId));
    if (!file || !hunk) throw Object.assign(new Error('Unknown diff hunk'), { statusCode: 404, code: 'DIFF_REVIEW_HUNK_NOT_FOUND' });
    const task = this.store.listTasks({ missionId: snapshot.missionId }).find((entry) => entry.id === file.taskId);
    if (!task) throw Object.assign(new Error(`Unknown task: ${file.taskId}`), { statusCode: 404, code: 'TASK_NOT_FOUND' });
    let mutationReceiptSha256 = null;
    if (normalizedDecision === 'reject') {
      const mutation = await this.mutator({ task, file, hunk, patch: reversePatch(file, hunk), expectedSnapshotSha256: file.sourceSnapshotSha256 });
      mutationReceiptSha256 = mutation?.receiptSha256 ?? mutation?.receipt?.receiptSha256 ?? null;
      if (!/^[a-f0-9]{64}$/i.test(String(mutationReceiptSha256 ?? ''))) throw Object.assign(new Error('Diff rejection mutation did not return a valid receipt'), { code: 'DIFF_REVIEW_MUTATION_RECEIPT_REQUIRED' });
    }
    const mission = this.#mission(snapshot.missionId);
    const decidedAt = this.clock().toISOString();
    const recordBase = { schema: 'forge.diff-review.decision.v1', missionId: mission.id, projectId: mission.projectId, taskId: task.id, hunkId: hunk.id, path: file.path, decision: normalizedDecision, actor: who, reason: explanation, decidedAt, sourceSnapshotSha256: file.sourceSnapshotSha256, expectedReviewSha256: expected, mutationReceiptSha256 };
    const record = receipt(recordBase);
    const decisions = { ...this.#decisions(mission), [`${task.id}:${hunk.id}`]: record };
    this.store.updateMission(mission.id, { metadata: { ...(mission.metadata ?? {}), diffReviewDecisions: decisions, diffReviewUpdatedAt: decidedAt } });
    this.store.appendEvent(createEvent('diff-review.decision-recorded', { taskId: task.id, hunkId: hunk.id, path: file.path, decision: normalizedDecision, actor: who, decisionReceiptSha256: record.receiptSha256, mutationReceiptSha256 }, { projectId: mission.projectId, missionId: mission.id, taskId: task.id }));
    return record;
  }
}
