import { randomUUID } from 'node:crypto';
import { ARTIFACT_STATES } from './constants.mjs';
import { assertNoSecrets, assertSafeValue } from './security.mjs';
import { canonicalSha256 } from './canonical-json.mjs';
import { validateArtifactContent } from './artifact-registry.mjs';
import { assertPrincipal, principalRecord } from './principals.mjs';
import { validateRuntimeSchema } from './runtime-schemas.mjs';

const clone = (value) => structuredClone(value);
const text = (value, label, max = 200) => {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${label} is required`);
  if (result.length > max) throw new RangeError(`${label} is too large`);
  return result;
};
const list = (value, label) => {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  return value.map((item, index) => text(item, `${label}[${index}]`, 200));
};

export function artifactHash({ type, slot = 'default', schemaVersion, version = 1, title = '', content, consumes = [], dependencyHashes = {}, decisions = [], sourceIdeaId = null, sourceIdeaSha256 = null }) {
  return canonicalSha256({ type, slot, schemaVersion, version, title, content, consumes: [...consumes].sort(), dependencyHashes, decisions: [...decisions].sort(), sourceIdeaId, sourceIdeaSha256 });
}

export function artifactEnvelopeHash(artifact) {
  const value = structuredClone(artifact);
  delete value.envelopeHash;
  return canonicalSha256(value);
}

function sealArtifact(artifact) {
  artifact.contentHash = artifactHash(artifact);
  artifact.sha256 = artifact.contentHash;
  artifact.envelopeHash = artifactEnvelopeHash(artifact);
  return artifact;
}


function assertReviewer(principal, artifact, action) {
  const trusted = assertPrincipal(principal);
  if (!trusted.roles.some((role) => ['reviewer','artifact-reviewer','artifact-verifier','security-reviewer'].includes(role))) {
    throw new Error(`Artifact ${action} requires a reviewer role`);
  }
  if (artifact.producedBy.principalId === trusted.id) throw new Error(`Worker cannot ${action} its own artifact`);
  if (artifact.producedBy.trustDomain && artifact.producedBy.trustDomain === trusted.trustDomain) {
    throw new Error(`Artifact ${action} requires an independent trust domain`);
  }
  return trusted;
}

function producer(input, principal) {
  if (principal) {
    const record = principalRecord(assertPrincipal(principal));
    return { skill: text(input.producedBy?.skill, 'producedBy.skill', 64), skillRunId: input.producedBy?.skillRunId ? text(input.producedBy.skillRunId, 'producedBy.skillRunId', 120) : null, principalId: record.id, principalType: record.type, trustDomain: record.trustDomain };
  }
  return {
    skill: text(input.producedBy?.skill, 'producedBy.skill', 64),
    skillRunId: input.producedBy?.skillRunId ? text(input.producedBy.skillRunId, 'producedBy.skillRunId', 120) : null,
    principalId: text(input.producedBy?.agent, 'producedBy.agent', 120),
    principalType: 'agent',
    trustDomain: 'legacy',
  };
}

export function createArtifact(input, options = {}) {
  assertSafeValue(input);
  assertNoSecrets(input);
  const now = options.now ?? new Date().toISOString();
  const type = text(input.type, 'type', 100);
  const content = clone(input.content ?? {});
  validateArtifactContent(type, content);
  const version = Number(input.version ?? options.version ?? 1);
  if (!Number.isInteger(version) || version < 1) throw new TypeError('artifact.version must be a positive integer');
  const artifact = {
    id: options.id ?? input.id ?? `artifact_${randomUUID().replaceAll('-', '').slice(0, 20)}`,
    projectId: text(input.projectId, 'projectId', 64),
    type,
    slot: text(input.slot ?? 'default', 'slot', 100),
    schemaVersion: text(input.schemaVersion ?? '1.0.0', 'schemaVersion', 30),
    version,
    state: 'draft',
    title: text(input.title ?? type, 'title', 300),
    content,
    producedBy: producer(input, options.principal),
    consumes: list(input.consumes ?? [], 'consumes'),
    dependencyHashes: structuredClone(input.dependencyHashes ?? {}),
    decisions: list(input.decisions ?? [], 'decisions'),
    evidence: list(input.evidence ?? [], 'evidence'),
    residualRisks: list(input.residualRisks ?? [], 'residualRisks'),
    sourceIdeaId: input.sourceIdeaId ? text(input.sourceIdeaId, 'sourceIdeaId', 100) : null,
    sourceIdeaSha256: input.sourceIdeaSha256 ? text(input.sourceIdeaSha256, 'sourceIdeaSha256', 64) : null,
    createdAt: now,
    updatedAt: now,
    supersedes: input.supersedes ? text(input.supersedes, 'supersedes', 200) : null,
    supersededBy: null,
    invalidation: null,
    review: null,
    verification: null,
  };
  sealArtifact(artifact);
  validateRuntimeSchema('artifact', artifact);
  return artifact;
}

export function assertArtifactIntegrity(artifact) {
  const expected = artifactHash(artifact);
  if (artifact.sha256 !== expected || artifact.contentHash !== expected) throw new Error(`Artifact content hash mismatch: ${artifact.id}`);
  const envelope = artifactEnvelopeHash(artifact);
  if (artifact.envelopeHash !== envelope) throw new Error(`Artifact envelope hash mismatch: ${artifact.id}`);
  validateArtifactContent(artifact.type, artifact.content);
  validateRuntimeSchema('artifact', artifact);
  return artifact;
}

export function reviewArtifact(artifact, review) {
  assertArtifactIntegrity(artifact);
  if (artifact.state !== 'draft') throw new Error('Only draft artifacts can enter review');
  const principal = assertReviewer(review.principal, artifact, 'review');
  const next = clone(artifact);
  next.state = 'review';
  next.updatedAt = review.now ?? new Date().toISOString();
  next.review = { reviewer: principalRecord(principal), notes: text(review.notes, 'review.notes', 4000), reviewedAt: next.updatedAt };
  return sealArtifact(next);
}

export function verifyArtifact(artifact, review) {
  assertArtifactIntegrity(artifact);
  if (!ARTIFACT_STATES.includes(artifact.state) || ['superseded','invalidated','verified'].includes(artifact.state)) throw new Error('Artifact cannot be verified from its current state');
  if (review.requireReview && artifact.state !== 'review') throw new Error('Artifact must enter review before verification');
  const principal = review.principal ? assertReviewer(review.principal, artifact, 'verify') : null;
  const reviewerId = principal?.id ?? text(review.reviewer, 'review.reviewer', 120);
  const next = clone(artifact);
  next.state = 'verified';
  next.updatedAt = review.now ?? new Date().toISOString();
  next.evidence = [...new Set([...next.evidence, ...list(review.evidence ?? [], 'review.evidence')])];
  next.verification = {
    gateId: review.gateId ? text(review.gateId, 'review.gateId', 120) : null,
    reviewer: principal ? principalRecord(principal) : { id: reviewerId, type: 'legacy' },
    verifiedAt: next.updatedAt,
  };
  return sealArtifact(next);
}

export function supersedeArtifact(artifact, supersededBy, now = new Date().toISOString()) {
  assertArtifactIntegrity(artifact);
  if (artifact.state === 'superseded' || artifact.state === 'invalidated') throw new Error('Historical artifact cannot be superseded');
  if (artifact.id === supersededBy) throw new Error('Artifact cannot supersede itself');
  const next = clone(artifact);
  next.state = 'superseded';
  next.supersededBy = text(supersededBy, 'supersededBy', 200);
  next.updatedAt = now;
  return sealArtifact(next);
}

export function invalidateArtifact(artifact, reason, upstream, now = new Date().toISOString()) {
  assertArtifactIntegrity(artifact);
  if (artifact.state === 'superseded') return clone(artifact);
  const next = clone(artifact);
  next.state = 'invalidated';
  next.updatedAt = now;
  next.invalidation = { reason: text(reason, 'invalidation.reason', 2000), upstream: [...new Set(upstream ?? [])], invalidatedAt: now };
  return sealArtifact(next);
}
