import { assertSafeFederationUrl, providerDigest } from './canonical-source.mjs';

const ID = /^[a-z0-9][a-z0-9._-]{2,159}$/;
const SHA = /^[a-f0-9]{64}$/;
const SOURCE_KINDS = new Set(['local-skills','agent-skills-repository','skills-cli-repository','knowledge-index','mcp-registry','mcp-awesome-list','standards-index','vendor-documentation']);
const AUTHORITIES = new Set(['official','vendor','standards-body','community','local']);
const SOURCE_TRUST = new Set(['local','discovery','verified']);
const PROVIDER_STATES = new Set(['discovered','quarantined','candidate','stable','revoked','expired']);
const PROVIDER_KINDS = new Set(['skill','knowledge','mcp','composite']);
const RISK = new Set(['low','medium','high','critical']);

function requiredString(value, name, max = 500) {
  const text = String(value ?? '').trim();
  if (!text || text.length > max) throw new TypeError(`${name} is required and must be <= ${max} characters`);
  return text;
}
function id(value, name) { const text = requiredString(value, name, 160); if (!ID.test(text)) throw new TypeError(`${name} has an invalid identifier`); return text; }
function strings(values, name, { min = 0, max = 100 } = {}) {
  if (!Array.isArray(values) || values.length < min || values.length > max) throw new TypeError(`${name} must contain ${min}-${max} values`);
  const result = [...new Set(values.map((value) => requiredString(value, name, 200)))];
  if (result.length !== values.length) throw new TypeError(`${name} must contain unique values`);
  return result;
}
function license(value = {}) {
  return { spdx: requiredString(value.spdx, 'license.spdx', 80), mode: requiredString(value.mode, 'license.mode', 40), ambiguous: Boolean(value.ambiguous) };
}

export function normalizeFederationSource(input) {
  const kind = requiredString(input?.kind, 'kind', 80);
  if (!SOURCE_KINDS.has(kind)) throw new TypeError(`Unsupported federation source kind: ${kind}`);
  const authority = requiredString(input.authority, 'authority', 40);
  if (!AUTHORITIES.has(authority)) throw new TypeError(`Unsupported authority: ${authority}`);
  const trust = requiredString(input.trust, 'trust', 40);
  if (!SOURCE_TRUST.has(trust)) throw new TypeError(`Unsupported source trust: ${trust}`);
  const revision = requiredString(input.revision, 'revision', 160);
  if (revision === 'resolve-on-sync' && trust !== 'discovery') throw new TypeError('Only discovery sources may use resolve-on-sync');
  return Object.freeze({
    id: id(input.id, 'id'), kind, authority, trust,
    title: requiredString(input.title ?? input.id, 'title', 240),
    url: assertSafeFederationUrl(input.url), revision,
    license: license(input.license), domains: strings(input.domains, 'domains', { min: 1, max: 100 }),
    syncPolicy: Object.freeze({ pinOnImport: input.syncPolicy?.pinOnImport !== false, maxAgeHours: Number.isFinite(input.syncPolicy?.maxAgeHours) ? input.syncPolicy.maxAgeHours : 168 }),
    notes: input.notes ? requiredString(input.notes, 'notes', 1000) : null,
  });
}

export function normalizeCapability(input) {
  const riskClass = requiredString(input?.riskClass, 'riskClass', 20);
  if (!RISK.has(riskClass)) throw new TypeError(`Unsupported riskClass: ${riskClass}`);
  const minimumTrust = Number(input.providerPolicy?.minimumTrust);
  if (!Number.isFinite(minimumTrust) || minimumTrust < 0 || minimumTrust > 100) throw new TypeError('providerPolicy.minimumTrust must be between 0 and 100');
  const contextBudget = Number(input.contextBudget);
  if (!Number.isInteger(contextBudget) || contextBudget < 128 || contextBudget > 100000) throw new TypeError('contextBudget must be an integer between 128 and 100000');
  return Object.freeze({
    capabilityId: id(input.capabilityId, 'capabilityId'), title: requiredString(input.title, 'title', 240),
    domain: id(input.domain, 'domain'), discipline: id(input.discipline, 'discipline'),
    intentSignals: strings(input.intentSignals, 'intentSignals', { min: 1, max: 50 }),
    consumes: strings(input.consumes, 'consumes', { min: 1, max: 50 }), produces: strings(input.produces, 'produces', { min: 1, max: 50 }),
    evidence: strings(input.evidence, 'evidence', { min: 1, max: 50 }), riskClass,
    knowledgeTopics: strings(input.knowledgeTopics, 'knowledgeTopics', { min: 1, max: 100 }),
    requiredTools: strings(input.requiredTools ?? [], 'requiredTools', { max: 50 }),
    conflictTags: strings(input.conflictTags ?? [], 'conflictTags', { max: 50 }),
    preferredSourceIds: strings(input.preferredSourceIds ?? [], 'preferredSourceIds', { min: 1, max: 50 }),
    knowledgePackId: id(input.knowledgePackId, 'knowledgePackId'),
    knowledgeSourceIds: strings(input.knowledgeSourceIds ?? [], 'knowledgeSourceIds', { max: 50 }),
    mcpCapabilities: strings(input.mcpCapabilities ?? [], 'mcpCapabilities', { max: 50 }),
    qualityDimensions: strings(input.qualityDimensions ?? [], 'qualityDimensions', { min: 1, max: 50 }),
    dependencies: strings(input.dependencies ?? [], 'dependencies', { max: 50 }),
    deliveryModel: input.deliveryModel === 'federated-resolution' ? input.deliveryModel : (() => { throw new TypeError('deliveryModel must be federated-resolution'); })(),
    phase: requiredString(input.phase, 'phase', 80), ordinal: Number.isInteger(input.ordinal) && input.ordinal >= 0 ? input.ordinal : (() => { throw new TypeError('ordinal must be a non-negative integer'); })(),
    providerPolicy: Object.freeze({ minimumTrust, allowLinkOnly: input.providerPolicy.allowLinkOnly !== false, preferLocal: input.providerPolicy.preferLocal !== false }),
    contextBudget,
  });
}

export function normalizeProviderRecord(input) {
  if (!SHA.test(String(input?.contentDigest ?? ''))) throw new TypeError('contentDigest must be SHA-256');
  const kind = requiredString(input.kind, 'kind', 40); if (!PROVIDER_KINDS.has(kind)) throw new TypeError(`Unsupported provider kind: ${kind}`);
  const status = requiredString(input.status, 'status', 40); if (!PROVIDER_STATES.has(status)) throw new TypeError(`Unsupported provider status: ${status}`);
  const score = Number(input.trust?.score); if (!Number.isFinite(score) || score < 0 || score > 100) throw new TypeError('trust.score must be between 0 and 100');
  const record = {
    providerId: id(input.providerId, 'providerId'), capabilityId: id(input.capabilityId, 'capabilityId'),
    sourceId: id(input.sourceId, 'sourceId'), sourceCoordinate: requiredString(input.sourceCoordinate, 'sourceCoordinate', 1000),
    contentDigest: input.contentDigest, kind, status, title: requiredString(input.title, 'title', 240),
    license: license(input.license),
    trust: Object.freeze({ score, blockers: strings(input.trust.blockers ?? [], 'trust.blockers', { max: 100 }) }),
    compatibility: Object.freeze({ agents: strings(input.compatibility?.agents ?? [], 'compatibility.agents', { max: 100 }), tools: strings(input.compatibility?.tools ?? [], 'compatibility.tools', { max: 100 }) }),
  };
  return Object.freeze({ ...record, providerDigest: providerDigest(record) });
}
