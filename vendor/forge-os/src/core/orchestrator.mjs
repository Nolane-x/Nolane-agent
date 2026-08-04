import { randomUUID } from 'node:crypto';
import { validateIntent, validateIdea, validateEvidence } from './contracts.mjs';
import { createArtifact, reviewArtifact as markArtifactReviewed, verifyArtifact as markArtifactVerified, supersedeArtifact as markArtifactSuperseded, invalidateArtifact as markArtifactInvalidated } from './artifacts.mjs';
import { buildArtifactGraph, invalidateDownstream } from './graph.mjs';
import { SYSTEM_PRINCIPAL, assertPrincipal, principalRecord } from './principals.mjs';
import { issueApproval, consumeApproval } from './approvals.mjs';
import { scoreIdea, rankIdeas } from './scoring.mjs';
import { runGate } from './gates.mjs';
import { semanticInputSha256, evidenceAppliesTo } from './proof.mjs';
import { nextStage, assertTransition } from './stages.mjs';
import { assertSafeValue, assertNoSecrets } from './security.mjs';
import { loadSkillCatalog } from '../skills/catalog.mjs';
import { routeSkills } from '../router/router.mjs';
import { planToArtifact } from '../router/planner.mjs';
import { recordSkillUtility } from '../router/utility.mjs';
import { validateRuntimeSchema } from './runtime-schemas.mjs';
import { assertTrustedEvidenceReceipt } from '../evidence/providers.mjs';
import { canonicalSha256 } from './canonical-json.mjs';
import { assertProjectAccess, grantProjectAccess as applyProjectGrant } from './project-access.mjs';

const stamp = () => new Date().toISOString();
const id = (prefix) => `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
const cleanText = (value, label) => { const text = String(value ?? '').trim(); if (!text) throw new TypeError(`${label} is required`); return text; };

function validateSkillRunMetrics(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Skill-run metrics must be an object');
  if (typeof input.passed !== 'boolean') throw new TypeError('Skill-run metrics passed must be boolean');
  const qualityDelta = Number(input.qualityDelta ?? 0);
  const tokenDelta = Number(input.tokenDelta ?? 0);
  if (!Number.isFinite(qualityDelta) || qualityDelta < -100 || qualityDelta > 100) throw new TypeError('qualityDelta must be between -100 and 100');
  if (!Number.isInteger(tokenDelta) || tokenDelta < -100_000_000 || tokenDelta > 100_000_000) throw new TypeError('tokenDelta must be a bounded integer');
  const evaluationRunSha256 = String(input.evaluationRunSha256 ?? '');
  if (!/^[a-f0-9]{64}$/i.test(evaluationRunSha256)) throw new TypeError('evaluationRunSha256 is required');
  return { passed: input.passed, qualityDelta, tokenDelta, evaluationRunSha256: evaluationRunSha256.toLowerCase() };
}

const ACTIVE_ARTIFACT_STATES = new Set(['draft','review','verified']);
const GATE_TARGETS = Object.freeze({
  'intent-confirmed': 'confirmed-intent', 'success-defined': 'confirmed-intent',
  'problem-discovery': 'problem-discovery', 'research-source': 'research-synthesis', 'research-synthesis': 'research-synthesis',
  'minimum-ideas': 'candidate-ideas', 'distinct-mechanisms': 'candidate-ideas', 'all-ideas-scored': 'scored-ideas',
  'idea-selected': 'selected-concept', 'product-thesis': 'product-thesis', 'capability-map': 'capability-map',
  'ux-contract': 'ux-contract', 'ux-evidence': 'ux-evidence', 'architecture-decision': 'architecture-decision',
  'threat-model': 'threat-model', 'execution-plan': 'execution-plan', 'acceptance-contracts': 'acceptance-contracts',
  'build-output': 'verified-build', 'feature-test': 'verified-build', 'verification-report': 'verification-report',
  'security-review': 'security-review', 'critical-findings-resolved': 'security-review', 'release-dossier': 'release-dossier',
  'signed-provenance': 'release-dossier', 'independent-security-review': 'security-review',
  'formal-invariant-evidence': 'verification-report', 'supply-chain-attestation': 'release-dossier',
});

function projectArtifactTypes(project) {
  const types = new Set(['project-state','gate-state']);
  if (project.intent?.confirmed) types.add('confirmed-intent');
  if (project.domain !== 'all') types.add('domain-context');
  for (const artifact of project.artifacts ?? []) if (ACTIVE_ARTIFACT_STATES.has(artifact.state)) types.add(artifact.type);
  if ((project.ideas?.length ?? 0) > 0) types.add('candidate-ideas');
  if ((project.scores?.length ?? 0) === (project.ideas?.length ?? -1) && (project.scores?.length ?? 0) > 0) types.add('scored-ideas');
  if (project.selectedIdeaId) types.add('selected-concept');
  if (types.has('product-thesis') && types.has('capability-map')) types.add('product-definition');
  return types;
}

function currentGatePreview(project) {
  if (project.stage === 'released') return null;
  const latest = [...(project.gates ?? [])].reverse().find((gate) => gate.stage === project.stage && gate.evaluatedSemanticRevision === project.semanticRevision);
  return latest ?? runGate(project, project.stage);
}

function targetArtifacts(project) {
  const gate = currentGatePreview(project);
  return [...new Set((gate?.failedRules ?? []).map((ruleId) => GATE_TARGETS[ruleId]).filter(Boolean))];
}

export class ForgeOrchestrator {
  constructor(store, { evidenceProviders = null, evalRunStore = null } = {}) { this.store = store; this.evidenceProviders = evidenceProviders; this.evalRunStore = evalRunStore; }
  createProject(input, context = {}) { const principal=context.principal??SYSTEM_PRINCIPAL;assertPrincipal(principal);return this.store.create({...input,principal}); }
  async getProject(projectId, context = {}) { const principal=context.principal??SYSTEM_PRINCIPAL;const project=await this.store.read(projectId);assertProjectAccess(project,principal,context.capability??'read');return project; }
  async listProjects(context = {}) { const principal=context.principal??SYSTEM_PRINCIPAL;const projects=await this.store.list();return projects.filter((project)=>{try{assertProjectAccess(project,principal,'read');return true;}catch{return false;}}); }
  async exportProject(projectId, context = {}) { await this.getProject(projectId,{principal:context.principal??SYSTEM_PRINCIPAL,capability:'read'});return this.store.exportBundle(projectId); }
  async assertProjectAccess(projectId, principal, capability='read') { const project=await this.store.read(projectId);assertProjectAccess(project,principal??SYSTEM_PRINCIPAL,capability);return project; }
  grantProjectAccess(projectId, input, context = {}) { const principal=context.principal??SYSTEM_PRINCIPAL;return this.store.update(projectId,(project)=>{const next=applyProjectGrant(project,input,principal);return {...next,history:[...next.history,{type:'project-access-granted',principalId:input.principalId,capabilities:[...(input.capabilities??[])],grantedBy:principalRecord(principal),at:stamp()}]};},{semantic:false}); }
  async listProjectSnapshots(projectId, context = {}) { await this.getProject(projectId,{principal:context.principal??SYSTEM_PRINCIPAL,capability:'read'});return this.store.listSnapshots(projectId); }
  async verifyProjectSnapshot(projectId, revision, context = {}) { await this.getProject(projectId,{principal:context.principal??SYSTEM_PRINCIPAL,capability:'read'});return this.store.verifySnapshot(projectId,revision); }
  async restoreProjectSnapshot(projectId, revision, approvalToken, context = {}) { const principal=assertPrincipal(context.principal,{type:'human',scope:'approve'});await this.getProject(projectId,{principal,capability:'admin'});return this.store.restoreSnapshot(projectId,revision,{transform:(current,restored)=>{const consumed=consumeApproval(current,{action:`restore-snapshot:${revision}`,token:approvalToken,principal});return {...restored,pendingApprovals:consumed.pendingApprovals,history:[...(restored.history??[]),{type:'snapshot-restore-approved',revision,principal:principalRecord(principal),at:stamp()}]};}}); }

  async requestApproval(projectId, action, context = {}) {
    const principal = assertPrincipal(context.principal, { type: 'human', scope: 'approve' });
    let issued;
    const project = await this.store.update(projectId, (current) => {
      issued = issueApproval(current, action, principal, { ttlMs: context.ttlMs });
      return {
        ...current,
        pendingApprovals: [...current.pendingApprovals, issued.record],
        history: [...current.history, { type: 'approval-issued', approvalId: issued.record.id, action: issued.record.action, principal: principalRecord(principal), at: stamp() }],
      };
    }, { semantic: false });
    return { approvalId: issued.record.id, action: issued.record.action, expiresAt: issued.record.expiresAt, semanticRevision: project.semanticRevision, token: issued.token };
  }

  recordIntent(projectId, input, context = {}) {
    const principal = context.principal ?? SYSTEM_PRINCIPAL;
    assertPrincipal(principal);
    const intent = validateIntent(input);
    return this.store.update(projectId, (project) => ({
      ...project,
      intent,
      domain: project.domain === 'all' && intent.preferredDomain ? intent.preferredDomain : project.domain,
      history: [...project.history, { type: 'intent-recorded', principal: principalRecord(principal), stage: project.stage, at: stamp() }],
    }));
  }

  saveArtifact(projectId, input, context = {}) {
    const principal = context.principal ?? SYSTEM_PRINCIPAL;
    assertPrincipal(principal);
    return this.store.update(projectId, (project) => {
      if (input.id && project.artifacts.some((item) => item.id === input.id)) throw new TypeError(`Duplicate artifact id: ${input.id}`);
      const slot = input.slot ?? 'default';
      const activeSameSlot = project.artifacts.find((item) => item.type === input.type && (item.slot ?? 'default') === slot && ['draft','review','verified'].includes(item.state));
      if (activeSameSlot) throw new Error(`An active artifact already exists for ${input.type} slot ${slot}; supersede it explicitly`);
      const byId = new Map(project.artifacts.map((item) => [item.id, item]));
      const dependencyHashes = {};
      for (const dependency of input.consumes ?? []) {
        const target = byId.get(dependency);
        if (!target || !['draft','review','verified'].includes(target.state)) throw new TypeError(`Artifact has missing dependency: ${dependency}`);
        dependencyHashes[dependency] = target.contentHash;
      }
      const run = context.skillRunId ? project.skillRuns.find((item) => item.id === context.skillRunId) : null;
      if (context.skillRunId) {
        if (!run || run.status !== 'running') throw new Error(`Unknown or inactive skill run: ${context.skillRunId}`);
        if (run.principal?.id !== principal.id) throw new Error('Only the leased skill-run principal may publish output');
        if (project.semanticRevision !== run.lastAcceptedSemanticRevision) throw new Error('Skill run is stale for the current semantic revision');
        if (!run.expectedOutputs.includes(input.type)) throw new Error(`Skill ${run.skill} is not contracted to produce ${input.type}`);
        if ((input.producedBy?.skill ?? run.skill) !== run.skill) throw new Error('Artifact producing skill does not match the skill run');
      }
      const selected = project.ideas.find((idea) => idea.id === project.selectedIdeaId);
      const artifact = createArtifact({
        ...input,
        slot,
        dependencyHashes,
        producedBy: { ...(input.producedBy ?? { skill: run?.skill ?? 'manual-artifact' }), skillRunId: run?.id ?? input.producedBy?.skillRunId ?? null },
        projectId,
        sourceIdeaId: input.sourceIdeaId ?? (selected ? selected.id : null),
        sourceIdeaSha256: input.sourceIdeaSha256 ?? (selected ? (selected.sha256 ?? selected.fingerprint) : null),
      }, { id: input.id, now: stamp(), principal });
      const artifacts = [...project.artifacts, artifact];
      buildArtifactGraph(artifacts);
      const skillRuns = run ? project.skillRuns.map((item) => item.id === run.id
        ? { ...item, outputCandidateIds: [...new Set([...(item.outputCandidateIds ?? []), artifact.id])], lastAcceptedSemanticRevision: project.semanticRevision + 1 }
        : item) : project.skillRuns;
      return {
        ...project,
        artifacts,
        skillRuns,
        history: [...project.history, { type: 'artifact-created', artifactId: artifact.id, artifactType: artifact.type, skillRunId: run?.id ?? null, principal: principalRecord(principal), stage: project.stage, at: stamp() }],
      };
    });
  }

  addEvidence(projectId, input, context = {}) {
    assertSafeValue(input); assertNoSecrets(input);
    const principal = context.principal ?? SYSTEM_PRINCIPAL;
    assertPrincipal(principal);
    if ((input.status ?? 'unverified') !== 'unverified') throw new Error('Passing or failing evidence must be issued through requestEvidence by a trusted provider');
    return this.store.update(projectId, (project) => {
      const evidenceId = input.id ?? id('evidence');
      if (project.evidence.some((item) => item.id === evidenceId)) throw new TypeError(`Duplicate evidence id: ${evidenceId}`);
      const evidence = {
        ...validateEvidence({
          ...input,
          status: 'unverified',
          sha256: input.sha256 ?? null,
          subject: {
            projectId,
            revision: project.revision,
            semanticRevision: project.semanticRevision,
            artifactId: input.subject?.artifactId ?? null,
            artifactSha256: input.subject?.artifactSha256 ?? null,
            findingId: input.subject?.findingId ?? null,
            sourceCommit: input.subject?.sourceCommit ?? null,
          },
          producer: principalRecord(principal),
          requestedBy: principalRecord(principal),
          method: input.method ?? { kind: 'manual-note' },
          receipt: null,
        }),
        id: evidenceId,
        createdAt: stamp(),
      };
      validateRuntimeSchema('evidence', evidence);
      return {
        ...project,
        evidence: [...project.evidence, evidence],
        research: evidence.type === 'research-source' ? [...project.research, evidence.id] : project.research,
        history: [...project.history, { type: 'evidence-note-added', evidenceId: evidence.id, principal: principalRecord(principal), stage: project.stage, at: stamp() }],
      };
    }, { semantic: false });
  }

  async requestEvidence(projectId, request, context = {}) {
    const principal = assertPrincipal(context.principal);
    if (!this.evidenceProviders) throw new Error('No trusted evidence providers are configured');
    const snapshot = await this.store.read(projectId);
    const receipt = await this.evidenceProviders.execute(snapshot, request, { principal, signal: context.signal });
    assertTrustedEvidenceReceipt(receipt);
    return this.store.update(projectId, (project) => {
      if (project.evidence.some((item) => item.id === receipt.id)) throw new TypeError(`Duplicate evidence id: ${receipt.id}`);
      validateEvidence(receipt);
      validateRuntimeSchema('evidence', receipt);
      return {
        ...project,
        evidence: [...project.evidence, receipt],
        research: receipt.type === 'research-source' ? [...project.research, receipt.id] : project.research,
        history: [...project.history, { type: 'trusted-evidence-issued', evidenceId: receipt.id, providerId: receipt.method.providerId, requestedBy: principalRecord(principal), stage: project.stage, at: stamp() }],
      };
    }, { expectedRevision: snapshot.revision, semantic: false });
  }

  reviewArtifact(projectId, artifactId, input, context = {}) {
    const principal = assertPrincipal(context.principal);
    return this.store.update(projectId, (project) => {
      let found = false;
      const artifacts = project.artifacts.map((artifact) => {
        if (artifact.id !== artifactId) return artifact;
        found = true;
        return markArtifactReviewed(artifact, { principal, notes: input.notes, now: stamp() });
      });
      if (!found) throw new TypeError(`Unknown artifact: ${artifactId}`);
      const runId=artifacts.find((item)=>item.id===artifactId)?.producedBy?.skillRunId??null;
      const skillRuns=runId?project.skillRuns.map((run)=>run.id===runId&&run.status==='running'?{...run,lastAcceptedSemanticRevision:project.semanticRevision+1}:run):project.skillRuns;
      return { ...project, artifacts, skillRuns, history: [...project.history, { type: 'artifact-reviewed', artifactId, principal: principalRecord(principal), at: stamp() }] };
    });
  }

  verifyArtifact(projectId, artifactId, input, context = {}) {
    const principal = assertPrincipal(context.principal);
    return this.store.update(projectId, (project) => {
      const artifact = project.artifacts.find((item) => item.id === artifactId);
      if (!artifact) throw new TypeError(`Unknown artifact: ${artifactId}`);
      const evidenceIds = Array.isArray(input.evidence) ? input.evidence : [];
      for (const evidenceId of evidenceIds) {
        const evidence = project.evidence.find((item) => item.id === evidenceId);
        if (!evidence || !evidenceAppliesTo(evidence, project) || evidence.subject?.artifactId !== artifactId || evidence.subject?.artifactSha256 !== artifact.sha256) {
          throw new Error(`Evidence ${evidenceId} does not prove the current artifact`);
        }
      }
      if (!evidenceIds.length) throw new Error('Artifact verification requires evidence');
      if (input.gateId) {
        const gate = project.gates.find((item) => item.id === input.gateId);
        if (!gate) throw new Error(`Unknown gate: ${input.gateId}`);
        if (gate.status !== 'pass' || gate.evaluatedSemanticRevision !== project.semanticRevision || gate.inputSha256 !== semanticInputSha256(project)) {
          throw new Error(`Gate ${input.gateId} is not a fresh passing gate`);
        }
      }
      const artifacts = project.artifacts.map((item) => item.id === artifactId
        ? markArtifactVerified(item, { principal, evidence: evidenceIds, gateId: input.gateId ?? null, requireReview: project.assurance !== 'A0', now: stamp() })
        : item);
      const runId=artifacts.find((item)=>item.id===artifactId)?.producedBy?.skillRunId??null;
      const skillRuns=runId?project.skillRuns.map((run)=>run.id===runId&&run.status==='running'?{...run,lastAcceptedSemanticRevision:project.semanticRevision+1}:run):project.skillRuns;
      return { ...project, artifacts, skillRuns, history: [...project.history, { type: 'artifact-verified', artifactId, principal: principalRecord(principal), at: stamp() }] };
    });
  }

  supersedeArtifact(projectId, artifactId, input, context = {}) {
    const principal = context.principal ?? SYSTEM_PRINCIPAL;
    assertPrincipal(principal);
    return this.store.update(projectId, (project) => {
      const current = project.artifacts.find((item) => item.id === artifactId);
      if (!current) throw new TypeError(`Unknown artifact: ${artifactId}`);
      if (input.type && input.type !== current.type) throw new TypeError('Superseding artifact must keep the same type');
      if (input.id && project.artifacts.some((item) => item.id === input.id)) throw new TypeError(`Duplicate artifact id: ${input.id}`);
      const consumes = input.consumes ?? current.consumes ?? [];
      const byId = new Map(project.artifacts.map((item) => [item.id, item]));
      const dependencyHashes = {};
      for (const dependencyId of consumes) {
        const dependency = byId.get(dependencyId);
        if (!dependency || !['draft','review','verified'].includes(dependency.state)) throw new TypeError(`Artifact has missing dependency: ${dependencyId}`);
        dependencyHashes[dependencyId] = dependency.contentHash;
      }
      const replacement = createArtifact({ ...input, type: current.type, slot: current.slot, consumes, dependencyHashes, supersedes: current.id, projectId }, { id: input.id, now: stamp(), principal, version: current.version + 1 });
      let artifacts = project.artifacts.map((item) => item.id === artifactId ? markArtifactSuperseded(item, replacement.id, stamp()) : item);
      artifacts = invalidateDownstream(artifacts, [artifactId], `Upstream artifact ${artifactId} was superseded`, stamp());
      artifacts.push(replacement);
      buildArtifactGraph(artifacts);
      return { ...project, artifacts, history: [...project.history, { type: 'artifact-superseded', artifactId, replacementId: replacement.id, principal: principalRecord(principal), at: stamp() }] };
    });
  }

  saveIdeas(projectId, inputs, context = {}) {
    const principal = context.principal ?? SYSTEM_PRINCIPAL;
    assertPrincipal(principal);
    if (!Array.isArray(inputs) || inputs.length > 100) throw new TypeError('ideas must be an array of at most 100 items');
    const ideas = inputs.map(validateIdea);
    if (new Set(ideas.map((idea) => idea.id)).size !== ideas.length) throw new TypeError('idea IDs must be unique');
    return this.store.update(projectId, (project) => ({
      ...project,
      ideas,
      scores: [],
      selectedIdeaId: null,
      selectionReason: null,
      artifacts: project.artifacts.map((artifact) => ['draft','review','verified'].includes(artifact.state)
        ? markArtifactInvalidated(artifact, 'Candidate ideas were replaced', [], stamp())
        : artifact),
      history: [...project.history, { type: 'ideas-saved', count: ideas.length, principal: principalRecord(principal), at: stamp() }],
    }));
  }

  scoreIdeas(projectId, vectors, context = {}) {
    const principal = assertPrincipal(context.principal);
    if (!Array.isArray(vectors)) throw new TypeError('score vectors must be an array');
    return this.store.update(projectId, (project) => {
      const ideaIds = project.ideas.map((idea) => idea.id);
      const vectorIds = vectors.map((vector) => vector.ideaId);
      if (vectors.length !== ideaIds.length || new Set(vectorIds).size !== vectorIds.length || ideaIds.some((ideaId) => !vectorIds.includes(ideaId))) {
        throw new TypeError('Every current idea must be scored exactly once');
      }
      const byId = new Map(project.ideas.map((idea) => [idea.id, idea]));
      const scores = rankIdeas(vectors.map((vector) => {
        const idea = byId.get(vector.ideaId);
        if (!idea) throw new TypeError(`Unknown idea: ${vector.ideaId}`);
        return scoreIdea(idea, vector, { principal, rubricVersion: context.rubricVersion });
      }));
      return { ...project, scores, history: [...project.history, { type: 'ideas-scored', evaluator: principalRecord(principal), rubricVersion: context.rubricVersion ?? 'creativity-v1', at: stamp() }] };
    });
  }

  selectIdea(projectId, ideaId, reason, context = {}) {
    const principal = assertPrincipal(context.principal, { type: 'human', scope: 'approve' });
    return this.store.update(projectId, (project) => {
      if (project.stage !== 'selection') throw new Error('Idea selection is only allowed in the selection stage');
      const idea = project.ideas.find((item) => item.id === ideaId);
      if (!idea) throw new TypeError(`Unknown idea: ${ideaId}`);
      if (!project.scores.some((score) => score.ideaId === ideaId && score.ideaSha256 === idea.sha256)) throw new Error('Selected idea must have a current verified score');
      const selectionReason = cleanText(reason, 'Selection reason');
      const consumed = consumeApproval(project, { action: `select-idea:${ideaId}`, token: context.approvalToken, principal });
      const actor = principalRecord(principal);
      return {
        ...project,
        pendingApprovals: consumed.pendingApprovals,
        selectedIdeaId: ideaId,
        selectionReason,
        decisions: [...project.decisions, { id: id('decision'), type: 'idea-selection', value: ideaId, ideaSha256: idea.sha256, reason: selectionReason, decidedBy: actor, approvalId: consumed.approval.id, at: stamp() }],
        history: [...project.history, { type: 'idea-selected', ideaId, principal: actor, approvalId: consumed.approval.id, at: stamp() }],
      };
    });
  }

  async routeNextSkills(projectId, { tools = [], activeSkills = [], targets = null, skillChannel = 'candidate', principal = SYSTEM_PRINCIPAL } = {}) {
    assertPrincipal(principal);
    const project = await this.getProject(projectId, { principal });
    const artifactTypes = projectArtifactTypes(project);
    const routeTargets = targets ?? targetArtifacts(project);
    const context = {
      stage: project.stage,
      domain: project.domain,
      assurance: project.assurance,
      artifacts: [...artifactTypes],
      facts: { 'intent.confirmed': project.intent?.confirmed === true },
      tools,
      activeSkills,
      targets: routeTargets,
      findings: project.findings,
      risks: project.risks,
      utility: project.skillUtility,
      skillChannel,
    };
    const routes = routeSkills(await loadSkillCatalog(), context, { limit: 8 })
      .map(({ name, score, reasons, produces, consumes }) => ({ name, score, reasons, produces, consumes }));
    const routeRecord = { stage: project.stage, semanticRevision: project.semanticRevision, targets: routeTargets, tools: [...new Set(tools)].sort(), routes, at: stamp() };
    await this.store.update(projectId, (current) => {
      const previous = current.routes.at(-1);
      const duplicate = previous && JSON.stringify({ ...previous, at: null }) === JSON.stringify({ ...routeRecord, at: null });
      return {
        ...current,
        routes: duplicate ? current.routes : [...current.routes.slice(-49), routeRecord],
        history: duplicate ? current.history : [...current.history.slice(-499), { type: 'skills-routed', count: routes.length, targets: routeTargets, principal: principalRecord(principal), at: stamp() }],
      };
    }, { semantic: false });
    return routes;
  }

  async startSkillRun(projectId, skillName, context = {}) {
    const principal = assertPrincipal(context.principal, { scope: 'skill:run' });
    const catalog = await loadSkillCatalog();
    const skill = catalog.find((item) => item.name === skillName);
    if (!skill) throw new TypeError(`Unknown skill: ${skillName}`);
    let created;
    const project = await this.store.update(projectId, (current) => {
      const types = projectArtifactTypes(current);
      const requiredTools = skill.contract.requiredTools ?? [];
      const tools = new Set(context.tools ?? []);
      if (!skill.contract.stages.includes(current.stage)) throw new Error(`Skill ${skillName} is not valid in stage ${current.stage}`);
      if (!skill.contract.assurance.includes(current.assurance)) throw new Error(`Skill ${skillName} does not support assurance ${current.assurance}`);
      if (!(skill.contract.domains.includes('all') || current.domain === 'all' || skill.contract.domains.includes(current.domain))) throw new Error(`Skill ${skillName} does not support domain ${current.domain}`);
      if (!skill.contract.consumes.every((input) => types.has(input))) throw new Error(`Skill ${skillName} is missing required input artifacts`);
      if (!requiredTools.every((tool) => tools.has(tool))) throw new Error(`Skill ${skillName} is missing required tools`);
      if (skill.contract.status === 'quarantined' || skill.contract.status === 'deprecated') throw new Error(`Skill ${skillName} cannot be executed`);
      const expectedOutputs = context.targetOutputs?.length ? [...new Set(context.targetOutputs)] : [...skill.contract.produces];
      if (expectedOutputs.some((output) => !skill.contract.produces.includes(output))) throw new Error('Skill run target is not produced by the selected skill');
      const activeRuns=current.skillRuns.filter((run)=>run.status==='running');
      const explicitConflicts=new Set(skill.contract.conflicts??[]);
      const conflict=activeRuns.find((run)=>explicitConflicts.has(run.skill)||(run.contractSnapshot?.conflicts??[]).includes(skillName)||run.expectedOutputs.some((output)=>expectedOutputs.includes(output)));
      if(conflict)throw new Error(`Skill run conflicts with active skill run ${conflict.id}`);
      const contractSnapshot={version:skill.contract.version,consumes:[...skill.contract.consumes],produces:[...skill.contract.produces],requiredTools:[...(skill.contract.requiredTools??[])],conflicts:[...(skill.contract.conflicts??[])],invalidates:[...(skill.contract.invalidates??[])],gate:structuredClone(skill.contract.gate),handoff:structuredClone(skill.contract.handoff)};
      const contractSha256=canonicalSha256(skill.contract);
      const inputBindings = skill.contract.consumes.flatMap((type) => current.artifacts
        .filter((artifact) => artifact.type === type && ACTIVE_ARTIFACT_STATES.has(artifact.state))
        .map((artifact) => ({ type, artifactId: artifact.id, sha256: artifact.sha256 })));
      created = {
        id: id('run'), skill: skillName, skillVersion: skill.contract.version, status: 'running', principal: principalRecord(principal),
        stage: current.stage, domain: current.domain, assurance: current.assurance, startedRevision: current.revision,
        startedSemanticRevision: current.semanticRevision, lastAcceptedSemanticRevision: current.semanticRevision,
        inputBindings, virtualInputs: skill.contract.consumes.filter((type) => !inputBindings.some((binding) => binding.type === type)),
        expectedOutputs, contractSnapshot, contractSha256, tools: [...tools].sort(), outputCandidateIds: [], artifactIds: [], handoff:null, verificationEvidenceId:null, startedAt: stamp(), completedAt: null, failure: null,
      };
      return { ...current, skillRuns: [...current.skillRuns, created], history: [...current.history, { type: 'skill-run-started', runId: created.id, skill: skillName, principal: principalRecord(principal), at: stamp() }] };
    }, { semantic: false });
    return { project, run: created };
  }

  async completeSkillRun(projectId, runId, input, context = {}) {
    const principal = assertPrincipal(context.principal, { scope: 'skill:run' });
    let completed;
    const project = await this.store.update(projectId, (current) => {
      const run = current.skillRuns.find((item) => item.id === runId);
      if (!run || run.status !== 'running') throw new Error(`Unknown or inactive skill run: ${runId}`);
      if (run.principal.id !== principal.id) throw new Error('Only the leased skill-run principal may complete the run');
      if (current.semanticRevision !== run.lastAcceptedSemanticRevision) throw new Error('Skill run is stale for the current semantic revision');
      const artifactIds = [...new Set(input.artifactIds ?? [])];
      if (!artifactIds.length) throw new Error('Skill run completion requires output artifacts');
      const artifacts = artifactIds.map((artifactId) => current.artifacts.find((artifact) => artifact.id === artifactId));
      if (artifacts.some((artifact) => !artifact)) throw new Error('Skill run references an unknown output artifact');
      if (artifactIds.some((artifactId) => !run.outputCandidateIds.includes(artifactId))) throw new Error('Artifact was not published by this skill run');
      if (artifacts.some((artifact) => artifact.producedBy?.skill !== run.skill || artifact.producedBy?.principalId !== principal.id || artifact.producedBy?.skillRunId !== run.id)) throw new Error('Output artifact provenance does not match the skill run');
      for (const output of run.expectedOutputs) if (!artifacts.some((artifact) => artifact.type === output)) throw new Error(`Skill run is missing contracted output ${output}`);
      if(input.metrics!=null)throw new Error('Skill workers cannot self-report utility metrics; apply a trusted evaluation receipt instead');
      if(!input.verificationEvidenceId)throw new Error('Skill run completion requires a trusted verification receipt');
      const verificationEvidenceId=cleanText(input.verificationEvidenceId,'Skill-run verification evidence');
      const verification=current.evidence.find((item)=>item.id===verificationEvidenceId);
      if(!verification||verification.type!=='skill-run-verification'||!evidenceAppliesTo(verification,current)||verification.subject?.skillRunId!==run.id)throw new Error('Skill run completion requires a current trusted verification receipt');
      const claims=verification.metadata?.claims??{};
      const accepted=[...(claims.acceptedArtifactIds??[])].sort();
      if(claims.contractSha256!==run.contractSha256||accepted.length!==artifactIds.length||artifactIds.slice().sort().some((item,index)=>item!==accepted[index])||claims.handoff?.validationState!=='verified')throw new Error('Skill-run verification receipt does not match the frozen contract and accepted outputs');
      const handoff={...structuredClone(claims.handoff),artifactIds:[...artifactIds],verificationEvidenceId};
      completed = { ...run, status: 'completed', artifactIds, handoff, verificationEvidenceId, metrics:null, completedAt: stamp() };
      return { ...current, skillRuns: current.skillRuns.map((item) => item.id === runId ? completed : item), history: [...current.history, { type: 'skill-run-completed', runId, artifactIds, verificationEvidenceId, principal: principalRecord(principal), at: stamp() }] };
    }, { semantic: false });
    return { project, run: completed };
  }

  async failSkillRun(projectId, runId, reason, context = {}) {
    const principal = assertPrincipal(context.principal, { scope: 'skill:run' });
    let failed;
    const project = await this.store.update(projectId, (current) => {
      const run = current.skillRuns.find((item) => item.id === runId);
      if (!run || run.status !== 'running') throw new Error(`Unknown or inactive skill run: ${runId}`);
      if (run.principal.id !== principal.id) throw new Error('Only the leased skill-run principal may fail the run');
      failed = { ...run, status: 'failed', failure: cleanText(reason, 'Failure reason'), completedAt: stamp() };
      return { ...current, skillRuns: current.skillRuns.map((item) => item.id === runId ? failed : item), history: [...current.history, { type: 'skill-run-failed', runId, principal: principalRecord(principal), at: stamp() }] };
    }, { semantic: false });
    return { project, run: failed };
  }

  async applySkillEvaluation(projectId, skillName, runId, context = {}) {
    const principal=assertPrincipal(context.principal,{role:'eval-admin',scope:'eval:apply'});
    if(!this.evalRunStore)throw new Error('Trusted EvalRun store is not configured');
    if(typeof runId!=='string')throw new TypeError('Trusted EvalRun id is required');
    const evalRun=await this.evalRunStore.read(runId);
    if(evalRun.skillName!==skillName)throw new Error('EvalRun skill does not match the requested skill');
    return this.store.update(projectId,(project)=>{
      const current=project.skillUtility[skillName];
      if(current?.evaluationRuns?.includes(evalRun.sha256))throw new Error('EvalRun was already applied to this project');
      const next=recordSkillUtility(project.skillUtility,{skill:skillName,success:evalRun.decision.decision==='promote',qualityDelta:evalRun.comparison.delta.quality,tokenDelta:evalRun.comparison.delta.tokens,evaluationRunSha256:evalRun.sha256});
      next[skillName].evaluationRuns=[...new Set([...(next[skillName].evaluationRuns??[]),evalRun.sha256])].slice(-100);
      return {...project,skillUtility:next,history:[...project.history,{type:'skill-evaluation-applied',skill:skillName,evalRunId:evalRun.id,evalRunSha256:evalRun.sha256,decision:evalRun.decision.decision,principal:principalRecord(principal),at:stamp()}]};
    },{semantic:false});
  }

  addFinding(projectId, input, context = {}) {
    assertSafeValue(input);
    const principal = context.principal ?? SYSTEM_PRINCIPAL;
    assertPrincipal(principal);
    const severity = ['low','medium','high','critical'].includes(input.severity) ? input.severity : 'medium';
    const finding = { id: input.id ?? id('finding'), title: cleanText(input.title, 'Finding title'), category: cleanText(input.category ?? 'quality', 'Finding category'), severity, status: 'open', description: String(input.description ?? '').trim(), createdAt: stamp(), openedBy: principalRecord(principal), resolution: null, evidence: [], acceptedBy: null, closedBy: null };
    return this.store.update(projectId, (project) => {
      if (project.findings.some((item) => item.id === finding.id)) throw new TypeError(`Duplicate finding id: ${finding.id}`);
      return { ...project, findings: [...project.findings, finding], history: [...project.history, { type: 'finding-opened', findingId: finding.id, severity, principal: principalRecord(principal), at: stamp() }] };
    });
  }

  closeFinding(projectId, findingId, input, context = {}) {
    const principal = assertPrincipal(context.principal);
    return this.store.update(projectId, (project) => {
      const target = project.findings.find((finding) => finding.id === findingId);
      if (!target) throw new TypeError(`Unknown finding: ${findingId}`);
      const actor = principalRecord(principal);
      if (target.openedBy?.id === actor.id || target.openedBy?.trustDomain === actor.trustDomain) throw new Error('Finding closer must be independent from the finding opener');
      if (target.severity === 'critical' || (target.severity === 'high' && target.category === 'security')) {
        if (principal.type !== 'human' || !principal.roles.includes('security-reviewer')) throw new Error('Critical security findings require an independent human security-reviewer');
      }
      const evidenceIds = Array.isArray(input.evidence) ? [...new Set(input.evidence)] : [];
      if (!evidenceIds.length) throw new Error('Closing a finding requires evidence');
      for (const evidenceId of evidenceIds) {
        const evidence = project.evidence.find((item) => item.id === evidenceId);
        if (!evidence || !evidenceAppliesTo(evidence, project) || evidence.subject?.findingId !== findingId) {
          throw new Error(`Evidence ${evidenceId} does not prove the current finding`);
        }
        if (evidence.producer?.trustDomain === target.openedBy?.trustDomain) throw new Error('Finding evidence must be issued by an independent trust domain');
      }
      const findings = project.findings.map((finding) => finding.id === findingId
        ? { ...finding, status: 'closed', resolution: cleanText(input.resolution, 'Resolution'), evidence: evidenceIds, closedAt: stamp(), closedBy: actor }
        : finding);
      return { ...project, findings, history: [...project.history, { type: 'finding-closed', findingId, principal: actor, evidence: evidenceIds, at: stamp() }] };
    });
  }

  acceptFinding(projectId, findingId, input, context = {}) {
    const principal = assertPrincipal(context.principal, { type: 'human', scope: 'approve' });
    return this.store.update(projectId, (project) => {
      const target = project.findings.find((finding) => finding.id === findingId);
      if (!target) throw new TypeError(`Unknown finding: ${findingId}`);
      const consumed = consumeApproval(project, { action: `accept-finding:${findingId}`, token: input.approvalToken, principal });
      const actor = principalRecord(principal);
      const findings = project.findings.map((finding) => finding.id === findingId
        ? { ...finding, status: 'accepted', acceptedBy: actor, approvalId: consumed.approval.id, resolution: cleanText(input.reason, 'Acceptance reason'), acceptedAt: stamp() }
        : finding);
      return { ...project, pendingApprovals: consumed.pendingApprovals, findings, history: [...project.history, { type: 'finding-accepted', findingId, principal: actor, approvalId: consumed.approval.id, at: stamp() }] };
    });
  }

  async runCurrentGate(projectId, context = {}) {
    const principal = context.principal ?? SYSTEM_PRINCIPAL;
    assertPrincipal(principal);
    const updated = await this.store.update(projectId, (current) => {
      const result = runGate(current, current.stage);
      return { ...current, gates: [...current.gates, result], history: [...current.history, { type: 'gate-run', stage: current.stage, status: result.status, principal: principalRecord(principal), at: stamp() }] };
    }, { semantic: false });
    return [...updated.gates].reverse().find((gate) => gate.stage === updated.stage);
  }

  advance(projectId, context = {}) {
    const principal = context.principal ?? SYSTEM_PRINCIPAL;
    assertPrincipal(principal);
    return this.store.update(projectId, (project) => {
      const gate = [...project.gates].reverse().find((item) => item.stage === project.stage);
      if (!gate || gate.status !== 'pass') throw new Error('Current stage gate must pass before advancing');
      if (gate.evaluatedSemanticRevision !== project.semanticRevision || gate.inputSha256 !== semanticInputSha256(project)) {
        throw new Error('Current stage gate is stale for the current semantic revision');
      }
      const target = nextStage(project.stage);
      if (!target) throw new Error('Project is already released');
      assertTransition(project.stage, target);
      const released = target === 'released';
      return { ...project, stage: target, sealedAt: released ? stamp() : project.sealedAt, releaseRevision: released ? project.revision + 1 : project.releaseRevision, history: [...project.history, { type: 'stage-advanced', from: project.stage, to: target, principal: principalRecord(principal), at: stamp() }] };
    });
  }

  async nextAction(projectId, { tools = [], activeSkills = [], skillChannel = 'candidate', principal = SYSTEM_PRINCIPAL } = {}) {
    assertPrincipal(principal);
    const project = await this.getProject(projectId, { principal });
    const gate = currentGatePreview(project);
    const targets = targetArtifacts(project);
    const available = [...projectArtifactTypes(project)];
    const catalog = await loadSkillCatalog();
    const routes = await this.routeNextSkills(projectId, { tools, activeSkills, targets, skillChannel, principal });
    let plan = null;
    if (targets[0]) {
      try { plan = planToArtifact(catalog, targets[0], available, { domain: project.domain, assurance: project.assurance }); }
      catch (error) { plan = { target: targets[0], error: error.message, steps: [] }; }
    }
    return { projectId, stage: project.stage, targets, routes, plan, latestGate: gate };
  }
}
