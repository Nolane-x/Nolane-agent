import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { canonicalSha256 } from '../core/canonical-json.mjs';
import { loadSkillCatalog } from '../skills/catalog.mjs';
import { createPrincipal, principalRecord, assertPrincipal } from '../core/principals.mjs';

const TRUSTED_RECEIPT = Symbol('forgeos.trusted-evidence-receipt');
const MAX_OUTPUT_BYTES = 1_000_000;
const now = () => new Date().toISOString();

function processGroupExists(child) {
  if (!child?.pid) return false;
  if (process.platform === 'win32') return child.exitCode === null;
  try { process.kill(-child.pid, 0); return true; }
  catch { return false; }
}
async function terminateProcessGroup(child) {
  const signal = (name) => {
    try {
      if (process.platform !== 'win32' && child?.pid) process.kill(-child.pid, name);
      else if (child?.exitCode === null) child.kill(name);
    } catch {}
  };
  if (!processGroupExists(child)) return;
  signal('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 100));
  if (processGroupExists(child)) signal('SIGKILL');
}

function clean(value, label, max = 300) {
  const result = String(value ?? '').trim();
  if (!result || result.length > max) throw new TypeError(`${label} is invalid`);
  return result;
}
function normalizeSubject(project, request) {
  const source = request.subject ?? {};
  const artifact = source.artifactId ? project.artifacts.find((item) => item.id === source.artifactId) : null;
  if (source.artifactId && !artifact) throw new TypeError(`Unknown artifact: ${source.artifactId}`);
  if (source.artifactSha256 && artifact?.sha256 !== source.artifactSha256) throw new TypeError('Evidence subject artifact hash is stale');
  const finding = source.findingId ? project.findings.find((item) => item.id === source.findingId) : null;
  if (source.findingId && !finding) throw new TypeError(`Unknown finding: ${source.findingId}`);
  const skillRun = source.skillRunId ? project.skillRuns.find((item) => item.id === source.skillRunId) : null;
  if (source.skillRunId && !skillRun) throw new TypeError(`Unknown skill run: ${source.skillRunId}`);
  return {
    projectId: project.id,
    revision: project.revision,
    semanticRevision: project.semanticRevision,
    artifactId: artifact?.id ?? null,
    artifactSha256: artifact?.sha256 ?? null,
    findingId: finding?.id ?? null,
    skillRunId: skillRun?.id ?? null,
    sourceCommit: source.sourceCommit ?? null,
  };
}
function appendBounded(chunks, chunk, state) {
  const buffer = Buffer.from(chunk);
  const remaining = MAX_OUTPUT_BYTES - state.bytes;
  if (remaining <= 0) { state.truncated = true; return; }
  chunks.push(buffer.subarray(0, remaining));
  state.bytes += Math.min(buffer.byteLength, remaining);
  if (buffer.byteLength > remaining) state.truncated = true;
}

export class CommandEvidenceProvider {
  constructor({ id, version = '1.0.0', recipes = {}, cwd = process.cwd(), timeoutMs = 30_000 } = {}) {
    this.id = clean(id, 'provider.id', 100);
    this.version = clean(version, 'provider.version', 40);
    this.recipes = structuredClone(recipes);
    this.cwd = cwd;
    this.timeoutMs = timeoutMs;
    this.principal = createPrincipal({
      id: `evidence-provider:${this.id}`,
      type: 'service',
      roles: ['evidence-provider'],
      scopes: ['evidence:issue'],
      trustDomain: `evidence-provider:${this.id}`,
    });
  }
  async execute({ request, signal }) {
    const recipeId = clean(request.recipeId, 'recipeId', 100);
    const recipe = this.recipes[recipeId];
    if (!recipe) throw new TypeError(`Unknown evidence recipe: ${recipeId}`);
    if (!Array.isArray(recipe.evidenceTypes) || !recipe.evidenceTypes.includes(request.type)) {
      throw new Error(`Provider recipe ${recipeId} is not authorized for evidence type ${request.type}`);
    }
    if (!Array.isArray(recipe.command) || recipe.command.length < 1) throw new TypeError(`Recipe ${recipeId} has no command`);
    const [command, ...args] = recipe.command.map(String);
    const startedAt = now();
    const stdout = []; const stderr = [];
    const outState = { bytes: 0, truncated: false }; const errState = { bytes: 0, truncated: false };
    let child;
    let result;
    try {
      result = await new Promise((resolve, reject) => {
      try {
        child = spawn(command, args, {
          cwd: recipe.cwd ?? this.cwd,
          shell: false,
          windowsHide: true,
          detached: process.platform !== 'win32',
          env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', TMPDIR: process.env.TMPDIR ?? '/tmp', NODE_ENV: 'test', ...(recipe.env ?? {}) },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        const timer = setTimeout(() => { void terminateProcessGroup(child); }, recipe.timeoutMs ?? this.timeoutMs);
        timer.unref?.();
        const abort = () => { void terminateProcessGroup(child); };
        if (signal?.aborted) abort();
        else signal?.addEventListener('abort', abort, { once: true });
        child.stdout.on('data', (chunk) => appendBounded(stdout, chunk, outState));
        child.stderr.on('data', (chunk) => appendBounded(stderr, chunk, errState));
        child.once('error', (error) => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(error); });
        child.once('close', (exitCode, signalName) => {
          clearTimeout(timer); signal?.removeEventListener('abort', abort);
          resolve({ exitCode, signal: signalName });
        });
        } catch (error) { reject(error); }
      });
    } finally {
      await terminateProcessGroup(child);
    }
    const completedAt = now();
    const payload = {
      providerId: this.id,
      providerVersion: this.version,
      recipeId,
      commandSha256: canonicalSha256({ command, args, cwd: recipe.cwd ?? this.cwd }),
      exitCode: result.exitCode,
      signal: result.signal,
      stdout: Buffer.concat(stdout).toString('utf8'),
      stderr: Buffer.concat(stderr).toString('utf8'),
      stdoutTruncated: outState.truncated,
      stderrTruncated: errState.truncated,
      startedAt,
      completedAt,
    };
    return {
      status: result.exitCode === 0 ? 'pass' : 'fail',
      summary: result.exitCode === 0 ? `Trusted recipe ${recipeId} completed successfully.` : `Trusted recipe ${recipeId} failed with exit code ${result.exitCode}.`,
      payload,
      method: { kind: 'command-test', providerId: this.id, providerVersion: this.version, recipeId, exitCode: result.exitCode, signal: result.signal },
    };
  }
}


const OUTPUT_STATE_RANK = Object.freeze({draft:0,review:1,verified:2});
const assuranceOutputState = (level) => level === 'A0' ? 'draft' : level === 'A1' ? 'review' : 'verified';
const sameSet = (left,right) => left.length===right.length && [...left].sort().every((item,index)=>item===[...right].sort()[index]);

export class SkillRunEvidenceProvider {
  constructor({id='skill-run-inspector',version='1.0.0'}={}) {
    this.id=clean(id,'provider.id',100);
    this.version=clean(version,'provider.version',40);
    this.principal=createPrincipal({id:`evidence-provider:${this.id}`,type:'service',roles:['evidence-provider','skill-run-inspector'],scopes:['evidence:issue'],trustDomain:`evidence-provider:${this.id}`});
  }
  async execute({project,request}) {
    if(request.type!=='skill-run-verification')throw new Error(`${this.id} only issues skill-run-verification evidence`);
    const run=project.skillRuns.find((item)=>item.id===request.subject?.skillRunId);
    if(!run||run.status!=='running')throw new Error('Skill run is not active');
    const skill=(await loadSkillCatalog()).find((item)=>item.name===run.skill);
    if(!skill)throw new Error(`Unknown skill contract: ${run.skill}`);
    const contractSha256=canonicalSha256(skill.contract);
    const accepted=[...new Set(request.metadata?.acceptedArtifactIds??[])];
    const failures=[];
    if(!accepted.length)failures.push('No accepted output artifacts were supplied');
    if(accepted.some((artifactId)=>!run.outputCandidateIds.includes(artifactId)))failures.push('Accepted output is not a candidate from this run');
    const artifacts=accepted.map((artifactId)=>project.artifacts.find((item)=>item.id===artifactId)).filter(Boolean);
    if(artifacts.length!==accepted.length)failures.push('Accepted output artifact is missing');
    if(artifacts.some((artifact)=>artifact.producedBy?.skill!==run.skill||artifact.producedBy?.principalId!==run.principal.id||artifact.producedBy?.skillRunId!==run.id))failures.push('Output provenance is not bound to this run');
    for(const output of run.expectedOutputs)if(!artifacts.some((artifact)=>artifact.type===output))failures.push(`Missing contracted output ${output}`);
    const requiredState=assuranceOutputState(project.assurance);
    if(artifacts.some((artifact)=>(OUTPUT_STATE_RANK[artifact.state]??-1)<OUTPUT_STATE_RANK[requiredState]))failures.push(`Output state does not satisfy ${project.assurance} (${requiredState})`);
    if(project.assurance!=='A0'&&artifacts.some((artifact)=>!artifact.review?.reviewer||artifact.review.reviewer.trustDomain===artifact.producedBy.trustDomain))failures.push('Independent artifact review is missing');
    const packet=new Set(artifacts.flatMap((artifact)=>Array.isArray(artifact.content?.evidencePacket)?artifact.content.evidencePacket:[]));
    const requiredEvidence=[...(skill.contract.handoff?.requiredEvidence??[])];
    for(const item of requiredEvidence){
      if(item==='contract-validation')continue;
      if(item==='independent-review'&&project.assurance!=='A0')continue;
      if(!packet.has(item))failures.push(`Evidence packet is missing ${item}`);
    }
    const handoff={
      artifactId:accepted[0]??null,artifactIds:accepted,schemaVersion:artifacts[0]?.schemaVersion??null,sha256:artifacts[0]?.sha256??null,
      producingSkill:run.skill,producingAgent:run.principal.id,consumedArtifacts:[...new Set(artifacts.flatMap((artifact)=>artifact.consumes??[]))],
      decisionIds:[...new Set(artifacts.flatMap((artifact)=>artifact.decisions??[]))],evidenceIds:[...new Set(artifacts.flatMap((artifact)=>artifact.evidence??[]))],
      residualRisks:[...new Set(artifacts.flatMap((artifact)=>artifact.residualRisks??[]))],validationState:failures.length?'failed':'verified',
      invalidationTargets:[...(skill.contract.invalidates??[])],stopCondition:skill.contract.handoff?.stopWhen??null,
    };
    for(const field of skill.contract.handoff?.requiredFields??[])if(!(field in handoff))failures.push(`Handoff field ${field} cannot be produced`);
    const claims={skillRunId:run.id,skill:run.skill,contractSha256,acceptedArtifactIds:accepted,requiredEvidence,requiredFields:[...(skill.contract.handoff?.requiredFields??[])],handoff:{...handoff,validationState:failures.length?'failed':'verified'},failures};
    return {status:failures.length?'fail':'pass',summary:failures.length?`Skill run contract failed: ${failures.join('; ')}`:'Skill run outputs satisfy the frozen contract and assurance policy.',payload:{claims},claims,method:{kind:'skill-contract-inspection',providerId:this.id,providerVersion:this.version}};
  }
}

export class EvidenceProviderRegistry {
  #providers = new Map();
  constructor({ blobStore } = {}) {
    if (!blobStore) throw new TypeError('EvidenceProviderRegistry requires a BlobStore');
    this.blobStore = blobStore;
  }
  register(provider) {
    if (!provider?.id || typeof provider.execute !== 'function' || !provider.principal) throw new TypeError('Invalid evidence provider');
    if (this.#providers.has(provider.id)) throw new TypeError(`Duplicate evidence provider: ${provider.id}`);
    this.#providers.set(provider.id, provider);
    return this;
  }
  list() { return [...this.#providers.values()].map((provider) => ({ id: provider.id, version: provider.version, principal: principalRecord(provider.principal) })); }
  async execute(project, request, { principal, signal } = {}) {
    const requestedBy = assertPrincipal(principal);
    const provider = this.#providers.get(clean(request.providerId, 'providerId', 100));
    if (!provider) throw new TypeError(`Unknown evidence provider: ${request.providerId}`);
    const subject = normalizeSubject(project, request);
    const executionId = `evidence_run_${randomUUID().replaceAll('-', '')}`;
    const output = await provider.execute({ project: structuredClone(project), request: structuredClone(request), requestedBy, signal });
    if (!['pass','fail','inconclusive'].includes(output.status)) throw new Error(`Provider ${provider.id} returned an invalid status`);
    const requestEnvelope={type:request.type,title:request.title,subject,metadata:structuredClone(request.metadata??{})};
    const claims=structuredClone(output.claims??{});
    const blob = await this.blobStore.put({ executionId, request:requestEnvelope, output: output.payload }, { mimeType: 'application/vnd.forgeos.evidence+json' });
    const completedAt = now();
    const receiptCore = {
      executionId,
      trusted: true,
      providerId: provider.id,
      providerVersion: provider.version,
      payloadSha256: blob.sha256,
      requestSha256: canonicalSha256(requestEnvelope),
      claimsSha256: canonicalSha256(claims),
      requestedBy: principalRecord(requestedBy),
      issuedBy: principalRecord(provider.principal),
      completedAt,
    };
    const evidence = {
      id: request.id ?? `evidence_${randomUUID().replaceAll('-', '').slice(0, 20)}`,
      type: clean(request.type, 'evidence.type', 100),
      title: clean(request.title, 'evidence.title', 300),
      status: output.status,
      summary: output.summary,
      uri: blob.uri,
      sha256: blob.sha256,
      subject,
      producer: principalRecord(provider.principal),
      requestedBy: principalRecord(requestedBy),
      method: output.method,
      receipt: { ...receiptCore, receiptSha256: canonicalSha256(receiptCore) },
      metadata: { request: structuredClone(request.metadata ?? {}), claims },
      createdAt: completedAt,
    };
    Object.defineProperty(evidence, TRUSTED_RECEIPT, { value: true, enumerable: false });
    return evidence;
  }
}

export function assertTrustedEvidenceReceipt(value) {
  if (!value || value[TRUSTED_RECEIPT] !== true || value.receipt?.trusted !== true) throw new Error('Passing evidence must be issued by a trusted provider');
  return value;
}
