import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalSha256 } from '../core/canonical-json.mjs';
import { canonicalTextContent } from '../core/canonical-text.mjs';
import { PRODUCT } from '../core/constants.mjs';
import { normalizeProviderRecord } from './contracts.mjs';
import { loadCapabilityCatalog } from './capability-catalog.mjs';
import { loadKnowledgePacks } from './knowledge-packs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SKILLS_CATALOG = path.join(ROOT, 'skills/catalog.json');
const PROVIDER_CATALOG = path.join(ROOT, 'providers/built-in-providers.json');
const SKILLS_V2_CATALOG = path.join(ROOT, 'skills-v2/catalog.json');
const STABLE_MAPPINGS = path.join(ROOT, 'config/mappings/stable-skill-mappings.json');

const PACK_DOMAINS = Object.freeze({
  kernel: ['ai-agent-engineering'], research: ['scientific-research', 'ux-research'], creativity: ['product-management', 'graphic-design', 'brand-design'],
  product: ['product-management'], ux: ['ux-research', 'ui-design'], architecture: ['software-architecture'], planning: ['operations-leadership', 'product-management'],
  implementation: ['backend-engineering', 'frontend-engineering', 'software-architecture'], quality: ['software-testing'], security: ['cybersecurity'],
  operations: ['devops-sre', 'operations-leadership'], meta: ['ai-agent-engineering', 'technical-writing'],
});
const DOMAIN_ALIASES = Object.freeze({
  saas: ['backend-engineering', 'product-management'], automation: ['automation-robotics'], 'developer-tools': ['software-architecture', 'backend-engineering'],
  'browser-extensions': ['frontend-engineering'], games: ['game-development'], 'ai-products': ['ai-agent-engineering', 'machine-learning'],
  'data-platforms': ['data-engineering'], mobile: ['mobile-development'], desktop: ['desktop-development'], ecommerce: ['finance-commerce'],
  enterprise: ['operations-leadership', 'legal-compliance'], 'api-products': ['api-integration'],
  'visual-design': ['graphic-design','brand-design','ui-design','motion-design'],
  'interactive-3d': ['graphic-design','industrial-design','frontend-engineering','game-development'],
  'physical-products': ['industrial-design','hardware-embedded','automation-robotics'],
  'physical-ai': ['industrial-design','hardware-embedded','automation-robotics','machine-learning'],
});
const OPERATION_HINTS = Object.freeze({
  'map-landscape': ['map', 'mapping', 'landscape', 'market', 'existing', 'ecosystem', 'prior-art'],
  'frame-problem': ['frame', 'problem', 'intent', 'scope', 'challenge', 'pain'],
  'research-users': ['research', 'user', 'stakeholder', 'interview', 'persona', 'journey', 'mining'],
  'define-requirements': ['requirement', 'acceptance', 'contract', 'criterion', 'specification', 'goal'],
  'model-domain': ['domain', 'model', 'vocabulary', 'ontology', 'schema'],
  'compare-alternatives': ['compare', 'alternative', 'decision', 'tradeoff', 'selecting', 'scoring'],
  'design-concept': ['concept', 'creative', 'idea', 'designing', 'prototype'],
  'prototype-critical-flow': ['prototype', 'mockup', 'wireframe', 'critical-flow'],
  'validate-prototype': ['validate', 'usability', 'prototype', 'experiment'],
  'design-architecture': ['architecture', 'decomposing', 'bounded', 'interface', 'plugin', 'extension'],
  'model-data': ['data', 'event', 'information', 'database', 'schema', 'migration'],
  'model-threats': ['threat', 'security', 'abuse', 'privacy', 'risk'],
  'plan-delivery': ['plan', 'planning', 'sequence', 'task', 'increment', 'delivery'],
  'implement-core': ['implement', 'build', 'develop', 'coding', 'core'],
  'integrate-dependencies': ['integrate', 'dependency', 'adapter', 'tool', 'api'],
  'verify-contracts': ['verify', 'contract', 'invariant', 'review', 'correctness'],
  'test-boundaries': ['boundary', 'negative', 'edge', 'fuzz', 'input'],
  'test-resilience': ['resilience', 'recovery', 'chaos', 'fault', 'rollback'],
  'test-performance': ['performance', 'load', 'latency', 'throughput', 'budget'],
  'test-security': ['security', 'authorization', 'authentication', 'injection', 'tenant', 'secret'],
  'audit-accessibility': ['accessibility', 'inclusive', 'wcag', 'audit'],
  'optimize-quality': ['quality', 'refactor', 'maintainability', 'complexity', 'duplicate'],
  'optimize-cost': ['cost', 'token', 'resource', 'efficiency'],
  'document-system': ['document', 'writing', 'reference', 'readme', 'interface'],
  'prepare-migration': ['migration', 'compatibility', 'upgrade', 'version'],
  'plan-rollout': ['rollout', 'release', 'deployment', 'canary', 'rollback'],
  'instrument-observability': ['observability', 'metric', 'logging', 'telemetry', 'monitoring'],
  'operate-lifecycle': ['operate', 'lifecycle', 'maintenance', 'ci-cd', 'service-objective'],
  'respond-incidents': ['incident', 'debug', 'triage', 'failure', 'defect'],
  'govern-evolution': ['govern', 'policy', 'evolution', 'extension', 'skill'],
  'measure-outcomes': ['measure', 'outcome', 'evaluation', 'benchmark', 'utility'],
  'certify-release': ['certify', 'release-readiness', 'provenance', 'dossier', 'completion'],
});

function tokens(value) {
  return new Set(String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter(Boolean));
}
function skillPath(skill) {
  return skill.kind === 'domain'
    ? path.join(ROOT, 'skills/domains', skill.domain, skill.name, 'SKILL.md')
    : path.join(ROOT, 'skills/core', skill.pack, skill.name, 'SKILL.md');
}
function preferredDomains(skill) {
  return skill.kind === 'domain' ? (DOMAIN_ALIASES[skill.domain] ?? []) : (PACK_DOMAINS[skill.pack] ?? ['ai-agent-engineering']);
}
function operationScore(skillTokens, capability) {
  let score = 0;
  const capTokens = tokens([capability.capabilityId, capability.title, capability.phase, ...(capability.knowledgeTopics ?? [])].join(' '));
  for (const token of skillTokens) if (capTokens.has(token)) score += 3;
  for (const hint of OPERATION_HINTS[capability.phase] ?? []) if (skillTokens.has(hint)) score += 5;
  return score;
}
function rankSkillCapabilities(skill, capabilities) {
  const domains = preferredDomains(skill);
  const skillTokens = tokens([skill.name, skill.description, skill.pack, skill.domain, ...(skill.consumes ?? []), ...(skill.produces ?? []), skill.method?.focus].join(' '));
  return capabilities.map((capability) => {
    const domainIndex = domains.indexOf(capability.domain);
    const domainScore = domainIndex >= 0 ? 100 - domainIndex * 10 : 0;
    const packScore = capability.domain === 'ai-agent-engineering' && ['kernel', 'meta'].includes(skill.pack) ? 15 : 0;
    return { capability, score: domainScore + packScore + operationScore(skillTokens, capability) };
  }).sort((a, b) => b.score - a.score || a.capability.capabilityId.localeCompare(b.capability.capabilityId));
}
function assignSkillCapabilities(skills, capabilities, explicitMappings = new Map()) {
  return [...skills].sort((a, b) => a.name.localeCompare(b.name)).map((skill) => {
    const explicit = explicitMappings.get(skill.name);
    if (explicit) {
      const primary = explicit.capabilityIds.map((id) => capabilities.find((item) => item.capabilityId === id)).find(Boolean);
      if (!primary) throw new Error(`Stable mapping for ${skill.name} has no legacy capability target`);
      return { skill, capability: primary, capabilityIds: explicit.capabilityIds, mapping: explicit, mappingStatus: 'reviewed' };
    }
    const ranked = rankSkillCapabilities(skill, capabilities);
    const capabilityIds = ranked.slice(0, 3).map((entry) => entry.capability.capabilityId);
    return { skill, capability: ranked[0].capability, capabilityIds, mapping: null, mappingStatus: 'heuristic-candidate' };
  });
}
function providerWithExtras(base, extras) {
  return Object.freeze({ ...normalizeProviderRecord(base), ...extras });
}

export async function buildBuiltInProviders() {
  const [skillsRaw, capabilities, knowledgePacks, mappingsRaw, v2Catalog] = await Promise.all([
    readFile(SKILLS_CATALOG, 'utf8').then(JSON.parse), loadCapabilityCatalog(), loadKnowledgePacks(),
    readFile(STABLE_MAPPINGS, 'utf8').then(JSON.parse), readFile(SKILLS_V2_CATALOG, 'utf8').then(JSON.parse),
  ]);
  const explicitMappings = new Map(mappingsRaw.map((item) => [item.skillId, item]));
  const v2ById = new Map(v2Catalog.map((item) => [item.id, item]));
  const skillAssignments = assignSkillCapabilities(skillsRaw, capabilities, explicitMappings);
  const skillProviders = await Promise.all(skillAssignments.map(async ({ skill, capability, capabilityIds, mapping, mappingStatus }) => {
    const v2 = v2ById.get(skill.name);
    const legacyFile = path.relative(ROOT, skillPath(skill)).replaceAll(path.sep, '/');
    const file = v2 ? `${v2.path}/manifest.json` : legacyFile;
    const body = await readFile(path.join(ROOT, file), 'utf8');
    const contentDigest = v2?.manifestSha256 ?? canonicalSha256({ skill, body: canonicalTextContent(body) });
    const status = skill.status === 'stable' ? 'stable' : 'candidate';
    const trustScore = status === 'stable' ? 98 : 82;
    const defaultModel = 'gpt-5.6';
    const defaultSections = v2?.defaultSections ?? [];
    const sectionTokens = v2 ? defaultSections.reduce((sum, id) => sum + (v2.sectionIndex.sections.find((section) => section.id === id)?.tokens?.[defaultModel] ?? 0), 0) : null;
    return providerWithExtras({
      providerId: `local-skill.${skill.name}`,
      capabilityId: capability.capabilityId,
      sourceId: 'forgeos-local',
      sourceCoordinate: `release:v${PRODUCT.version}#${file}`,
      contentDigest,
      kind: 'skill', status,
      title: skill.name,
      license: { spdx: 'MIT', mode: 'vendor-allowed', ambiguous: false },
      trust: { score: trustScore, blockers: [] },
      compatibility: { agents: ['*'], tools: skill.requiredTools ?? skill.tools ?? [] },
    }, {
      capabilityIds: Object.freeze([...(capabilityIds ?? [capability.capabilityId])]),
      mapping: Object.freeze({ status: mappingStatus, fitScore: mapping?.fitScore ?? null, mappingEvidence: mapping ? `reviewed:v0.6:${skill.name}` : 'heuristic:candidate-only' }),
      estimatedTokens: Number(sectionTokens ?? skill.context?.estimatedTokens ?? Math.ceil(body.length / 4)),
      context: v2 ? Object.freeze({ targetTokens: v2.targetTokens, hardTokens: v2.hardTokens, defaultSections: Object.freeze([...defaultSections]), sectionIndexSha256: v2.sectionIndex.indexSha256 }) : Object.freeze({ hardTokens: skill.context?.estimatedTokens ?? Math.ceil(body.length / 4), defaultSections: Object.freeze(['overview']) }),
      riskClass: capability.riskClass,
      conflicts: skill.conflicts ?? [],
      material: v2
        ? Object.freeze({ type: 'local-agent-skill-v2', packagePath: v2.path, manifestPath: file, defaultSections: Object.freeze([...defaultSections]), sectionIndex: v2.sectionIndex, contractDigest: v2.manifestSha256, bodyLoadedByDefault: false })
        : Object.freeze({ type: 'local-agent-skill', path: file, contractDigest: canonicalSha256(skill), bodyLoadedByDefault: false }),
      builtIn: true,
    });
  }));
  const legacyNames = new Set(skillsRaw.map((skill) => skill.name));
  const standaloneV2Providers = await Promise.all(v2Catalog.filter((entry) => !legacyNames.has(entry.id)).map(async (entry) => {
    const manifestFile = `${entry.path}/manifest.json`;
    const manifest = JSON.parse(await readFile(path.join(ROOT, manifestFile), 'utf8'));
    const primaryId = (entry.capabilityIds ?? []).find((id) => !id.startsWith('technique.'));
    const capability = capabilities.find((item) => item.capabilityId === primaryId);
    if (!capability) throw new Error(`Standalone v2 skill ${entry.id} has no legacy outcome capability`);
    const status = entry.maturity === 'stable' || entry.maturity === 'certified' ? 'stable' : 'candidate';
    const defaultSections = entry.defaultSections ?? manifest.context?.defaultSections ?? ['overview','procedure','verification'];
    const model = 'gpt-5.6';
    const sectionTokens = defaultSections.reduce((sum, id) => sum + (entry.sectionIndex.sections.find((section) => section.id === id)?.tokens?.[model] ?? 0), 0);
    return providerWithExtras({
      providerId: `local-skill.${entry.id}`, capabilityId: capability.capabilityId, sourceId: 'forgeos-local',
      sourceCoordinate: `release:v${PRODUCT.version}#${manifestFile}`, contentDigest: entry.manifestSha256,
      kind: 'skill', status, title: manifest.identity?.title ?? entry.id,
      license: { spdx: 'MIT', mode: 'vendor-allowed', ambiguous: false },
      trust: { score: status === 'stable' ? 98 : 82, blockers: [] },
      compatibility: { agents: ['*'], tools: manifest.contract?.requiredTools ?? [] },
    }, {
      capabilityIds: Object.freeze([...(entry.capabilityIds ?? [capability.capabilityId])]),
      mapping: Object.freeze({ status: 'reviewed', fitScore: 96, mappingEvidence: `reviewed:l0:${entry.id}` }),
      estimatedTokens: Number(sectionTokens),
      context: Object.freeze({ targetTokens: entry.targetTokens, hardTokens: entry.hardTokens, defaultSections: Object.freeze([...defaultSections]), sectionIndexSha256: entry.sectionIndex.indexSha256 }),
      riskClass: capability.riskClass, conflicts: [],
      material: Object.freeze({ type: 'local-agent-skill-v2', packagePath: entry.path, manifestPath: manifestFile, defaultSections: Object.freeze([...defaultSections]), sectionIndex: entry.sectionIndex, contractDigest: entry.manifestSha256, bodyLoadedByDefault: false }),
      builtIn: true,
    });
  }));
  const packs = new Map(knowledgePacks.map((pack) => [pack.id, pack]));
  const knowledgeProviders = capabilities.map((capability) => {
    const pack = packs.get(capability.knowledgePackId);
    if (!pack) throw new Error(`Missing knowledge pack ${capability.knowledgePackId}`);
    const file = `knowledge/packs/${capability.domain}.json`;
    const sourceDigest = canonicalSha256({ pack, capabilityId: capability.capabilityId });
    return providerWithExtras({
      providerId: `local-knowledge.${capability.capabilityId}`,
      capabilityId: capability.capabilityId,
      sourceId: 'forgeos-local',
      sourceCoordinate: `release:v${PRODUCT.version}#${file}:${capability.capabilityId}`,
      contentDigest: sourceDigest,
      kind: 'knowledge', status: 'stable',
      title: `${pack.title}: ${capability.title}`,
      license: { spdx: 'MIT', mode: 'link-only', ambiguous: false },
      trust: { score: 94, blockers: [] },
      compatibility: { agents: ['*'], tools: [] },
    }, {
      capabilityIds: Object.freeze([capability.capabilityId]),
      estimatedTokens: 220,
      context: Object.freeze({ targetTokens: 220, hardTokens: 320, defaultSections: Object.freeze([]) }),
      riskClass: capability.riskClass,
      conflicts: [],
      material: Object.freeze({ type: 'knowledge-pack-reference', path: file, capabilityId: capability.capabilityId, loadingPolicy: pack.loadingPolicy, sourceIds: pack.sources.map((source) => source.id), remoteContentVendored: false }),
      builtIn: true,
    });
  });
  return Object.freeze([...skillProviders, ...standaloneV2Providers, ...knowledgeProviders].sort((a, b) => a.providerId.localeCompare(b.providerId)));
}

export async function loadBuiltInProviders(file = PROVIDER_CATALOG) {
  const records = JSON.parse(await readFile(file, 'utf8'));
  if (!Array.isArray(records)) throw new TypeError('Built-in provider catalog must be an array');
  return Object.freeze(records.map((record) => Object.freeze(record)));
}

export async function seedBuiltInProviders(store, providers = null) {
  if (!store || typeof store.seedProviders !== 'function') throw new TypeError('Federation catalog store with seedProviders() is required');
  const records = providers ?? await loadBuiltInProviders();
  return store.seedProviders(records);
}
