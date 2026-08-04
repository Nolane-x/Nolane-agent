import { randomUUID } from 'node:crypto';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const REQUIRED_CAPABILITIES = Object.freeze(['createBranch', 'createPullRequest', 'readCi']);
const TERMINAL_STATES = new Set(['external-gate', 'awaiting-human-merge', 'repair-exhausted']);

function text(value, label, max = 256) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${label} is required`);
  if (result.length > max) throw new TypeError(`${label} exceeds ${max} characters`);
  return result;
}
function optional(value, max = 256) {
  const result = String(value ?? '').trim();
  return result ? result.slice(0, max) : null;
}
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const item of Object.values(value)) freeze(item);
  return Object.freeze(value);
}
function receipt(base) { return freeze({ ...base, receiptSha256: canonicalSha256(base) }); }
function validReceipt(value, label = 'receiptSha256') {
  const hash = String(value ?? '');
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new TypeError(`${label} must be a SHA-256 hex digest`);
  return hash;
}
function branchName(missionId, issueId) {
  const suffix = String(issueId ?? missionId).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'mission';
  return `forge/${suffix}`;
}
function ciSucceeded(ci = {}) {
  const status = String(ci.status ?? '').toLowerCase();
  const conclusion = String(ci.conclusion ?? '').toLowerCase();
  return status === 'success' || conclusion === 'success' || conclusion === 'passed' || conclusion === 'pass';
}
function ciFailed(ci = {}) {
  const conclusion = String(ci.conclusion ?? '').toLowerCase();
  return ['failure', 'failed', 'error', 'cancelled', 'timed_out', 'action_required'].includes(conclusion);
}

export class HostedLifecycleCoordinator {
  constructor({ adapter = null, maxRepairAttempts = 2, clock = () => Date.now(), eventSink = () => {} } = {}) {
    this.adapter = adapter;
    this.maxRepairAttempts = Math.max(0, Math.min(20, Math.floor(Number(maxRepairAttempts) || 0)));
    this.clock = clock;
    this.eventSink = typeof eventSink === 'function' ? eventSink : () => {};
    this.runs = new Map();
  }

  #adapterReady() {
    return Boolean(this.adapter && REQUIRED_CAPABILITIES.every((name) => this.adapter.capabilities?.[name] === true && typeof this.adapter[name] === 'function'));
  }

  #event(run, type, detail = {}) {
    const event = receipt({ schema: 'forge.hosted-lifecycle-event.v1', type, lifecycleId: run.id, projectId: run.projectId, missionId: run.missionId, atMs: this.clock(), ...detail });
    run.events.push(event);
    try { void this.eventSink(event); } catch {}
    return event;
  }

  #view(run) {
    const base = {
      schema: 'forge.hosted-lifecycle.v1', id: run.id, projectId: run.projectId, missionId: run.missionId,
      provider: run.provider, issueId: run.issueId, sourceCommit: run.sourceCommit, targetBranch: run.targetBranch,
      branchName: run.branchName, state: run.state, externalGate: run.state === 'external-gate', reason: run.reason,
      humanMergeRequired: run.state === 'awaiting-human-merge', repairAttempts: run.repairAttempts,
      maxRepairAttempts: run.maxRepairAttempts, localVerification: run.localVerification,
      branch: run.branch, pullRequest: run.pullRequest, ci: run.ci,
      startedAtMs: run.startedAtMs, updatedAtMs: run.updatedAtMs, events: [...run.events],
      adapterCapabilities: freeze({ ...run.adapterCapabilities, merge: false }),
    };
    return receipt(base);
  }

  #get(id) {
    const run = this.runs.get(String(id ?? ''));
    if (!run) throw Object.assign(new Error(`Unknown hosted lifecycle: ${id}`), { code: 'HOSTED_LIFECYCLE_UNKNOWN' });
    return run;
  }

  start(input = {}) {
    const projectId = text(input.projectId, 'projectId');
    const missionId = text(input.missionId, 'missionId');
    const run = {
      id: randomUUID(), projectId, missionId, provider: text(input.provider, 'provider', 64).toLowerCase(),
      issueId: optional(input.issueId), sourceCommit: optional(input.sourceCommit, 160), targetBranch: optional(input.targetBranch, 160) ?? 'main',
      branchName: optional(input.branchName, 160) ?? branchName(missionId, input.issueId),
      state: this.#adapterReady() ? 'awaiting-local-verification' : 'external-gate',
      reason: this.#adapterReady() ? null : 'HOSTED_ADAPTER_NOT_OPERATED', repairAttempts: 0, maxRepairAttempts: this.maxRepairAttempts,
      localVerification: null, branch: null, pullRequest: null, ci: null,
      adapterCapabilities: this.adapter?.capabilities ?? {}, events: [], startedAtMs: this.clock(), updatedAtMs: this.clock(),
    };
    this.runs.set(run.id, run);
    this.#event(run, 'hosted-lifecycle.started', { state: run.state, reason: run.reason });
    return this.#view(run);
  }

  recordLocalVerification(id, verification = {}) {
    const run = this.#get(id);
    if (run.state !== 'awaiting-local-verification') throw new Error(`Local verification is not accepted from state ${run.state}`);
    if (String(verification.status ?? '').toLowerCase() !== 'pass') throw new Error('Local verification must pass before hosted publication');
    const normalized = freeze({ status: 'pass', commit: optional(verification.commit, 160), receiptSha256: validReceipt(verification.receiptSha256) });
    run.localVerification = normalized;
    run.state = run.pullRequest ? 'pull-request-open' : 'ready-to-publish';
    run.updatedAtMs = this.clock();
    this.#event(run, 'hosted-lifecycle.local-verification-recorded', { verificationReceiptSha256: normalized.receiptSha256, state: run.state });
    return this.#view(run);
  }

  async advance(id) {
    const run = this.#get(id);
    if (run.state === 'awaiting-local-verification') throw new Error('Hosted lifecycle requires passing local verification before advancing');
    if (run.state === 'external-gate') throw new Error('Hosted lifecycle is an external gate because no adapter is operated');
    if (run.state === 'awaiting-human-merge') throw new Error('Hosted lifecycle is complete only after a human merge decision');
    if (run.state === 'repair-exhausted') throw new Error('Hosted lifecycle repair limit is exhausted');
    if (run.state === 'repair-required') throw new Error('Hosted lifecycle requires a bounded repair request before advancing');

    if (run.state === 'ready-to-publish') {
      run.branch = freeze(await this.adapter.createBranch({ projectId: run.projectId, missionId: run.missionId, provider: run.provider, issueId: run.issueId, sourceCommit: run.sourceCommit, targetBranch: run.targetBranch, branchName: run.branchName }));
      run.state = 'branch-created';
      this.#event(run, 'hosted-lifecycle.branch-created', { branchName: run.branchName, adapterReceiptSha256: optional(run.branch?.receiptSha256, 64) });
    } else if (run.state === 'branch-created') {
      run.pullRequest = freeze(await this.adapter.createPullRequest({ projectId: run.projectId, missionId: run.missionId, provider: run.provider, issueId: run.issueId, sourceCommit: run.sourceCommit, sourceBranch: run.branchName, targetBranch: run.targetBranch, localVerificationReceiptSha256: run.localVerification?.receiptSha256 }));
      run.state = 'pull-request-open';
      this.#event(run, 'hosted-lifecycle.pull-request-opened', { pullRequestId: run.pullRequest?.id ?? null, adapterReceiptSha256: optional(run.pullRequest?.receiptSha256, 64) });
    } else if (run.state === 'pull-request-open') {
      run.ci = freeze(await this.adapter.readCi({ projectId: run.projectId, missionId: run.missionId, provider: run.provider, pullRequestId: run.pullRequest?.id ?? null, pullRequestUrl: run.pullRequest?.url ?? null }));
      if (ciSucceeded(run.ci)) {
        run.state = 'awaiting-human-merge';
        this.#event(run, 'hosted-lifecycle.ci-passed', { ciId: run.ci?.id ?? null, humanMergeRequired: true });
      } else if (ciFailed(run.ci)) {
        run.state = run.repairAttempts >= run.maxRepairAttempts ? 'repair-exhausted' : 'repair-required';
        this.#event(run, 'hosted-lifecycle.ci-failed', { ciId: run.ci?.id ?? null, state: run.state, repairAttempts: run.repairAttempts });
      } else {
        this.#event(run, 'hosted-lifecycle.ci-pending', { ciId: run.ci?.id ?? null });
      }
    } else {
      throw new Error(`Illegal hosted lifecycle transition from ${run.state}`);
    }
    run.updatedAtMs = this.clock();
    return this.#view(run);
  }

  async requestRepair(id, input = {}) {
    const run = this.#get(id);
    if (run.state === 'repair-exhausted' || run.repairAttempts >= run.maxRepairAttempts) throw new Error('Hosted lifecycle repair limit is exhausted');
    if (run.state !== 'repair-required') throw new Error(`Repair is not allowed from state ${run.state}`);
    const strategyId = text(input.strategyId, 'strategyId');
    const repairReceiptSha256 = validReceipt(input.receiptSha256, 'repair receiptSha256');
    run.repairAttempts += 1;
    run.localVerification = null;
    run.state = 'awaiting-local-verification';
    if (this.adapter?.capabilities?.comment === true && typeof this.adapter.comment === 'function') {
      await this.adapter.comment({ provider: run.provider, pullRequestId: run.pullRequest?.id ?? null, message: `Forge Studio repair attempt ${run.repairAttempts}/${run.maxRepairAttempts}: ${strategyId}`, repairReceiptSha256 });
    }
    run.updatedAtMs = this.clock();
    this.#event(run, 'hosted-lifecycle.repair-requested', { strategyId, repairReceiptSha256, repairAttempts: run.repairAttempts, requiresFreshLocalVerification: true });
    return this.#view(run);
  }

  snapshot(id = null) {
    if (id != null) return this.#view(this.#get(id));
    const lifecycles = [...this.runs.values()].map((run) => this.#view(run));
    const base = { schema: 'forge.hosted-lifecycle-snapshot.v1', lifecycles, total: lifecycles.length, terminal: lifecycles.filter((run) => TERMINAL_STATES.has(run.state)).length };
    return receipt(base);
  }
}
