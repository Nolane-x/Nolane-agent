const STANDARD_STATES = Object.freeze(['loading', 'ready', 'empty', 'degraded', 'error']);
export const LEGACY_CENTER_IDS = Object.freeze(['integratedBrowser', 'secrets', 'runtime', 'sandbox', 'trust', 'operations', 'contextMemory', 'traceEvidence', 'repositoryIntelligence', 'codebaseKnowledge', 'localOperations', 'evidenceRuntime', 'gitGovernance', 'instructionGovernance', 'agentModes', 'missionState', 'collaborationExperience']);
export const REQUIRED_LEVEL_ONE_SURFACES = Object.freeze(['workroom', 'provider-connections', 'goal-os', 'diff-review']);

export function validateUiCapability(definition) {
  for (const key of ['id', 'domain', 'controlPlaneRoute', 'levelOneExposure', 'apiRoutes', 'states', 'permissions']) if (definition?.[key] === undefined || definition?.[key] === null || definition?.[key] === '') throw new Error(`UI capability requires ${key}`);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(definition.id)) throw new Error('UI capability id must be kebab-case');
  if (!String(definition.controlPlaneRoute).startsWith('/control-plane/')) throw new Error('controlPlaneRoute must be under /control-plane');
  if (!Array.isArray(definition.apiRoutes) || !definition.apiRoutes.every((route) => typeof route === 'string' && route.startsWith('/api/'))) throw new Error('apiRoutes must contain local API paths');
  if (!Array.isArray(definition.permissions)) throw new Error('permissions must be an array');
  if (!Array.isArray(definition.states) || STANDARD_STATES.some((state) => !definition.states.includes(state))) throw new Error(`states must include ${STANDARD_STATES.join(', ')}`);
  return Object.freeze({ ...definition, apiRoutes: Object.freeze([...definition.apiRoutes]), states: Object.freeze([...definition.states]), permissions: Object.freeze([...definition.permissions]) });
}

const states = STANDARD_STATES;
const rawDefinitions = [
  ['integrated-browser','runtime','/control-plane/runtime/browser-sessions','artifact-only',['/api/browser'],['browser:use'],'integratedBrowser'],
  ['secrets','trust-security','/control-plane/trust-security/secrets','none',['/api/secrets'],['secrets:manage'],'secrets'],
  ['runtime','runtime','/control-plane/runtime/processes','status-only',['/api/runtime'],['runtime:read'],'runtime'],
  ['sandbox','runtime','/control-plane/runtime/sandboxes','status-only',['/api/sandboxes'],['sandbox:read'],'sandbox'],
  ['workspace-trust','trust-security','/control-plane/trust-security/workspace-trust','trust-summary',['/api/workspace-trust'],['trust:manage'],'trust'],
  ['agent-operations','operations','/control-plane/operations/agents','agent-summary',['/api/agents'],['agents:manage'],'operations'],
  ['context-memory','context-memory','/control-plane/context-memory/current','context-summary',['/api/context','/api/memory'],['context:read'],'contextMemory'],
  ['trace-evidence','evidence','/control-plane/evidence/trace','evidence-summary',['/api/evidence'],['evidence:read'],'traceEvidence'],
  ['repository-intelligence','intelligence','/control-plane/intelligence/repository','repository-summary',['/api/repository-intelligence'],['project:read'],'repositoryIntelligence'],
  ['codebase-knowledge','intelligence','/control-plane/intelligence/knowledge','knowledge-summary',['/api/codebase-knowledge'],['project:read'],'codebaseKnowledge'],
  ['local-operations','operations','/control-plane/operations/human-control','attention-only',['/api/local-operations'],['operations:manage'],'localOperations'],
  ['evidence-runtime','evidence','/control-plane/evidence/verification-runtime','verification-summary',['/api/evidence-runtime'],['evidence:verify'],'evidenceRuntime'],
  ['git-governance','governance','/control-plane/governance/git','change-summary',['/api/git-governance'],['git:manage'],'gitGovernance'],
  ['instruction-governance','governance','/control-plane/governance/instructions','rules-summary',['/api/instruction-governance'],['instructions:manage'],'instructionGovernance'],
  ['agent-modes','autonomy','/control-plane/autonomy/modes','intent-presets',['/api/agent-modes'],['autonomy:manage'],'agentModes'],
  ['mission-state','operations','/control-plane/operations/mission-state','mission-summary',['/api/mission-state'],['missions:read'],'missionState'],
  ['collaboration-experience','operations','/control-plane/operations/collaboration','agent-summary',['/api/collaboration'],['collaboration:read'],'collaborationExperience'],
  ['workroom','workspace','/control-plane/runtime/workroom','workroom',['/api/workroom'],['project:read'],null],
  ['provider-connections','extensions','/control-plane/extensions/providers','provider-picker',['/api/providers'],['providers:manage'],null],
  ['goal-os','operations','/control-plane/operations/goals','plan-summary',['/api/goals'],['missions:read'],null],
  ['diff-review','evidence','/control-plane/evidence/review','review-surface',['/api/review'],['project:review'],null],
  ['small-model-foundation','labs','/control-plane/labs/small-model-foundation','status-only',['/api/small-model/foundation/status','/api/small-model/foundation/snapshot'],['labs:read'],null],
];
export const UI_CAPABILITIES = Object.freeze(rawDefinitions.map(([id, domain, controlPlaneRoute, levelOneExposure, apiRoutes, permissions, legacySourceId]) => validateUiCapability({ id, domain, controlPlaneRoute, levelOneExposure, apiRoutes, states, permissions, legacySourceId })));

export function auditUiCapabilityCoverage(capabilities = UI_CAPABILITIES) {
  const ids = capabilities.map((item) => item.id); const routes = capabilities.map((item) => item.controlPlaneRoute);
  const duplicates = (values) => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
  const legacy = new Set(capabilities.map((item) => item.legacySourceId).filter(Boolean));
  const surfaces = new Set(ids);
  return Object.freeze({ total: capabilities.length, duplicateIds: Object.freeze(duplicates(ids)), duplicateRoutes: Object.freeze(duplicates(routes)), missingLegacyCenters: Object.freeze(LEGACY_CENTER_IDS.filter((id) => !legacy.has(id))), missingRequiredSurfaces: Object.freeze(REQUIRED_LEVEL_ONE_SURFACES.filter((id) => !surfaces.has(id))) });
}
