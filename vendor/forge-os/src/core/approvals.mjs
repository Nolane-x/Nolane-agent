import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { assertPrincipal, principalRecord } from './principals.mjs';

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const tokenDigest = (token) => createHash('sha256').update(String(token ?? ''), 'utf8').digest('hex');

function cleanAction(value) {
  const action = String(value ?? '').trim();
  if (!action || action.length > 300 || !/^[a-z0-9:_-]+$/i.test(action)) throw new TypeError('Approval action is invalid');
  return action;
}

export function issueApproval(project, action, principal, { now = new Date(), ttlMs = DEFAULT_TTL_MS } = {}) {
  assertPrincipal(principal, { type: 'human', scope: 'approve' });
  if (!Number.isInteger(ttlMs) || ttlMs < 1_000 || ttlMs > 24 * 60 * 60 * 1000) throw new TypeError('Approval TTL is invalid');
  const token = randomBytes(32).toString('base64url');
  const record = {
    id: `approval_${randomUUID().replaceAll('-', '')}`,
    action: cleanAction(action),
    principal: principalRecord(principal),
    semanticRevision: project.semanticRevision,
    tokenSha256: tokenDigest(token),
    status: 'pending',
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    usedAt: null,
  };
  return { record, token };
}

export function consumeApproval(project, { action, token, principal, now = new Date() }) {
  assertPrincipal(principal, { type: 'human', scope: 'approve' });
  const expectedAction = cleanAction(action);
  const digest = tokenDigest(token);
  const index = project.pendingApprovals.findIndex((approval) => approval.tokenSha256 === digest);
  if (index < 0) throw new Error('Approval token is invalid');
  const approval = project.pendingApprovals[index];
  if (approval.status !== 'pending') throw new Error('Approval token has already been used or revoked');
  if (approval.action !== expectedAction) throw new Error('Approval token is bound to another action');
  if (approval.principal?.id !== principal.id || approval.principal?.type !== 'human') throw new Error('Approval token is bound to another principal');
  if (approval.semanticRevision !== project.semanticRevision) throw new Error('Approval token is stale for the current semantic revision');
  if (Date.parse(approval.expiresAt) <= now.getTime()) throw new Error('Approval token has expired');
  const consumed = { ...approval, status: 'used', usedAt: now.toISOString() };
  const pendingApprovals = [...project.pendingApprovals];
  pendingApprovals[index] = consumed;
  return { approval: consumed, pendingApprovals };
}

export function approvalTokenDigest(token) { return tokenDigest(token); }
