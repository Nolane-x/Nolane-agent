import { getSkill } from '../skills/catalog.mjs';
import { FEDERATION_SCHEMAS } from '../federation/schemas.mjs';
import { SKILL_INTELLIGENCE_SCHEMAS } from '../intelligence/schemas.mjs';
import { V06_SCHEMAS } from '../v06/schemas.mjs';

const string = (options = {}) => ({ type: 'string', ...options });
const id = string({ minLength: 3, maxLength: 100, pattern: '^[A-Za-z0-9][A-Za-z0-9_-]*$' });
const text = string({ minLength: 1, maxLength: 10_000 });
const shortText = string({ minLength: 1, maxLength: 400 });
const sha256 = string({ pattern: '^[a-fA-F0-9]{64}$' });
const array = (items, options = {}) => ({ type: 'array', items, ...options });
const object = (properties = {}, required = [], options = {}) => ({ type: 'object', properties, required, additionalProperties: false, ...options });
const freeObject = { type: 'object', additionalProperties: true };
const schemaBody = (schema) => { const value = structuredClone(schema); delete value.$schema; delete value.$id; return value; };
const federationSourceOutput = schemaBody(FEDERATION_SCHEMAS.federationSource);
const federationCapabilityOutput = schemaBody(FEDERATION_SCHEMAS.capability);
const federationProviderOutput = schemaBody(FEDERATION_SCHEMAS.provider);
const federationBundleOutput = schemaBody(FEDERATION_SCHEMAS.executionBundle);
const federationContextPackOutput = schemaBody(FEDERATION_SCHEMAS.contextPack);
const federationSyncOutput = schemaBody(FEDERATION_SCHEMAS.syncResult);
const federationMcpReceiptOutput = schemaBody(FEDERATION_SCHEMAS.mcpExecutionReceipt);
const skillIntakeSourceInput=object({sourceId:shortText,sourceCoordinate:string({minLength:8,maxLength:1000}),snapshotSha256:sha256,license:shortText,permissions:array(shortText,{maxItems:32})},['sourceId','sourceCoordinate','snapshotSha256','license']);
const skillIntakeFileInput=object({path:string({minLength:1,maxLength:2000}),content:string({minLength:1,maxLength:1000000})},['path','content']);
const intelligenceRoutePlanOutput=schemaBody(SKILL_INTELLIGENCE_SCHEMAS.routePlan);
const intelligenceSkillOutput=schemaBody(SKILL_INTELLIGENCE_SCHEMAS.skillInspection);
const intelligenceSkillContextOutput=schemaBody(SKILL_INTELLIGENCE_SCHEMAS.skillContextPack);
const intelligenceContextOutput=schemaBody(SKILL_INTELLIGENCE_SCHEMAS.compiledContext);
const intelligenceScopeOutput=schemaBody(SKILL_INTELLIGENCE_SCHEMAS.scope);
const intelligenceEvalOutput=schemaBody(SKILL_INTELLIGENCE_SCHEMAS.evaluationManifest);
const intelligenceStatusOutput=schemaBody(SKILL_INTELLIGENCE_SCHEMAS.status);
const universalLaneOutput=object({id:string({pattern:'^[a-z0-9][a-z0-9-]{2,79}$'}),title:string({minLength:1,maxLength:120}),summary:string({minLength:1,maxLength:500}),capabilityDomains:array(shortText,{minItems:1}),skillIds:array(shortText,{minItems:1}),externalSourceIds:array(shortText,{minItems:1}),executionBoundary:{enum:['advisory-only','verified-artifact','human-approved-executor']}},['id','title','summary','capabilityDomains','skillIds','externalSourceIds','executionBoundary']);
const universalLaneRegistryOutput=object({schemaVersion:{const:1},registrySha256:sha256,lanes:array(universalLaneOutput,{minItems:1,maxItems:32})},['schemaVersion','registrySha256','lanes']);
const v06StatusOutput=schemaBody(V06_SCHEMAS.status);
const v06ExecutionGraphOutput=schemaBody(V06_SCHEMAS.executionGraph);
const v06ReviewScopeOutput=schemaBody(V06_SCHEMAS.reviewScope);
const v06WorkUnitContextsOutput=schemaBody(V06_SCHEMAS.workUnitContexts);
const v06HarnessPlanOutput=schemaBody(V06_SCHEMAS.harnessPlan);
const v06SecurityReportOutput=schemaBody(V06_SCHEMAS.securityReport);
const federationAuditOutput = object({
  sourceCount:{type:'integer',minimum:0},capabilityCount:{type:'integer',minimum:0},providerCount:{type:'integer',minimum:0},
  builtInProviderCount:{type:'integer',minimum:0},externalProviderCount:{type:'integer',minimum:0},proceduralProviderCount:{type:'integer',minimum:0},knowledgeProviderCount:{type:'integer',minimum:0},
  statusCounts:{type:'object',additionalProperties:{type:'integer',minimum:0}},catalogRevision:{type:'integer',minimum:0},blockerCount:{type:'integer',minimum:0},
},['sourceCount','capabilityCount','providerCount','builtInProviderCount','externalProviderCount','proceduralProviderCount','knowledgeProviderCount','statusCounts','catalogRevision','blockerCount']);
const principalOutput = object({ id: id, type: { enum: ['human','agent','service','system'] }, roles: array(string(), { maxItems: 32 }), trustDomain: shortText }, ['id','type','roles','trustDomain']);
const projectOutput = object({
  id, name: shortText, domain: shortText, assurance: { enum: ['A0','A1','A2','A3','A4'] },
  stage: { type: 'string' }, revision: { type: 'integer', minimum: 1 }, semanticRevision: { type: 'integer', minimum: 1 },
  updatedAt: string({ format: 'date-time' }), artifactCount: { type: 'integer', minimum: 0 }, evidenceCount: { type: 'integer', minimum: 0 }, findingCount: { type: 'integer', minimum: 0 },
}, ['id','name','domain','assurance','stage','revision','semanticRevision'], { additionalProperties: true });
const projectResult = object({ project: projectOutput }, ['project']);
const toolErrorOutput = object({ error: object({ code: string(), message: string(), requestId: string() }, ['code','message','requestId']) }, ['error']);
const evidenceSubject = object({ artifactId: id, artifactSha256: sha256, findingId: id, sourceCommit: string({ maxLength: 128 }) }, []);

function tool({ name, title, description, inputSchema, outputSchema, readOnly = false, destructive = false, idempotent = false, openWorld = false, humanOnly = false }) {
  return Object.freeze({
    name, title, description, inputSchema, outputSchema,
    annotations: { readOnlyHint: readOnly, destructiveHint: destructive, idempotentHint: idempotent, openWorldHint: openWorld },
    _meta: { 'forgeos/humanOnly': humanOnly },
  });
}

const ideaSchema = object({
  id, title: shortText, thesis: text, targetUser: text, hiddenProblem: text, mechanism: text, trigger:text, incentive:text, ownership:text, timing:text,
  interface: text, valueModel: text, distribution: text, assumptions: array(text, { minItems: 1, maxItems: 100 }),
  closestPattern: text, differences: array(text, { minItems: 1, maxItems: 100 }), cheapestExperiment: text,
  failureModes: array(text, { minItems: 1, maxItems: 100 }),
}, ['id','title','thesis','targetUser','hiddenProblem','mechanism','interface','valueModel','distribution','assumptions','closestPattern','differences','cheapestExperiment','failureModes']);
const federationProviderInput = object({
  providerId:shortText, capabilityId:shortText, sourceId:shortText, sourceCoordinate:string({minLength:8,maxLength:2000}), contentDigest:sha256,
  kind:{enum:['skill','knowledge','mcp','composite']}, title:shortText,
  license:object({spdx:shortText,mode:shortText,ambiguous:{type:'boolean'}},['spdx','mode']),
  trust:object({score:{type:'number',minimum:0,maximum:100},blockers:array(shortText,{maxItems:100})},['score','blockers']),
  compatibility:object({agents:array(shortText,{maxItems:100}),tools:array(shortText,{maxItems:100})},['agents','tools']),
  riskClass:{enum:['low','medium','high','critical']}, material:freeObject,
},['providerId','capabilityId','sourceId','sourceCoordinate','contentDigest','kind','title','license','trust','compatibility']);
const mcpServerInput = object({name:shortText,publisherVerified:{type:'boolean'},remotes:array(object({url:string({format:'uri',maxLength:4000})},['url']),{maxItems:50}),tools:array(freeObject,{maxItems:500}),repository:freeObject},['name']);

const scoreSchema = object({
  ideaId: id, novelty: { type: 'number', minimum: 0, maximum: 100 }, usefulness: { type: 'number', minimum: 0, maximum: 100 },
  feasibility: { type: 'number', minimum: 0, maximum: 100 }, leverage: { type: 'number', minimum: 0, maximum: 100 },
  defensibility: { type: 'number', minimum: 0, maximum: 100 }, testability: { type: 'number', minimum: 0, maximum: 100 },
  clarity: { type: 'number', minimum: 0, maximum: 100 }, evidence: { type: 'number', minimum: 0, maximum: 100 },
}, ['ideaId','novelty','usefulness','feasibility','leverage','defensibility','testability','clarity','evidence']);

export const TOOL_DEFINITIONS = Object.freeze([
  tool({ name:'forge_project_create', title:'Create project', description:'Create a revisioned ForgeOS project.', inputSchema:object({ name:shortText, domain:shortText, assurance:{enum:['A0','A1','A2','A3','A4']}, metadata:freeObject }, ['name']), outputSchema:projectResult }),
  tool({ name:'forge_project_get', title:'Get project', description:'Read a project aggregate.', inputSchema:object({ projectId:id }, ['projectId']), outputSchema:projectResult, readOnly:true, idempotent:true }),
  tool({ name:'forge_project_list', title:'List projects', description:'List healthy projects and quarantined diagnostics.', inputSchema:object(), outputSchema:object({ projects:array(projectOutput), diagnostics:array(freeObject) }, ['projects']), readOnly:true, idempotent:true }),
  tool({ name:'forge_project_access_grant', title:'Grant project access', description:'Grant scoped project capabilities to a principal.', inputSchema:object({ projectId:id, principalId:shortText, trustDomain:shortText, capabilities:array({enum:['read','write','review','release','admin']},{minItems:1,maxItems:5}) }, ['projectId','principalId','trustDomain','capabilities']), outputSchema:projectResult, destructive:true }),
  tool({ name:'forge_project_export', title:'Export project', description:'Return a portable content-addressed export.', inputSchema:object({ projectId:id }, ['projectId']), outputSchema:object({ export:object({ projectId:id, fileName:string(), mimeType:string(), sha256, revision:{type:'integer',minimum:1}, content:string() }, ['projectId','fileName','mimeType','sha256','revision','content']) }, ['export']), readOnly:true, idempotent:true }),
  tool({ name:'forge_snapshot_list', title:'List snapshots', description:'List durable project snapshots available for recovery.', inputSchema:object({ projectId:id }, ['projectId']), outputSchema:object({ snapshots:array(freeObject) }, ['snapshots']), readOnly:true, idempotent:true }),
  tool({ name:'forge_snapshot_verify', title:'Verify snapshot', description:'Verify a snapshot checksum before recovery.', inputSchema:object({ projectId:id, revision:{type:'integer',minimum:1} }, ['projectId','revision']), outputSchema:object({ snapshot:freeObject }, ['snapshot']), readOnly:true, idempotent:true }),
  tool({ name:'forge_project_restore', title:'Restore project snapshot', description:'Restore a checksum-verified snapshot using a one-time human approval.', inputSchema:object({ projectId:id, revision:{type:'integer',minimum:1}, approvalToken:string({minLength:20,maxLength:300}) }, ['projectId','revision','approvalToken']), outputSchema:projectResult, destructive:true, humanOnly:true }),
  tool({ name:'forge_intent_record', title:'Record confirmed intent', description:'Record explicit intent and success criteria.', inputSchema:object({ projectId:id, intent:object({ goal:text, audience:text, constraints:array(text,{maxItems:200}), success:array(text,{minItems:1,maxItems:200}), nonGoals:array(text,{maxItems:200}), preferredDomain:shortText, confirmed:{const:true} }, ['goal','audience','success','confirmed']) }, ['projectId','intent']), outputSchema:projectResult }),
  tool({ name:'forge_approval_request', title:'Request human approval', description:'Issue a one-time approval capability bound to the authenticated human and current semantic revision.', inputSchema:object({ projectId:id, action:string({minLength:1,maxLength:300,pattern:'^[A-Za-z0-9:_-]+$'}), ttlMs:{type:'integer',minimum:1000,maximum:86400000} }, ['projectId','action']), outputSchema:object({ approval:object({ approvalId:id, action:string(), expiresAt:string({format:'date-time'}), semanticRevision:{type:'integer'}, token:string({minLength:20}) }, ['approvalId','action','expiresAt','semanticRevision','token']) }, ['approval']), humanOnly:true }),
  tool({ name:'forge_artifact_create', title:'Create artifact', description:'Create a typed immutable artifact version with authenticated provenance.', inputSchema:object({ projectId:id, id, type:shortText, schemaVersion:string({minLength:1,maxLength:40}), title:shortText, content:freeObject, consumes:array(id,{maxItems:200}), decisions:array(id,{maxItems:200}), residualRisks:array(id,{maxItems:200}), sourceIdeaId:id, sourceIdeaSha256:sha256, skillRunId:id }, ['projectId','type','content']), outputSchema:projectResult }),
  tool({ name:'forge_artifact_review', title:'Review artifact', description:'Move an artifact to review with an authenticated reviewer.', inputSchema:object({ projectId:id, artifactId:id, notes:text }, ['projectId','artifactId','notes']), outputSchema:projectResult }),
  tool({ name:'forge_artifact_verify', title:'Verify artifact', description:'Verify an artifact with passing subject-bound evidence.', inputSchema:object({ projectId:id, artifactId:id, evidence:array(id,{minItems:1,maxItems:200}), gateId:id }, ['projectId','artifactId','evidence']), outputSchema:projectResult }),
  tool({ name:'forge_artifact_supersede', title:'Supersede artifact', description:'Create a new artifact version and invalidate downstream dependents.', inputSchema:object({ projectId:id, artifactId:id, id, schemaVersion:string(), title:shortText, content:freeObject, consumes:array(id,{maxItems:200}), decisions:array(id,{maxItems:200}), residualRisks:array(id,{maxItems:200}) }, ['projectId','artifactId','content']), outputSchema:projectResult }),
  tool({ name:'forge_evidence_add', title:'Add unverified evidence note', description:'Record metadata that is explicitly unverified. Passing or failing proof must be issued by a trusted provider.', inputSchema:object({ projectId:id, id, type:shortText, title:shortText, summary:text, uri:string({format:'uri',maxLength:4000}), subject:evidenceSubject, metadata:freeObject }, ['projectId','type','title','summary']), outputSchema:projectResult }),
  tool({ name:'forge_evidence_request', title:'Request trusted evidence', description:'Ask an operator-configured provider to execute a verification recipe and issue a content-addressed receipt.', inputSchema:object({ projectId:id, id, providerId:shortText, recipeId:shortText, type:shortText, title:shortText, subject:evidenceSubject, metadata:freeObject }, ['projectId','providerId','recipeId','type','title']), outputSchema:projectResult, openWorld:true }),
  tool({ name:'forge_ideas_save', title:'Save idea genomes', description:'Persist mechanism-level candidate ideas and invalidate downstream work.', inputSchema:object({ projectId:id, ideas:array(ideaSchema,{minItems:1,maxItems:100}) }, ['projectId','ideas']), outputSchema:projectResult }),
  tool({ name:'forge_ideas_score', title:'Score ideas', description:'Record exactly one score vector per current idea.', inputSchema:object({ projectId:id, scores:array(scoreSchema,{minItems:1,maxItems:100}), rubricVersion:string({minLength:1,maxLength:80}) }, ['projectId','scores','rubricVersion']), outputSchema:projectResult }),
  tool({ name:'forge_idea_select', title:'Select idea', description:'Select a scored concept using a one-time human approval capability.', inputSchema:object({ projectId:id, ideaId:id, reason:text, approvalToken:string({minLength:20,maxLength:300}) }, ['projectId','ideaId','reason','approvalToken']), outputSchema:projectResult, destructive:true, humanOnly:true }),
  tool({ name:'forge_skills_route', title:'Route skills', description:'Plan a minimal typed path toward current gate targets.', inputSchema:object({ projectId:id, tools:array(shortText,{maxItems:100}), activeSkills:array(shortText,{maxItems:100}), targets:array(shortText,{maxItems:100}), skillChannel:{enum:['stable','candidate','all']} }, ['projectId']), outputSchema:object({ projectId:id, stage:string(), latestGate:freeObject, routes:array(freeObject), targets:array(shortText), plan:{anyOf:[freeObject,{type:'null'}]} }, ['projectId','stage','routes','targets','plan']) }),
  tool({ name:'forge_skill_get', title:'Get selected skill', description:'Load one selected skill instruction and machine-readable contract.', inputSchema:object({ name:shortText }, ['name']), outputSchema:object({ skill:object({ name:shortText, description:string(), body:string(), contract:freeObject }, ['name','description','body','contract']) }, ['skill']), readOnly:true, idempotent:true }),
  tool({ name:'forge_skill_run_start', title:'Start skill run', description:'Lease a skill to the authenticated principal with typed input bindings.', inputSchema:object({ projectId:id, skillName:shortText, tools:array(shortText,{maxItems:100}), targetOutputs:array(shortText,{maxItems:100}) }, ['projectId','skillName']), outputSchema:object({ project:projectOutput, run:freeObject }, ['project','run']) }),
  tool({ name:'forge_skill_run_complete', title:'Complete skill run', description:'Complete a leased skill run using artifacts produced by that run and a trusted run-bound verification receipt.', inputSchema:object({ projectId:id, runId:id, artifactIds:array(id,{minItems:1,maxItems:200}), verificationEvidenceId:id }, ['projectId','runId','artifactIds','verificationEvidenceId']), outputSchema:object({ project:projectOutput, run:freeObject }, ['project','run']) }),
  tool({ name:'forge_skill_run_fail', title:'Fail skill run', description:'Record an authenticated skill-run failure.', inputSchema:object({ projectId:id, runId:id, reason:text }, ['projectId','runId','reason']), outputSchema:object({ project:projectOutput, run:freeObject }, ['project','run']) }),
  tool({ name:'forge_gate_run', title:'Run current gate', description:'Evaluate the current semantic revision against assurance-aware rules.', inputSchema:object({ projectId:id }, ['projectId']), outputSchema:object({ projectId:id, gate:freeObject }, ['projectId','gate']) }),
  tool({ name:'forge_stage_advance', title:'Advance stage', description:'Advance exactly one stage using a fresh passing gate.', inputSchema:object({ projectId:id }, ['projectId']), outputSchema:projectResult }),
  tool({ name:'forge_finding_add', title:'Open finding', description:'Record a quality, security, reliability, UX, or cost finding.', inputSchema:object({ projectId:id, id, title:shortText, severity:{enum:['low','medium','high','critical']}, category:shortText, description:text }, ['projectId','title','severity','category']), outputSchema:projectResult }),
  tool({ name:'forge_finding_close', title:'Close finding', description:'Close a finding with passing evidence bound to the current finding and revision.', inputSchema:object({ projectId:id, findingId:id, resolution:text, evidence:array(id,{minItems:1,maxItems:200}) }, ['projectId','findingId','resolution','evidence']), outputSchema:projectResult }),
  tool({ name:'forge_finding_accept', title:'Accept residual finding', description:'Accept residual risk using a one-time human approval capability.', inputSchema:object({ projectId:id, findingId:id, reason:text, approvalToken:string({minLength:20,maxLength:300}) }, ['projectId','findingId','reason','approvalToken']), outputSchema:projectResult, destructive:true, humanOnly:true }),
  tool({ name:'forge_next_action', title:'Resolve next action', description:'Return current gate targets and a typed execution plan.', inputSchema:object({ projectId:id, tools:array(shortText,{maxItems:100}), activeSkills:array(shortText,{maxItems:100}), skillChannel:{enum:['stable','candidate','all']} }, ['projectId']), outputSchema:object({ projectId:id, stage:string(), latestGate:freeObject, routes:array(freeObject), targets:array(shortText), plan:{anyOf:[freeObject,{type:'null'}]} }, ['projectId','stage','routes','targets','plan']) }),
  tool({ name:'forge_v06_status', title:'Inspect deterministic fabric status', description:'Return v0.6 kernel, execution-graph, review benchmark, and agent-surface security status.', inputSchema:object(), outputSchema:object({status:v06StatusOutput},['status']), readOnly:true, idempotent:true }),
  tool({ name:'forge_execution_graph_compile', title:'Compile deterministic execution graph', description:'Compile one Skill Contract v2 hybrid execution program into a deterministic, agent, reflection, join, gate, retry, and rollback graph.', inputSchema:object({skillId:shortText,workUnits:array(object({unitId:shortText,files:array(string(),{minItems:1,maxItems:10000})},['unitId','files']),{minItems:1,maxItems:1000}),retryBudget:{type:'integer',minimum:0,maximum:10}},['skillId','workUnits']), outputSchema:object({graph:v06ExecutionGraphOutput},['graph']), readOnly:true, idempotent:true }),
  tool({ name:'forge_review_scope_compile', title:'Compile code-review scope', description:'Account for every changed file and produce an immutable deterministic review scope.', inputSchema:object({change:object({files:array(freeObject,{maxItems:10000})},['files']),policy:object({excludeGenerated:{type:'boolean'},excludeDeleted:{type:'boolean'}},[])},['change']), outputSchema:object({scope:v06ReviewScopeOutput},['scope']), readOnly:true, idempotent:true }),
  tool({ name:'forge_context_work_units_compile', title:'Compile isolated work-unit contexts', description:'Compile globally budgeted, isolated contexts per work unit and record every omission.', inputSchema:object({model:shortText,hardInputLimit:{type:'integer',minimum:128,maximum:1000000},outputReserve:{type:'integer',minimum:0,maximum:500000},safetyReserve:{type:'integer',minimum:0,maximum:500000},shared:freeObject,workUnits:array(freeObject,{minItems:1,maxItems:1000})},['hardInputLimit','workUnits']), outputSchema:object({contexts:v06WorkUnitContextsOutput},['contexts']), readOnly:true, idempotent:true }),
  tool({ name:'forge_harness_profile_plan', title:'Plan selective harness installation', description:'Compile a selective ForgeOS profile and permission diff without writing user files.', inputSchema:object({profile:{enum:['minimal','coding','creative','research','regulated','local-small','enterprise']},target:shortText,capabilities:freeObject},['profile','target']), outputSchema:object({plan:v06HarnessPlanOutput},['plan']), readOnly:true, idempotent:true }),
  tool({ name:'forge_agent_surface_scan', title:'Scan agent configuration surface', description:'Scan instructions, skills, hooks, MCP configuration, permissions, lifecycle scripts, environment references, and egress paths.', inputSchema:object({surface:freeObject},['surface']), outputSchema:object({report:v06SecurityReportOutput},['report']), readOnly:true, idempotent:true }),
  tool({ name:'forge_intelligence_status', title:'Inspect Skill Intelligence status', description:'Return Capability Graph v2, L0, evaluator, and procedural-provider inventory without loading skill bodies.', inputSchema:object(), outputSchema:object({status:intelligenceStatusOutput},['status']), readOnly:true, idempotent:true }),
  tool({ name:'forge_universal_lanes_list', title:'List Universal ForgeOS lanes', description:'List capability coverage lanes, native skills, upstream discovery sources, and execution boundaries. This does not trigger external actions or grant execution authority.', inputSchema:object(), outputSchema:object({registry:universalLaneRegistryOutput},['registry']), readOnly:true, idempotent:true }),
  tool({ name:'forge_intelligence_route', title:'Compile Skill Intelligence route', description:'Retrieve outcomes and techniques, apply hard policy and anti-triggers, compose the minimal DAG, and freeze an explainable RoutePlan.', inputSchema:object({query:shortText,domains:array(shortText,{maxItems:32}),taskClass:shortText,targetOutcomeIds:array(shortText,{maxItems:32}),maxOutcomes:{type:'integer',minimum:1,maximum:16},model:shortText,tools:array(shortText,{maxItems:100}),assurance:{enum:['A0','A1','A2','A3','A4']},allowExternal:{type:'boolean'},operation:{enum:['routine','planning','verification','novel']},routeBudgetTokens:{type:'integer',minimum:128,maximum:100000}},['query']), outputSchema:object({routePlan:intelligenceRoutePlanOutput},['routePlan']), readOnly:true, idempotent:true }),
  tool({ name:'forge_skill_v2_inspect', title:'Inspect Skill Contract v2', description:'Read manifest, section, policy, mapping, and evaluator metadata without loading instruction bodies.', inputSchema:object({skillId:shortText},['skillId']), outputSchema:object({skill:intelligenceSkillOutput},['skill']), readOnly:true, idempotent:true }),
  tool({ name:'forge_skill_v2_materialize', title:'Materialize stable skill sections', description:'Verify a stable Skill Contract v2 package and load only explicitly selected bounded sections.', inputSchema:object({skillId:shortText,sections:array(shortText,{minItems:1,maxItems:8}),model:shortText,hardTokens:{type:'integer',minimum:64,maximum:100000}},['skillId']), outputSchema:object({contextPack:intelligenceSkillContextOutput},['contextPack']), readOnly:true, idempotent:true }),
  tool({ name:'forge_context_compile', title:'Compile global agent context', description:'Enforce one total context budget across system, task, skill, code, artifact, memory, tool output, and references while recording every omission.', inputSchema:object({model:shortText,policy:object({modelContextLimit:{type:'integer',minimum:512},hardInputLimit:{type:'integer',minimum:256},outputReserve:{type:'integer',minimum:0},safetyReserve:{type:'integer',minimum:0},budgets:object({system:{type:'integer',minimum:0},task:{type:'integer',minimum:0},skills:{type:'integer',minimum:0},code:{type:'integer',minimum:0},artifacts:{type:'integer',minimum:0},memory:{type:'integer',minimum:0},toolOutput:{type:'integer',minimum:0},references:{type:'integer',minimum:0}},['system','task','skills','code','artifacts','memory','toolOutput','references'])},['modelContextLimit','hardInputLimit','outputReserve','safetyReserve','budgets']),inputs:object({system:array({anyOf:[string(),freeObject]},{maxItems:100}),task:array({anyOf:[string(),freeObject]},{maxItems:100}),skills:array({anyOf:[string(),freeObject]},{maxItems:100}),code:array({anyOf:[string(),freeObject]},{maxItems:1000}),artifacts:array({anyOf:[string(),freeObject]},{maxItems:500}),memory:array({anyOf:[string(),freeObject]},{maxItems:500}),toolOutput:array({anyOf:[string(),freeObject]},{maxItems:500}),references:array({anyOf:[string(),freeObject]},{maxItems:500})})},['model','policy','inputs']), outputSchema:object({context:intelligenceContextOutput},['context']), readOnly:true }),
  tool({ name:'forge_fabric_scope', title:'Compile deterministic work scope', description:'Deterministically include or exclude changed files and issue a scope hash before agent reasoning.', inputSchema:object({files:array(object({path:string({minLength:1,maxLength:2000}),sha256:sha256},['path','sha256']),{maxItems:10000}),include:array(string({minLength:1,maxLength:500}),{maxItems:100}),exclude:array(string({minLength:1,maxLength:500}),{maxItems:100})},['files']), outputSchema:object({scope:intelligenceScopeOutput},['scope']), readOnly:true, idempotent:true }),
  tool({ name:'forge_eval_v2_manifest', title:'Inspect trusted evaluation manifest', description:'Return public cases, baseline status, evaluator IDs, and holdout disclosure without exposing hidden prompts.', inputSchema:object({skillId:shortText},['skillId']), outputSchema:object({evaluation:intelligenceEvalOutput},['evaluation']), readOnly:true, idempotent:true }),
  tool({ name:'forge_federation_sources_list', title:'List federation sources', description:'List curated skill, knowledge, standards, and MCP discovery sources without fetching third-party bodies.', inputSchema:object({kind:shortText,authority:shortText}), outputSchema:object({sources:array(federationSourceOutput)},['sources']), readOnly:true, idempotent:true }),
  tool({ name:'forge_federation_sync_source', title:'Synchronize pinned skill source', description:'Fetch a supported GitHub skill repository at an immutable commit, import discovered skills into quarantine, and scan them without auto-promotion.', inputSchema:object({tenantId:shortText,sourceId:shortText},['tenantId','sourceId']), outputSchema:object({result:federationSyncOutput},['result']), destructive:true, humanOnly:true, openWorld:true }),
  tool({ name:'forge_capabilities_search', title:'Search capability graph', description:'Search the 1,024-node federated capability graph using metadata only.', inputSchema:object({query:shortText,domain:shortText,tools:array(shortText,{maxItems:100}),limit:{type:'integer',minimum:1,maximum:100}},['query']), outputSchema:object({capabilities:array(freeObject)},['capabilities']), readOnly:true, idempotent:true }),
  tool({ name:'forge_capability_get', title:'Get capability', description:'Read one typed capability contract without loading provider instructions.', inputSchema:object({capabilityId:shortText},['capabilityId']), outputSchema:object({capability:federationCapabilityOutput},['capability']), readOnly:true, idempotent:true }),
  tool({ name:'forge_providers_list', title:'List capability providers', description:'List imported providers and trust states.', inputSchema:object({tenantId:shortText,capabilityId:shortText,status:{enum:['discovered','quarantined','candidate','stable','revoked','expired']}},['tenantId']), outputSchema:object({providers:array(federationProviderOutput)},['providers']), readOnly:true, idempotent:true }),
  tool({ name:'forge_provider_import', title:'Import provider to quarantine', description:'Import a pinned provider record into quarantine; import never enables execution.', inputSchema:object({tenantId:shortText,provider:federationProviderInput},['tenantId','provider']), outputSchema:object({provider:federationProviderOutput},['provider']), destructive:true, humanOnly:true }),
  tool({ name:'forge_skill_intake', title:'Intake immutable skill bundle', description:'Scan one bounded immutable skill bundle and import it into quarantine without executing, fetching, or promoting it.', inputSchema:object({tenantId:shortText,providerId:shortText,capabilityId:shortText,title:shortText,compatibility:object({agents:array(shortText,{maxItems:100}),tools:array(shortText,{maxItems:100})},['agents','tools']),riskClass:{enum:['low','medium','high','critical']},source:skillIntakeSourceInput,files:array(skillIntakeFileInput,{minItems:1,maxItems:200})},['tenantId','providerId','capabilityId','title','compatibility','riskClass','source','files']), outputSchema:object({provider:federationProviderOutput,intake:freeObject},['provider','intake']), destructive:true, humanOnly:true }),
  tool({ name:'forge_provider_scan', title:'Scan provider', description:'Run static trust and prompt-injection checks against an imported provider.', inputSchema:object({tenantId:shortText,providerId:shortText},['tenantId','providerId']), outputSchema:object({provider:federationProviderOutput,scanReceipt:freeObject},['provider','scanReceipt']) }),
  tool({ name:'forge_provider_approval_request', title:'Request provider promotion approval', description:'Issue a one-time human approval bound to provider digest and target state.', inputSchema:object({tenantId:shortText,providerId:shortText,targetStatus:{enum:['candidate','stable']}},['tenantId','providerId','targetStatus']), outputSchema:object({approval:freeObject},['approval']), humanOnly:true }),
  tool({ name:'forge_provider_promote', title:'Promote provider', description:'Promote a provider only with current scan, evaluation, and one-time human approval.', inputSchema:object({tenantId:shortText,providerId:shortText,targetStatus:{enum:['candidate','stable']},approvalId:shortText,approvalToken:string({minLength:20,maxLength:300}),evaluationReceiptId:sha256},['tenantId','providerId','targetStatus','approvalId','approvalToken','evaluationReceiptId']), outputSchema:object({provider:federationProviderOutput},['provider']), destructive:true, humanOnly:true }),
  tool({ name:'forge_bundle_resolve', title:'Resolve capability bundle', description:'Compile a frozen execution bundle with the smallest compatible skill, knowledge, and MCP providers without loading instruction bodies or auto-enabling candidates.', inputSchema:object({tenantId:shortText,capabilityId:shortText,agent:shortText,tools:array(shortText,{maxItems:100}),allowExternal:{type:'boolean'},activeProviders:array(shortText,{maxItems:100}),assurance:{enum:['A0','A1','A2','A3','A4']}},['tenantId','capabilityId']), outputSchema:object({bundle:federationBundleOutput},['bundle']), readOnly:true, idempotent:true }),
  tool({ name:'forge_bundle_materialize', title:'Materialize execution bundle', description:'Verify a frozen bundle and load only its stable, bounded, safe skill text and knowledge references. Executables and remote bodies remain excluded.', inputSchema:object({tenantId:shortText,bundle:federationBundleOutput,maxBytes:{type:'integer',minimum:1,maximum:1000000}},['tenantId','bundle']), outputSchema:object({contextPack:federationContextPackOutput},['contextPack']), readOnly:true }),
  tool({ name:'forge_mcp_search', title:'Search official MCP Registry', description:'Search official MCP Registry metadata; results remain untrusted until assessed and promoted.', inputSchema:object({query:shortText,limit:{type:'integer',minimum:1,maximum:100},cursor:string({maxLength:2000})},['query']), outputSchema:object({result:freeObject},['result']), readOnly:true, idempotent:true, openWorld:true }),
  tool({ name:'forge_mcp_assess', title:'Assess MCP server', description:'Assess MCP transport, publisher, tools, and permissions without connecting to the server.', inputSchema:object({server:mcpServerInput,sourceAuthority:{enum:['official','vendor','community']}},['server']), outputSchema:object({assessment:freeObject},['assessment']), readOnly:true, idempotent:true }),
  tool({ name:'forge_mcp_execute', title:'Execute promoted MCP tool', description:'Execute one declared tool through the policy-enforced MCP broker. Stable provider and current scan are required.', inputSchema:object({tenantId:shortText,providerId:shortText,toolName:shortText,arguments:freeObject,credentialRef:string({maxLength:200})},['tenantId','providerId','toolName','arguments']), outputSchema:object({output:freeObject,receipt:federationMcpReceiptOutput},['output','receipt']), destructive:true, openWorld:true }),
  tool({ name:'forge_federation_audit', title:'Audit federation', description:'Return tenant-visible source, capability, provider, blocker, and catalog-revision statistics.', inputSchema:object({tenantId:shortText},['tenantId']), outputSchema:object({audit:federationAuditOutput},['audit']), readOnly:true, idempotent:true }),
].sort((a,b) => a.name.localeCompare(b.name)));

export const TOOL_BY_NAME = new Map(TOOL_DEFINITIONS.map((item) => [item.name, item]));

const TOOL_CAPABILITY = Object.freeze({
  forge_project_get:'read', forge_project_export:'read', forge_snapshot_list:'read', forge_snapshot_verify:'read',
  forge_skills_route:'write', forge_next_action:'write', forge_gate_run:'write',
  forge_artifact_review:'review', forge_artifact_verify:'review', forge_finding_close:'review',
  forge_stage_advance:'release', forge_finding_accept:'release',
  forge_project_access_grant:'admin', forge_project_restore:'admin',
});

export async function callForgeTool(name, args, forge, context = {}) {
  const principal = context.principal;
  if(name!=='forge_project_create'&&name!=='forge_project_list'&&name!=='forge_skill_get'&&args?.projectId){
    await forge.assertProjectAccess(args.projectId, principal, TOOL_CAPABILITY[name]??'write');
  }
  switch (name) {
    case 'forge_project_create': return { project: await forge.createProject(args,{principal}) };
    case 'forge_project_get': return { project: await forge.getProject(args.projectId,{principal}) };
    case 'forge_project_list': {
      const listed = await forge.listProjects({principal});
      return Array.isArray(listed) ? { projects: listed, diagnostics: listed.diagnostics ?? [] } : listed;
    }
    case 'forge_project_access_grant': return { project: await forge.grantProjectAccess(args.projectId,args,{principal}) };
    case 'forge_project_export': return { export: await forge.exportProject(args.projectId,{principal}) };
    case 'forge_snapshot_list': return { snapshots: await forge.listProjectSnapshots(args.projectId,{principal}) };
    case 'forge_snapshot_verify': return { snapshot: await forge.verifyProjectSnapshot(args.projectId,args.revision,{principal}) };
    case 'forge_project_restore': return { project: await forge.restoreProjectSnapshot(args.projectId,args.revision,args.approvalToken,{principal}) };
    case 'forge_intent_record': return { project: await forge.recordIntent(args.projectId, args.intent, { principal }) };
    case 'forge_approval_request': return { approval: await forge.requestApproval(args.projectId, args.action, { principal, ttlMs: args.ttlMs }) };
    case 'forge_artifact_create': return { project: await forge.saveArtifact(args.projectId, { ...args, projectId: undefined, skillRunId: undefined }, { principal, skillRunId: args.skillRunId }) };
    case 'forge_artifact_review': return { project: await forge.reviewArtifact(args.projectId, args.artifactId, { notes: args.notes }, { principal }) };
    case 'forge_artifact_verify': return { project: await forge.verifyArtifact(args.projectId, args.artifactId, { evidence: args.evidence, gateId: args.gateId }, { principal }) };
    case 'forge_artifact_supersede': return { project: await forge.supersedeArtifact(args.projectId, args.artifactId, { ...args, projectId: undefined, artifactId: undefined }, { principal }) };
    case 'forge_evidence_add': return { project: await forge.addEvidence(args.projectId, { ...args, projectId: undefined, status: 'unverified' }, { principal }) };
    case 'forge_evidence_request': return { project: await forge.requestEvidence(args.projectId, { ...args, projectId: undefined }, { principal, signal: context.signal }) };
    case 'forge_ideas_save': return { project: await forge.saveIdeas(args.projectId, args.ideas, { principal }) };
    case 'forge_ideas_score': return { project: await forge.scoreIdeas(args.projectId, args.scores, { principal, rubricVersion: args.rubricVersion }) };
    case 'forge_idea_select': return { project: await forge.selectIdea(args.projectId, args.ideaId, args.reason, { principal, approvalToken: args.approvalToken }) };
    case 'forge_skills_route': return await forge.nextAction(args.projectId, { ...args, principal });
    case 'forge_skill_get': {
      const selected = await getSkill(args.name);
      return { skill: { name: selected.name, description: selected.description, body: selected.body, contract: selected.contract } };
    }
    case 'forge_skill_run_start': return await forge.startSkillRun(args.projectId, args.skillName, { principal, tools: args.tools, targetOutputs: args.targetOutputs });
    case 'forge_skill_run_complete': return await forge.completeSkillRun(args.projectId, args.runId, { artifactIds: args.artifactIds, verificationEvidenceId: args.verificationEvidenceId }, { principal });
    case 'forge_skill_run_fail': return await forge.failSkillRun(args.projectId, args.runId, args.reason, { principal });
    case 'forge_gate_run': return { projectId: args.projectId, gate: await forge.runCurrentGate(args.projectId, { principal }) };
    case 'forge_stage_advance': return { project: await forge.advance(args.projectId, { principal }) };
    case 'forge_finding_add': return { project: await forge.addFinding(args.projectId, args, { principal }) };
    case 'forge_finding_close': return { project: await forge.closeFinding(args.projectId, args.findingId, args, { principal }) };
    case 'forge_finding_accept': return { project: await forge.acceptFinding(args.projectId, args.findingId, args, { principal }) };
    case 'forge_next_action': return await forge.nextAction(args.projectId, { ...args, principal });
    case 'forge_v06_status': return { status: await context.v06.status() };
    case 'forge_execution_graph_compile': return { graph: await context.v06.compileExecutionGraph(args) };
    case 'forge_review_scope_compile': return { scope: context.v06.compileReviewScope(args) };
    case 'forge_context_work_units_compile': return { contexts: await context.v06.compileWorkUnitContexts(args) };
    case 'forge_harness_profile_plan': return { plan: context.v06.compileHarnessProfile(args) };
    case 'forge_agent_surface_scan': return { report: context.v06.scanAgentSurface(args.surface) };
    case 'forge_intelligence_status': return { status: await context.intelligence.status() };
    case 'forge_universal_lanes_list': return { registry: await context.intelligence.universalLanes() };
    case 'forge_intelligence_route': return { routePlan: await context.intelligence.route(args) };
    case 'forge_skill_v2_inspect': return { skill: await context.intelligence.inspect(args.skillId) };
    case 'forge_skill_v2_materialize': return { contextPack: await context.intelligence.materialize(args) };
    case 'forge_context_compile': return { context: await context.intelligence.compileContext(args) };
    case 'forge_fabric_scope': return { scope: context.intelligence.scope(args) };
    case 'forge_eval_v2_manifest': return { evaluation: await context.intelligence.evaluationManifest(args.skillId) };
    case 'forge_federation_sources_list': return { sources: await context.federation.listSources(args) };
    case 'forge_federation_sync_source': return { result: await context.federation.syncSource(args.sourceId,{tenantId:args.tenantId},{principal}) };
    case 'forge_capabilities_search': return { capabilities: await context.federation.searchCapabilities(args) };
    case 'forge_capability_get': return { capability: await context.federation.getCapability(args.capabilityId) };
    case 'forge_providers_list': return { providers: await context.federation.listProviders(args,{principal}) };
    case 'forge_provider_import': return { provider: await context.federation.importProvider(args.provider,{principal,tenantId:args.tenantId}) };
    case 'forge_skill_intake': return await context.federation.intakeSkillBundle(args,{principal,tenantId:args.tenantId});
    case 'forge_provider_scan': return await context.federation.scanProvider(args.providerId,{tenantId:args.tenantId,principal});
    case 'forge_provider_approval_request': return await context.federation.requestProviderApproval(args,{principal});
    case 'forge_provider_promote': return { provider: await context.federation.promote(args,{principal}) };
    case 'forge_bundle_resolve': return { bundle: await context.federation.resolve(args,{principal}) };
    case 'forge_bundle_materialize': return { contextPack: await context.federation.materialize(args,{principal}) };
    case 'forge_mcp_search': return { result: await context.federation.searchMcp(args) };
    case 'forge_mcp_assess': return { assessment: context.federation.assessMcp(args.server,{sourceAuthority:args.sourceAuthority}) };
    case 'forge_mcp_execute': return await context.federation.executeMcp(args,{principal,signal:context.signal});
    case 'forge_federation_audit': return { audit: await context.federation.audit(args,{principal}) };
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

export { toolErrorOutput, principalOutput };
