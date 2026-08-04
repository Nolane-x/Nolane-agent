import { randomUUID } from 'node:crypto';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

function required(value, label, max = 4_000) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required`);
  if (text.length > max) throw new TypeError(`${label} exceeds ${max} characters`);
  return text;
}

function freeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) freeze(child, seen);
  return Object.freeze(value);
}

export class ApprovalBundleService {
  constructor({ clock = () => Date.now(), windowMs = 5 * 60_000, maxTasks = 64, eventSink = () => {} } = {}) {
    this.clock = clock;
    this.windowMs = Math.max(1_000, Number(windowMs) || 5 * 60_000);
    this.maxTasks = Math.max(1, Math.min(256, Number(maxTasks) || 64));
    this.eventSink = eventSink;
    this.active = new Map();
  }

  record(input = {}) {
    const principalId = required(input.principalId, 'principalId', 240);
    const projectId = required(input.projectId, 'projectId', 240);
    const taskId = required(input.taskId, 'taskId', 240);
    const capability = required(input.capability, 'capability', 120);
    const approvalMode = required(input.approvalMode ?? 'explicit', 'approvalMode', 40).toLowerCase();
    const risk = required(input.risk ?? 'high', 'risk', 40).toLowerCase();
    const reason = required(input.reason, 'reason');
    const resource = input.resource && typeof input.resource === 'object' && !Array.isArray(input.resource) ? structuredClone(input.resource) : {};
    const now = Number(this.clock());
    const canBundle = approvalMode !== 'always' && risk !== 'critical';
    const scope = { principalId, projectId, capability, resource };
    const fingerprint = canonicalSha256(scope);
    let state = canBundle ? this.active.get(fingerprint) : null;
    if (!state || now - state.updatedAt > this.windowMs) {
      state = {
        bundleId: `approval_${randomUUID().replaceAll('-', '')}`,
        fingerprint,
        createdAtMs: now,
        updatedAt: now,
        taskIds: [],
        count: 0,
      };
    }
    if (!state.taskIds.includes(taskId) && state.taskIds.length < this.maxTasks) state.taskIds.push(taskId);
    state.count += 1;
    state.updatedAt = now;
    if (canBundle) this.active.set(fingerprint, state);
    const base = {
      schema: 'forge.approval-bundle.v1',
      bundleId: state.bundleId,
      bundled: canBundle,
      decision: 'pending',
      createdAt: new Date(state.createdAtMs).toISOString(),
      updatedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + this.windowMs).toISOString(),
      count: state.count,
      taskIds: [...state.taskIds].sort(),
      scope: { capability, resource },
      reason,
      fingerprint,
    };
    const receipt = freeze({ ...base, receiptSha256: canonicalSha256(base) });
    this.eventSink(receipt);
    return receipt;
  }
}
