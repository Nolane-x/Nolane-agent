import { canonicalSha256 } from './canonical-json.mjs';

const ACTIVE_STATES = new Set(['draft','review','verified']);

export function activeArtifacts(project, type = null) {
  return (project.artifacts ?? []).filter((artifact) => ACTIVE_STATES.has(artifact.state) && (!type || artifact.type === type));
}

export function semanticSnapshot(project) {
  return {
    id: project.id,
    semanticRevision: project.semanticRevision,
    stage: project.stage,
    domain: project.domain ?? 'all',
    assurance: project.assurance ?? 'A1',
    intent: project.intent ?? null,
    brief: project.brief ?? null,
    ideas: (project.ideas ?? []).map(({ id, fingerprint, sha256, mechanism }) => ({ id, fingerprint: fingerprint ?? null, sha256: sha256 ?? null, mechanism: mechanism ?? null })),
    scores: (project.scores ?? []).map(({ ideaId, ideaSha256, total, rubricVersion, evaluator }) => ({ ideaId, ideaSha256: ideaSha256 ?? null, total: total ?? null, rubricVersion: rubricVersion ?? null, evaluator: evaluator ?? null })),
    selectedIdeaId: project.selectedIdeaId ?? null,
    selectionReason: project.selectionReason ?? null,
    decisions: project.decisions ?? [],
    artifacts: activeArtifacts(project).map(({ id, type, state, sha256, consumes, verification }) => ({ id, type, state, sha256: sha256 ?? null, consumes: consumes ?? [], verification: verification ?? null })),
    evidence: (project.evidence ?? []).map(({ id, type, status, sha256, subject, producer, method }) => ({ id, type, status: status ?? null, sha256: sha256 ?? null, subject: subject ?? null, producer: producer ?? null, method: method ?? null })),
    findings: project.findings ?? [],
    risks: project.risks ?? [],
  };
}

export function semanticInputSha256(project) {
  return canonicalSha256(semanticSnapshot(project));
}

export function evidenceAppliesTo(evidence, project) {
  if (!evidence || evidence.status !== 'pass') return false;
  if (!evidence.id || !evidence.type || !evidence.summary?.trim()) return false;
  if (!/^[a-f0-9]{64}$/i.test(evidence.sha256 ?? '')) return false;
  if (!evidence.producer?.id || evidence.producer.type !== 'service' || !evidence.producer.roles?.includes('evidence-provider')) return false;
  if (!evidence.producer.trustDomain?.startsWith('evidence-provider:')) return false;
  if (!evidence.method?.kind || !evidence.method?.providerId) return false;
  const receipt = evidence.receipt;
  if (!receipt?.trusted || receipt.payloadSha256 !== evidence.sha256 || receipt.providerId !== evidence.method.providerId) return false;
  const receiptCore = { ...receipt }; delete receiptCore.receiptSha256;
  if (receipt.receiptSha256 !== canonicalSha256(receiptCore)) return false;
  if (receipt.claimsSha256 && receipt.claimsSha256 !== canonicalSha256(evidence.metadata?.claims ?? {})) return false;
  if (receipt.requestSha256) {
    const requestEnvelope={type:evidence.type,title:evidence.title,subject:evidence.subject,metadata:evidence.metadata?.request??{}};
    if(receipt.requestSha256!==canonicalSha256(requestEnvelope))return false;
  }
  if (evidence.method.kind === 'command' && evidence.method.exitCode !== 0) return false;
  const subject = evidence.subject;
  if (!subject || subject.projectId !== project.id) return false;
  if (subject.artifactId) {
    const artifact = activeArtifacts(project).find((item) => item.id === subject.artifactId);
    return Boolean(artifact && subject.artifactSha256 === artifact.sha256);
  }
  if(subject.skillRunId){
    const run=(project.skillRuns??[]).find((item)=>item.id===subject.skillRunId);
    return Boolean(run&&subject.semanticRevision===project.semanticRevision);
  }
  return subject.semanticRevision === project.semanticRevision;
}

export function evidenceForRule(project, type) {
  return (project.evidence ?? []).filter((item) => item.type === type && evidenceAppliesTo(item, project));
}
