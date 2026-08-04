import { randomUUID } from 'node:crypto';
import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const FEATURES = Object.freeze(['instructions', 'hooks', 'skills', 'mcp', 'plugins', 'bootstrap', 'background']);

function required(value, label, max = 2_000) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required`);
  if (text.length > max) throw new TypeError(`${label} exceeds ${max} characters`);
  return text;
}

function principalSubject(principal) {
  const subject = String(principal?.subject ?? '').trim();
  if (!subject) throw Object.assign(new Error('An authenticated principal is required for workspace trust decisions'), { statusCode: 401, code: 'WORKSPACE_TRUST_PRINCIPAL_REQUIRED' });
  return subject;
}

function publicFeatures(allowed, reason) {
  return Object.freeze(Object.fromEntries(FEATURES.map((feature) => [feature, Object.freeze({ allowed, reason: allowed ? null : reason })])));
}

async function identity(workspaceRoot) {
  const canonicalRoot = await realpath(path.resolve(String(workspaceRoot)));
  const rootStat = await lstat(canonicalRoot);
  let gitIdentity = null;
  try {
    const gitPath = await realpath(path.join(canonicalRoot, '.git'));
    const gitStat = await lstat(gitPath);
    gitIdentity = { path: gitPath, dev: String(gitStat.dev), ino: String(gitStat.ino), mode: gitStat.mode };
  } catch (error) {
    if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') throw error;
  }
  const evidence = Object.freeze({
    canonicalRoot,
    root: { dev: String(rootStat.dev), ino: String(rootStat.ino), mode: rootStat.mode },
    git: gitIdentity,
  });
  return Object.freeze({ workspaceRoot: canonicalRoot, fingerprint: canonicalSha256(evidence), evidence });
}

function receipt(base) { return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) }); }

export class WorkspaceTrustService {
  constructor({ storage, projectResolver, clock = () => new Date(), eventSink = () => {} } = {}) {
    if (!storage?.get || !storage?.save || !storage?.appendAudit) throw new TypeError('WorkspaceTrustService storage is required');
    if (typeof projectResolver !== 'function') throw new TypeError('WorkspaceTrustService projectResolver is required');
    this.storage = storage;
    this.projectResolver = projectResolver;
    this.clock = clock;
    this.eventSink = eventSink;
  }

  #project(projectId) {
    const id = required(projectId, 'projectId', 256);
    const project = this.projectResolver(id);
    if (!project) throw Object.assign(new Error(`Unknown project: ${id}`), { statusCode: 404, code: 'PROJECT_NOT_FOUND' });
    return project;
  }

  async #current(projectId) {
    const project = this.#project(projectId);
    const current = await identity(project.workspaceRoot);
    return { project, current, record: this.storage.get(project.id) };
  }

  async status(projectId) {
    const { project, current, record } = await this.#current(projectId);
    let state = 'untrusted'; let reason = 'no-trust-decision';
    if (record?.state === 'trusted') {
      if (record.fingerprint === current.fingerprint) { state = 'trusted'; reason = null; }
      else reason = 'workspace-identity-changed';
    } else if (record?.state === 'revoked') reason = 'trust-revoked';
    return Object.freeze({
      schema: 'forge.workspace-trust.status.v1',
      projectId: project.id,
      workspaceRoot: current.workspaceRoot,
      fingerprint: current.fingerprint,
      identityEvidence: current.evidence,
      state,
      reason,
      actor: record?.actor ?? null,
      decisionReason: record?.reason ?? null,
      trustedAt: record?.trustedAt ?? null,
      revokedAt: record?.revokedAt ?? null,
      updatedAt: record?.updatedAt ?? null,
      receiptSha256: record?.receiptSha256 ?? null,
      features: publicFeatures(state === 'trusted', reason),
    });
  }

  async #decide({ projectId, principal, reason, state }) {
    const actor = principalSubject(principal);
    const explanation = required(reason, 'reason', 1_000);
    const { project, current } = await this.#current(projectId);
    const at = this.clock().toISOString();
    const base = {
      schema: 'forge.workspace-trust.decision.v1',
      projectId: project.id,
      workspaceRoot: current.workspaceRoot,
      fingerprint: current.fingerprint,
      state,
      actor,
      reason: explanation,
      trustedAt: state === 'trusted' ? at : null,
      revokedAt: state === 'revoked' ? at : null,
      updatedAt: at,
    };
    const record = receipt(base);
    this.storage.save(record);
    const eventBase = {
      schema: 'forge.workspace-trust.audit.v1',
      id: randomUUID(),
      type: state === 'trusted' ? 'workspace.trusted' : 'workspace.trust-revoked',
      projectId: project.id,
      actor,
      reason: explanation,
      fingerprint: current.fingerprint,
      decisionReceiptSha256: record.receiptSha256,
      at,
    };
    const event = receipt(eventBase);
    this.storage.appendAudit(event);
    this.eventSink(event);
    return this.status(project.id);
  }

  trust(input = {}) { return this.#decide({ ...input, state: 'trusted' }); }
  revoke(input = {}) { return this.#decide({ ...input, state: 'revoked' }); }

  audit({ projectId, limit = 500 } = {}) {
    this.#project(projectId);
    return Object.freeze(this.storage.listAudit(projectId, { limit }).map((item) => Object.freeze(item)));
  }

  async requireTrusted(projectId, feature = 'workspace') {
    const status = await this.status(projectId);
    if (status.state === 'trusted') return status;
    const error = new Error(`Workspace trust is required before using ${String(feature)}`);
    error.statusCode = 409;
    error.code = 'WORKSPACE_TRUST_REQUIRED';
    error.projectId = status.projectId;
    error.feature = String(feature);
    error.trustStatus = status;
    throw error;
  }
}
