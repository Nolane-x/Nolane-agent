import { artifactHash, artifactEnvelopeHash } from './artifacts.mjs';
import { initializeAudit } from './audit-chain.mjs';
import { canonicalSha256 } from './canonical-json.mjs';
import { requiredArtifactFields } from './artifact-registry.mjs';
import { createProjectAccess } from './project-access.mjs';

const CURRENT_SCHEMA_VERSION = 5;
const epoch = '1970-01-01T00:00:00.000Z';

function legacyPrincipal(value, fallbackType = 'system') {
  if (value && typeof value === 'object' && value.id) {
    return {
      id: String(value.id),
      type: value.type ?? fallbackType,
      roles: Array.isArray(value.roles) && value.roles.length ? value.roles : ['legacy-import'],
      trustDomain: value.trustDomain ?? 'legacy',
    };
  }
  return {
    id: typeof value === 'string' && value.trim() ? value.trim() : 'legacy-import',
    type: fallbackType,
    roles: ['legacy-import'],
    trustDomain: 'legacy',
  };
}

function baseCollections(project) {
  for (const key of ['research','ideas','scores','decisions','artifacts','evidence','gates','findings','risks','routes','history','pendingApprovals','skillRuns']) {
    if (!Array.isArray(project[key])) project[key] = [];
  }
  if (!project.skillUtility || typeof project.skillUtility !== 'object' || Array.isArray(project.skillUtility)) project.skillUtility = {};
  if (!Array.isArray(project.migrations)) project.migrations = [];
  return project;
}

function migrationRecord(from, to, transformer, project) {
  return {
    from,
    to,
    transformer,
    at: project.updatedAt ?? project.createdAt ?? epoch,
  };
}

function normalizeProducedBy(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    skill: source.skill ?? 'legacy-import',
    principalId: source.principalId ?? source.agent ?? 'legacy-import',
    principalType: source.principalType ?? 'system',
    trustDomain: source.trustDomain ?? 'legacy',
  };
}


function normalizeLegacyContent(type, input) {
  const content = input && typeof input === 'object' && !Array.isArray(input) ? structuredClone(input) : { legacyValue: input ?? null };
  let required;
  try { required = requiredArtifactFields(type); }
  catch { return content; }
  for (const field of required) {
    if (content[field] !== undefined && content[field] !== null && content[field] !== '' && (!Array.isArray(content[field]) || content[field].length)) continue;
    const fallback = content.summary ?? content.description ?? content.legacyValue ?? `Legacy ${type} imported without a complete typed payload.`;
    content[field] = ['results','findings','sources','questions','ideas','scores','capabilities','workflows','journeys','boundaries','threats','tasks','criteria','tests','evidence','procedures','cases'].includes(field) ? [fallback] : fallback;
  }
  return content;
}

function normalizeArtifact(artifact, index, project, sourceVersion) {
  const createdAt = artifact.createdAt ?? project.createdAt ?? epoch;
  const legacyState = artifact.state ?? 'draft';
  const state = legacyState === 'verified' ? 'review' : ['draft','review','superseded','invalidated'].includes(legacyState) ? legacyState : 'draft';
  const next = {
    id: artifact.id ?? `legacy_artifact_${index + 1}`,
    projectId: artifact.projectId ?? project.id,
    type: artifact.type ?? 'legacy-artifact',
    slot: artifact.slot ?? 'default',
    schemaVersion: String(artifact.schemaVersion ?? '1.0.0'),
    version: Number.isInteger(artifact.version) && artifact.version > 0 ? artifact.version : 1,
    state,
    sha256: '',
    contentHash: '',
    envelopeHash: '',
    title: artifact.title ?? artifact.type ?? `Legacy artifact ${index + 1}`,
    content: normalizeLegacyContent(artifact.type ?? 'legacy-artifact', artifact.content),
    producedBy: normalizeProducedBy(artifact.producedBy),
    consumes: Array.isArray(artifact.consumes) ? [...artifact.consumes] : [],
    dependencyHashes: artifact.dependencyHashes && typeof artifact.dependencyHashes === 'object' ? structuredClone(artifact.dependencyHashes) : {},
    decisions: Array.isArray(artifact.decisions) ? [...artifact.decisions] : [],
    residualRisks: Array.isArray(artifact.residualRisks) ? [...artifact.residualRisks] : [],
    evidence: Array.isArray(artifact.evidence) ? [...artifact.evidence] : [],
    sourceIdeaId: artifact.sourceIdeaId ?? null,
    sourceIdeaSha256: artifact.sourceIdeaSha256 ?? null,
    supersedes: artifact.supersedes ?? null,
    supersededBy: artifact.supersededBy ?? null,
    review: artifact.review ?? null,
    verification: null,
    invalidation: artifact.invalidation ?? null,
    migration: {
      sourceVersion,
      legacySha256: artifact.sha256 ?? null,
      legacyState,
      transformer: `forgeos-migrate-artifact-v${sourceVersion}-to-v4`,
    },
    createdAt,
    updatedAt: artifact.updatedAt ?? createdAt,
  };
  next.contentHash = artifactHash(next);
  next.sha256 = next.contentHash;
  next.envelopeHash = artifactEnvelopeHash(next);
  return next;
}

function normalizeEvidence(item, index, project, sourceVersion) {
  const createdAt = item.createdAt ?? project.updatedAt ?? project.createdAt ?? epoch;
  return {
    id: item.id ?? `legacy_evidence_${index + 1}`,
    type: item.type ?? 'legacy-evidence',
    title: item.title ?? `Legacy evidence ${index + 1}`,
    status: 'unverified',
    summary: item.summary || item.title || 'Legacy evidence imported without a trusted execution receipt.',
    uri: item.uri ?? null,
    sha256: item.sha256 ?? null,
    subject: {
      projectId: project.id,
      revision: Math.max(1, Number(project.revision) || 1),
      semanticRevision: Math.max(1, Number(project.semanticRevision) || 1),
      artifactId: item.subject?.artifactId ?? null,
      artifactSha256: item.subject?.artifactSha256 ?? null,
      findingId: item.subject?.findingId ?? null,
      sourceCommit: item.subject?.sourceCommit ?? null,
    },
    producer: legacyPrincipal(item.producer ?? item.producedBy),
    method: {
      kind: 'legacy-import',
      providerId: `migration:v${sourceVersion}-to-v4`,
      tool: null,
      version: null,
      command: null,
      exitCode: null,
    },
    metadata: {
      ...(item.metadata ?? {}),
      migration: { sourceVersion, legacyStatus: item.status ?? item.metadata?.status ?? null },
    },
    createdAt,
  };
}

function migrate1to2(input) {
  const project = baseCollections(structuredClone(input));
  project.schemaVersion = 2;
  project.migrations.push(migrationRecord(1, 2, 'forgeos-v1-to-v2', project));
  return project;
}

function migrate2to3(input) {
  const project = baseCollections(structuredClone(input));
  project.schemaVersion = 3;
  project.revision = Number.isInteger(project.revision) && project.revision > 0 ? project.revision : 1;
  project.semanticRevision = Number.isInteger(project.semanticRevision) && project.semanticRevision > 0 ? project.semanticRevision : 1;
  project.pendingApprovals = project.pendingApprovals ?? [];
  project.skillRuns = project.skillRuns ?? [];
  project.sealedAt = project.sealedAt ?? null;
  project.releaseRevision = project.releaseRevision ?? null;
  project.migrations.push(migrationRecord(2, 3, 'forgeos-v2-to-v3', project));
  return project;
}

function migrate3to4(input, { sourceVersion = Number(input.schemaVersion ?? 3) } = {}) {
  const project = baseCollections(structuredClone(input));
  project.schemaVersion = 4;
  project.revision = Number.isInteger(project.revision) && project.revision > 0 ? project.revision : 1;
  project.semanticRevision = Number.isInteger(project.semanticRevision) && project.semanticRevision > 0 ? project.semanticRevision : 1;
  project.artifacts = (project.artifacts ?? []).map((artifact, index) => normalizeArtifact(artifact, index, project, sourceVersion));
  project.evidence = (project.evidence ?? []).map((evidence, index) => normalizeEvidence(evidence, index, project, sourceVersion));
  project.research = (project.research ?? []).map((entry) => {
    if (entry && typeof entry === 'object' && entry.id && project.evidence.some((item) => item.id === entry.id)) return entry.id;
    return entry;
  });
  project.migrations.push(migrationRecord(3, 4, 'forgeos-v4-trust-kernel', project));
  project.audit = null;
  project.audit = initializeAudit(project, {
    type: 'project-migrated',
    at: project.updatedAt ?? project.createdAt ?? epoch,
    metadata: { from: sourceVersion, to: 4 },
  });
  return project;
}


function migrate4to5(input) {
  const project=baseCollections(structuredClone(input));
  project.schemaVersion=5;
  project.access={ownerPrincipalId:'forgeos-system',ownerTrustDomain:'local',entries:[{principalId:'forgeos-system',trustDomain:'local',capabilities:['read','write','review','release','admin'],grantedBy:{id:'forgeos-system',type:'system',roles:['system'],trustDomain:'local'},grantedAt:epoch}]};
  project.migrations.push(migrationRecord(4,5,'forgeos-v5-project-access',project));
  project.audit=null;
  project.audit=initializeAudit(project,{type:'project-migrated',at:project.updatedAt??project.createdAt??epoch,metadata:{from:4,to:5}});
  return project;
}

export function migrateProject(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Project file must contain an object');
  const originalVersion = Number(input.schemaVersion ?? 1);
  if (!Number.isInteger(originalVersion) || originalVersion < 1) throw new Error(`Unsupported project schema version: ${input.schemaVersion}`);
  if (originalVersion > CURRENT_SCHEMA_VERSION) throw new Error(`Unsupported future project schema version: ${originalVersion}`);
  let project = structuredClone(input);
  let version = originalVersion;
  if (version < 2) { project = migrate1to2(project); version = 2; }
  if (version < 3) { project = migrate2to3(project); version = 3; }
  if (version < 4) { project = migrate3to4(project, { sourceVersion: originalVersion }); version = 4; }
  if (version < 5) { project = migrate4to5(project); }
  return project;
}

export function planMigration(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Project file must contain an object');
  const from = Number(input.schemaVersion ?? 1);
  const steps = [];
  if (from < 2) steps.push('1->2');
  if (from < 3) steps.push('2->3');
  if (from < 4) steps.push('3->4');
  if (from < 5) steps.push('4->5');
  const migrated = migrateProject(input);
  return {
    projectId: input.id ?? null,
    from,
    to: CURRENT_SCHEMA_VERSION,
    steps,
    legacyArtifacts: Array.isArray(input.artifacts) ? input.artifacts.length : 0,
    legacyEvidence: Array.isArray(input.evidence) ? input.evidence.length : 0,
    sourceSha256: canonicalSha256(input),
    resultSha256: canonicalSha256(migrated),
    changes: migrated.migrations?.filter((entry) => entry.to > from) ?? [],
  };
}

export const MIGRATIONS = Object.freeze({ migrate1to2, migrate2to3, migrate3to4, migrate4to5 });
export { CURRENT_SCHEMA_VERSION };
