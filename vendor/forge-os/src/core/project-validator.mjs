import { ASSURANCE_LEVELS, DOMAIN_PACKS, STAGES } from './constants.mjs';
import { validateProjectId } from './contracts.mjs';
import { assertArtifactIntegrity } from './artifacts.mjs';
import { buildArtifactGraph } from './graph.mjs';
import { assertSafeValue } from './security.mjs';
import { validateAuditChain } from './audit-chain.mjs';
import { normalizeProjectAccess, PROJECT_CAPABILITIES } from './project-access.mjs';

const ARRAY_FIELDS = ['research','ideas','scores','decisions','artifacts','evidence','gates','findings','risks','routes','history','pendingApprovals','skillRuns'];
const ID_COLLECTIONS = ['ideas','scores','decisions','artifacts','evidence','gates','findings','pendingApprovals','skillRuns'];

function positiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) throw new TypeError(`${label} must be a positive integer`);
}

function uniqueIds(items, label) {
  const seen = new Set();
  for (const item of items) {
    if (!item?.id) continue;
    if (seen.has(item.id)) throw new TypeError(`Duplicate ${label} id: ${item.id}`);
    seen.add(item.id);
  }
}

export function validateProjectAggregate(project) {
  assertSafeValue(project);
  if (!project || typeof project !== 'object' || Array.isArray(project)) throw new TypeError('Project must be an object');
  validateProjectId(project.id);
  if (project.schemaVersion !== 5) throw new TypeError('Project schemaVersion must be 5');
  const access=normalizeProjectAccess(project.access);
  if(access.ownerPrincipalId!==project.access.ownerPrincipalId) throw new TypeError('Project owner is invalid');
  const allowed=new Set(PROJECT_CAPABILITIES);
  for(const entry of access.entries){if(!entry.capabilities.every((capability)=>allowed.has(capability))) throw new TypeError('Project access capability is invalid');}
  positiveInteger(project.revision, 'project.revision');
  positiveInteger(project.semanticRevision, 'project.semanticRevision');
  if (project.semanticRevision > project.revision) throw new TypeError('semanticRevision cannot exceed revision');
  if (!STAGES.includes(project.stage)) throw new TypeError(`Unknown project stage: ${project.stage}`);
  if (project.domain !== 'all' && !DOMAIN_PACKS.includes(project.domain)) throw new TypeError(`Unknown project domain: ${project.domain}`);
  if (!ASSURANCE_LEVELS.includes(project.assurance)) throw new TypeError(`Unknown assurance level: ${project.assurance}`);
  for (const field of ARRAY_FIELDS) if (!Array.isArray(project[field])) throw new TypeError(`project.${field} must be an array`);
  for (const field of ID_COLLECTIONS) uniqueIds(project[field], field);

  const ideaIds = new Set(project.ideas.map((idea) => idea.id));
  if (project.selectedIdeaId && !ideaIds.has(project.selectedIdeaId)) throw new TypeError(`Selected idea does not exist: ${project.selectedIdeaId}`);
  const ideasById = new Map(project.ideas.map((idea) => [idea.id, idea]));
  const scoredIdeas = new Set();
  for (const score of project.scores) {
    if (!score?.ideaId || scoredIdeas.has(score.ideaId)) throw new TypeError(`Duplicate or invalid score for idea: ${score?.ideaId}`);
    const idea = ideasById.get(score.ideaId);
    if (!idea) throw new TypeError(`Score references unknown idea: ${score.ideaId}`);
    if (score.ideaSha256 !== idea.sha256) throw new TypeError(`Score is stale for idea: ${score.ideaId}`);
    if (!score.evaluator?.id || !score.rubricVersion) throw new TypeError(`Score lacks evaluator provenance: ${score.ideaId}`);
    scoredIdeas.add(score.ideaId);
  }

  const activeSlots = new Set();
  const artifactsById = new Map(project.artifacts.map((artifact) => [artifact.id, artifact]));
  for (const artifact of project.artifacts) {
    if (artifact.projectId !== project.id) throw new TypeError(`Artifact ${artifact.id} belongs to another project`);
    assertArtifactIntegrity(artifact);
    if (['draft','review','verified'].includes(artifact.state)) {
      const slotKey = `${artifact.type}:${artifact.slot ?? 'default'}`;
      if (activeSlots.has(slotKey)) throw new TypeError(`Multiple active artifacts occupy slot ${slotKey}`);
      activeSlots.add(slotKey);
    }
    for (const dependencyId of artifact.consumes ?? []) {
      const dependency = artifactsById.get(dependencyId);
      if (!dependency) throw new TypeError(`Artifact ${artifact.id} references missing dependency ${dependencyId}`);
      if (artifact.dependencyHashes?.[dependencyId] !== dependency.contentHash) throw new Error(`Artifact ${artifact.id} dependency hash mismatch: ${dependencyId}`);
    }
  }
  buildArtifactGraph(project.artifacts);

  const evidenceIds = new Set(project.evidence.map((item) => item.id));
  for (const artifact of project.artifacts) {
    for (const evidenceId of artifact.evidence ?? []) {
      if (!evidenceIds.has(evidenceId)) throw new TypeError(`Artifact ${artifact.id} references missing evidence ${evidenceId}`);
    }
  }
  validateAuditChain(project);
  if (project.stage === 'released') {
    if (!project.sealedAt || !Number.isInteger(project.releaseRevision)) throw new TypeError('Released projects must be sealed');
  }
  return project;
}
