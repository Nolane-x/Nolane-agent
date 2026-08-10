import { randomUUID } from 'node:crypto';
import { STAGES } from './constants.mjs';
import { clusterIdeas } from './scoring.mjs';
import { assuranceProfile, requiredArtifactState, requiredEvidencePolicies } from './assurance.mjs';
import { activeArtifacts, evidenceForRule, semanticInputSha256 } from './proof.mjs';

const STATE_RANK=Object.freeze({draft:1,review:2,verified:3});
const activeArtifact = (project, type, requiredState = null) => activeArtifacts(project, type).some((item) => !requiredState || (STATE_RANK[item.state]??0)>=(STATE_RANK[requiredState]??99));
const artifactForStage=(project,type,stage=project.stage,explicitState=null)=>activeArtifact(project,type,explicitState??requiredArtifactState(project.assurance??'A1',stage));
const proof = (project, type) => evidenceForRule(project, type).map((item) => item.id);
const rule = (id, check, remediation, { severity = 'required', evidenceType = null } = {}) => ({ id, check, remediation, severity, evidenceType });

function findingsResolved(project) {
  const profile = assuranceProfile(project.assurance ?? 'A1');
  return !(project.findings ?? []).some((finding) => {
    if (finding.status === 'closed') return false;
    if (finding.severity === 'critical') return !(profile.acceptedCriticalAllowed && finding.status === 'accepted');
    if (finding.severity === 'high' && profile.blockHighAtRelease) return !['closed'].includes(finding.status);
    return false;
  });
}

const evidenceRule = (type, remediation = `Attach current passing ${type} evidence.`) =>
  rule(type, (project) => proof(project, type), remediation, { evidenceType: type });

export const GATE_RULES = Object.freeze({
  intent: [
    rule('intent-confirmed', (p) => p.intent?.confirmed === true, 'Record and explicitly confirm user intent.'),
    rule('success-defined', (p) => p.intent?.success?.length > 0, 'Define at least one observable success criterion.'),
  ],
  discovery: [
    rule('problem-discovery', (p) => artifactForStage(p, 'problem-discovery') || proof(p, 'user-research'), 'Produce an active problem-discovery artifact or current user-research evidence.'),
  ],
  research: [
    evidenceRule('research-source', 'Attach at least one current authoritative research source.'),
    rule('research-synthesis', (p) => artifactForStage(p, 'research-synthesis'), 'Produce an active research-synthesis artifact.'),
  ],
  divergence: [
    rule('minimum-ideas', (p) => (p.ideas?.length ?? 0) >= 5, 'Generate at least five candidate ideas.'),
    rule('distinct-mechanisms', (p) => clusterIdeas(p.ideas ?? []).length >= 5, 'Create at least five mechanism-distinct idea clusters.'),
  ],
  synthesis: [
    rule('all-ideas-scored', (p) => {
      const ids = new Set((p.ideas ?? []).map((idea) => idea.id));
      const scoreIds = (p.scores ?? []).map((score) => score.ideaId);
      return ids.size > 0 && scoreIds.length === ids.size && new Set(scoreIds).size === ids.size && scoreIds.every((id) => ids.has(id));
    }, 'Score every current candidate exactly once.'),
  ],
  selection: [
    rule('idea-selected', (p) => Boolean(p.selectedIdeaId && p.selectionReason && p.decisions?.some((d) => d.type === 'idea-selection' && d.value === p.selectedIdeaId && d.decidedBy?.type === 'human')), 'Record an authenticated human-selected idea and rationale.'),
  ],
  'product-definition': [
    rule('product-thesis', (p) => artifactForStage(p, 'product-thesis'), 'Produce an active product-thesis artifact.'),
    rule('capability-map', (p) => artifactForStage(p, 'capability-map'), 'Produce an active capability-map artifact.'),
  ],
  'ux-design': [
    rule('ux-contract', (p) => artifactForStage(p, 'ux-contract'), 'Produce an active critical-flow UX contract.'),
    evidenceRule('ux-evidence', 'Attach current interface or prototype evidence.'),
  ],
  architecture: [
    rule('architecture-decision', (p) => artifactForStage(p, 'architecture-decision'), 'Produce an active architecture decision artifact.'),
    rule('threat-model', (p) => artifactForStage(p, 'threat-model') || proof(p, 'security-review'), 'Produce an active threat model or current security review.'),
  ],
  planning: [
    rule('execution-plan', (p) => artifactForStage(p, 'execution-plan'), 'Produce an active executable implementation plan.'),
    rule('acceptance-contracts', (p) => artifactForStage(p, 'acceptance-contracts'), 'Map requirements to acceptance evidence.'),
  ],
  implementation: [evidenceRule('build-output'), evidenceRule('feature-test')],
  verification: [
    evidenceRule('verification-report'), evidenceRule('security-review'), evidenceRule('ux-evidence'),
    rule('critical-findings-resolved', findingsResolved, 'Close findings required by the project assurance profile.', { severity: 'blocker' }),
  ],
  'release-readiness': [
    rule('release-dossier', (p) => artifactForStage(p, 'release-dossier', 'release-readiness', 'verified'), 'Produce and independently verify an active release dossier.'),
    evidenceRule('verification-report'),
    rule('critical-findings-resolved', findingsResolved, 'Close findings required by the project assurance profile.', { severity: 'blocker' }),
  ],
});

if (Object.keys(GATE_RULES).join('|') !== STAGES.slice(0, -1).join('|')) throw new Error('Gate map must match non-terminal ForgeOS stages');

function assuranceRules(project, stage) {
  if (!['verification','release-readiness'].includes(stage)) return [];
  return requiredEvidencePolicies(project.assurance ?? 'A1').map((policy) => evidenceRule(policy.type));
}

export function runGate(project, stage = project.stage) {
  const rules = [...(GATE_RULES[stage] ?? []), ...assuranceRules(project, stage)];
  if (!rules.length) throw new Error(`No gate rules for stage ${stage}`);
  const evidenceByRule = {};
  const results = rules.map(({ id, check, remediation, severity, evidenceType }) => {
    const outcome = check(project);
    const evidenceIds = Array.isArray(outcome) ? outcome : [];
    const passed = Array.isArray(outcome) ? outcome.length > 0 : Boolean(outcome);
    if (evidenceType && evidenceIds.length) evidenceByRule[id] = evidenceIds;
    return { id, passed, remediation, severity, evidence: evidenceIds };
  });
  const failed = results.filter((item) => !item.passed);
  const score = Math.round((results.length - failed.length) / results.length * 100);
  const completelyMissing = stage === 'intent' ? !project.intent : !(project.artifacts?.length || project.evidence?.length || project.ideas?.length || project.selectedIdeaId);
  return {
    id: `gate_${randomUUID().replaceAll('-', '')}`,
    stage,
    status: failed.length === 0 ? 'pass' : completelyMissing ? 'blocked' : 'fail',
    score,
    rules: results,
    failedRules: failed.map((item) => item.id),
    requiredRemediation: failed.map((item) => item.remediation),
    evidence: [...new Set(Object.values(evidenceByRule).flat())],
    evidenceByRule,
    evaluatedRevision: project.revision,
    evaluatedSemanticRevision: project.semanticRevision,
    inputSha256: semanticInputSha256(project),
    checkedAt: new Date().toISOString(),
  };
}
