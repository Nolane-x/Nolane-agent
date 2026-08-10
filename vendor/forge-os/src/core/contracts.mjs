import { mechanismFingerprint, ideaContentSha256 } from './idea-fingerprint.mjs';
import { validateArtifactContent } from './artifact-registry.mjs';

export const LIMITS = Object.freeze({
  shortText: 300,
  longText: 1_000_000,
  arrayItems: 200,
  evidenceItems: 500,
});

function plainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) throw new TypeError(`${label} must be a plain object`);
  return value;
}

function text(value, label, { min = 1, max = LIMITS.shortText } = {}) {
  if (typeof value !== 'string') throw new TypeError(`${label} must be text`);
  const normalized = value.trim();
  if (normalized.length < min) throw new TypeError(`${label} is required`);
  if (normalized.length > max) throw new RangeError(`${label} is too large`);
  return normalized;
}

function stringArray(value, label, { min = 0, max = LIMITS.arrayItems } = {}) {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  if (value.length < min) throw new TypeError(`${label} needs at least ${min} item(s)`);
  if (value.length > max) throw new RangeError(`${label} has too many items`);
  return value.map((item, index) => text(item, `${label}[${index}]`, { max: 1000 }));
}

export function validateProjectId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/.test(value)) {
    throw new TypeError('Invalid project id');
  }
  return value;
}

export function validateIntent(value) {
  const input = plainObject(value, 'intent');
  if (input.confirmed !== true) throw new TypeError('Intent must be explicitly confirmed');
  return {
    goal: text(input.goal, 'intent.goal', { max: 4000 }),
    audience: text(input.audience, 'intent.audience', { max: 2000 }),
    constraints: stringArray(input.constraints ?? [], 'intent.constraints'),
    success: stringArray(input.success, 'intent.success', { min: 1 }),
    nonGoals: stringArray(input.nonGoals ?? [], 'intent.nonGoals'),
    preferredDomain: input.preferredDomain ? text(input.preferredDomain, 'intent.preferredDomain') : null,
    confirmed: true,
  };
}

export function validateIdea(value) {
  const input = plainObject(value, 'idea');
  const idea = {
    id: text(input.id, 'idea.id', { max: 80 }),
    title: text(input.title, 'idea.title', { max: 200 }),
    thesis: text(input.thesis, 'idea.thesis', { max: 4000 }),
    targetUser: text(input.targetUser, 'idea.targetUser', { max: 2000 }),
    hiddenProblem: text(input.hiddenProblem, 'idea.hiddenProblem', { max: 4000 }),
    mechanism: text(input.mechanism, 'idea.mechanism', { max: 4000 }),
    trigger: input.trigger ? text(input.trigger, 'idea.trigger', { max: 2000 }) : null,
    incentive: input.incentive ? text(input.incentive, 'idea.incentive', { max: 2000 }) : null,
    ownership: input.ownership ? text(input.ownership, 'idea.ownership', { max: 2000 }) : null,
    timing: input.timing ? text(input.timing, 'idea.timing', { max: 2000 }) : null,
    interface: text(input.interface, 'idea.interface', { max: 2000 }),
    valueModel: text(input.valueModel, 'idea.valueModel', { max: 2000 }),
    distribution: text(input.distribution, 'idea.distribution', { max: 2000 }),
    assumptions: stringArray(input.assumptions, 'idea.assumptions', { min: 1 }),
    closestPattern: text(input.closestPattern, 'idea.closestPattern', { max: 2000 }),
    differences: stringArray(input.differences, 'idea.differences', { min: 1 }),
    cheapestExperiment: text(input.cheapestExperiment, 'idea.cheapestExperiment', { max: 4000 }),
    failureModes: stringArray(input.failureModes, 'idea.failureModes', { min: 1 }),
  };
  return { ...idea, fingerprint: mechanismFingerprint(idea), sha256: ideaContentSha256(idea) };
}

export function validateArtifact(value) {
  const input = plainObject(value, 'artifact');
  const type = text(input.type, 'artifact.type', { max: 100 });
  const content = plainObject(input.content, 'artifact.content');
  validateArtifactContent(type, content);
  const version = Number(input.version ?? 1);
  if (!Number.isInteger(version) || version < 1 || version > 1_000_000) throw new TypeError('artifact.version must be a positive integer');
  return {
    id: input.id ? text(input.id, 'artifact.id', { max: 100 }) : null,
    type,
    schemaVersion: input.schemaVersion ? text(input.schemaVersion, 'artifact.schemaVersion', { max: 40 }) : '1.0.0',
    title: input.title ? text(input.title, 'artifact.title', { max: 300 }) : type,
    content: structuredClone(content),
    version,
    consumes: stringArray(input.consumes ?? [], 'artifact.consumes'),
    decisions: stringArray(input.decisions ?? [], 'artifact.decisions'),
    residualRisks: stringArray(input.residualRisks ?? [], 'artifact.residualRisks'),
  };
}

export function validateEvidence(value) {
  const input = plainObject(value, 'evidence');
  const status = input.status ?? 'unverified';
  if (!['pass','fail','inconclusive','unverified'].includes(status)) throw new TypeError('evidence.status is invalid');
  const uri = input.uri ? text(input.uri, 'evidence.uri', { max: 4000 }) : null;
  if (uri && !/^(?:https|file|artifact|forge):\/\//i.test(uri)) throw new TypeError('evidence.uri uses an untrusted scheme');
  const sha256 = input.sha256 ? text(input.sha256, 'evidence.sha256', { max: 64 }) : null;
  if (sha256 && !/^[a-f0-9]{64}$/i.test(sha256)) throw new TypeError('evidence.sha256 must be a SHA-256 digest');
  const summary = input.summary ? text(input.summary, 'evidence.summary', { max: 10_000 }) : '';
  const subject = input.subject ? plainObject(input.subject, 'evidence.subject') : null;
  const producer = input.producer ? plainObject(input.producer, 'evidence.producer') : null;
  const method = input.method ? plainObject(input.method, 'evidence.method') : null;
  if (status === 'pass') {
    if (!summary) throw new TypeError('Passing evidence requires a summary');
    if (!sha256) throw new TypeError('Passing evidence requires sha256');
    if (!subject?.projectId || !Number.isInteger(subject.semanticRevision)) throw new TypeError('Passing evidence requires a revision-bound subject');
    if (!producer?.id || !['human','agent','service','system'].includes(producer.type)) throw new TypeError('Passing evidence requires an authenticated producer');
    if (!method?.kind) throw new TypeError('Passing evidence requires a method');
  }
  return {
    id: input.id ? text(input.id, 'evidence.id', { max: 100 }) : null,
    type: text(input.type, 'evidence.type', { max: 100 }),
    title: text(input.title, 'evidence.title', { max: 300 }),
    status,
    uri,
    summary,
    sha256,
    subject: subject ? structuredClone(subject) : null,
    producer: producer ? structuredClone(producer) : null,
    requestedBy: input.requestedBy ? structuredClone(plainObject(input.requestedBy, 'evidence.requestedBy')) : null,
    method: method ? structuredClone(method) : null,
    receipt: input.receipt ? structuredClone(plainObject(input.receipt, 'evidence.receipt')) : null,
    metadata: input.metadata && typeof input.metadata === 'object' ? structuredClone(input.metadata) : {},
  };
}

export function validateScoreVector(value) {
  const input = plainObject(value, 'score');
  const result = { ideaId: text(input.ideaId, 'score.ideaId', { max: 80 }) };
  for (const key of ['novelty','usefulness','feasibility','leverage','defensibility','testability','clarity','evidence']) {
    const number = Number(input[key]);
    if (!Number.isFinite(number) || number < 0 || number > 100) throw new TypeError(`score.${key} must be between 0 and 100`);
    result[key] = number;
  }
  return result;
}
