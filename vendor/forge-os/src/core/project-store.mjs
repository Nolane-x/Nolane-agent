import { createProjectAccess } from './project-access.mjs';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, open } from 'node:fs/promises';
import path from 'node:path';
import { validateProjectId } from './contracts.mjs';
import { ASSURANCE_LEVELS, DOMAIN_PACKS } from './constants.mjs';
import { assertSafeValue, assertNoSecrets } from './security.mjs';
import { migrateProject } from './migrations.mjs';
import { validateProjectAggregate } from './project-validator.mjs';
import { validateRuntimeSchema } from './runtime-schemas.mjs';
import { canonicalSha256 } from './canonical-json.mjs';
import { initializeAudit, appendAuditEvent } from './audit-chain.mjs';
import { acquireFileLease } from '../storage/file-lease.mjs';

const now = () => new Date().toISOString();
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export class RevisionConflictError extends Error {
  constructor(expected, actual) {
    super(`Project revision conflict: expected ${expected}, found ${actual}`);
    this.name = 'RevisionConflictError';
    this.expected = expected;
    this.actual = actual;
  }
}

export class ProjectStore {
  #root;
  #locks = new Map();
  #diagnostics = [];
  #lockTimeoutMs;
  #snapshotLimit;
  #leaseMs;
  #heartbeatMs;

  constructor(root, { lockTimeoutMs = 10_000, snapshotLimit = 8, leaseMs = 15_000, heartbeatMs = Math.max(250, Math.floor(leaseMs / 3)) } = {}) {
    this.#root = path.resolve(root);
    this.#lockTimeoutMs = lockTimeoutMs;
    this.#snapshotLimit = snapshotLimit;
    this.#leaseMs = leaseMs;
    this.#heartbeatMs = heartbeatMs;
  }

  diagnostics() { return structuredClone(this.#diagnostics); }
  async #ensure() { await mkdir(this.#root, { recursive: true }); }
  #file(id) { validateProjectId(id); return path.join(this.#root, `${id}.json`); }
  #lockDir(id) { return path.join(this.#root, '.locks', `${id}.lock`); }

  async #syncDirectory(directory) {
    let handle;
    try {
      handle = await open(directory, 'r');
      await handle.sync();
    } catch (error) {
      if (!['EINVAL','EPERM','EISDIR'].includes(error.code)) throw error;
    } finally {
      await handle?.close();
    }
  }

  async #atomicWrite(file, value, options = {}) { return this.#atomicJsonWrite(file, value, { validateProject: true, ...options }); }

  async #acquireProcessLock(id) {
    return acquireFileLease(this.#lockDir(id), { acquireTimeoutMs: this.#lockTimeoutMs, leaseMs: this.#leaseMs, heartbeatMs: this.#heartbeatMs });
  }

  async #snapshot(project) {
    if (this.#snapshotLimit <= 0) return;
    const directory = path.join(this.#root, '.snapshots', project.id);
    await mkdir(directory, { recursive: true });
    const file = path.join(directory, `${String(project.revision).padStart(12, '0')}.json`);
    const wrapper = { revision: project.revision, projectSha256: canonicalSha256(project), createdAt: now(), project };
    await this.#atomicJsonWrite(file, wrapper, { validateProject: false });
    const files = (await readdir(directory)).filter((name) => name.endsWith('.json')).sort();
    await Promise.all(files.slice(0, Math.max(0, files.length - this.#snapshotLimit)).map((name) => rm(path.join(directory, name), { force: true })));
  }

  async #atomicJsonWrite(file, value, { validateProject = true, beforeCommit = null } = {}) {
    assertSafeValue(value);
    assertNoSecrets(value);
    if (validateProject) { validateRuntimeSchema('project', value); validateProjectAggregate(value); }
    await mkdir(path.dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
    let handle;
    try {
      handle = await open(temp, 'wx', 0o600);
      await handle.writeFile(`${JSON.stringify(value, null, 2)}
`, 'utf8');
      await handle.sync();
      await handle.close(); handle = null;
      if (beforeCommit) await beforeCommit();
      await rename(temp, file);
      await this.#syncDirectory(path.dirname(file));
    } catch (error) {
      await handle?.close().catch(() => {});
      await rm(temp, { force: true }).catch(() => {});
      throw error;
    }
  }

  async create({ name = 'Untitled project', domain = 'all', assurance = 'A1', metadata = {}, principal = null } = {}) {
    assertSafeValue(metadata);
    assertNoSecrets(metadata);
    if (domain !== 'all' && !DOMAIN_PACKS.includes(domain)) throw new TypeError(`Unknown domain: ${domain}`);
    if (!ASSURANCE_LEVELS.includes(assurance)) throw new TypeError(`Unknown assurance level: ${assurance}`);
    const id = `forge_${randomUUID().replaceAll('-', '').slice(0, 20)}`;
    const timestamp = now();
    const project = {
      schemaVersion: 5,
      revision: 1,
      semanticRevision: 1,
      id,
      name: String(name).trim().slice(0, 300) || 'Untitled project',
      domain,
      assurance,
      stage: 'intent',
      createdAt: timestamp,
      updatedAt: timestamp,
      access: createProjectAccess(principal ?? undefined),
      metadata: structuredClone(metadata),
      intent: null,
      brief: null,
      research: [],
      ideas: [],
      scores: [],
      selectedIdeaId: null,
      selectionReason: null,
      decisions: [],
      artifacts: [],
      evidence: [],
      gates: [],
      findings: [],
      risks: [],
      routes: [],
      skillUtility: {},
      skillRuns: [],
      pendingApprovals: [],
      sealedAt: null,
      releaseRevision: null,
      history: [{ type: 'project-created', stage: 'intent', at: timestamp }],
      audit: null,
    };
    project.audit = initializeAudit(project, { type: 'project-created', at: timestamp });
    await this.#atomicWrite(this.#file(id), project);
    return structuredClone(project);
  }

  async #readValidated(id) {
    const raw = JSON.parse(await readFile(this.#file(id), 'utf8'));
    const migrated = migrateProject(raw);
    validateRuntimeSchema('project', migrated);
    validateProjectAggregate(migrated);
    return migrated;
  }

  async read(id) { return structuredClone(await this.#readValidated(id)); }

  async update(id, updater, { expectedRevision = null, semantic = true, allowReleased = false } = {}) {
    validateProjectId(id);
    const previous = this.#locks.get(id) ?? Promise.resolve();
    let releaseQueue;
    const current = new Promise((resolve) => { releaseQueue = resolve; });
    const tail = previous.catch(() => {}).then(() => current);
    this.#locks.set(id, tail);
    await previous.catch(() => {});
    const lease = await this.#acquireProcessLock(id);
    try {
      const project = await this.#readValidated(id);
      if (expectedRevision !== null && project.revision !== expectedRevision) throw new RevisionConflictError(expectedRevision, project.revision);
      if (project.stage === 'released' && !allowReleased) throw new Error('Released projects are sealed and cannot be mutated');
      const next = await updater(structuredClone(project));
      if (!next || typeof next !== 'object' || next.id !== id) throw new TypeError('Project updater must return the same project');
      await this.#snapshot(project);
      const timestamp = now();
      next.schemaVersion = 5;
      next.revision = project.revision + 1;
      next.semanticRevision = project.semanticRevision + (semantic ? 1 : 0);
      next.createdAt = project.createdAt;
      next.updatedAt = timestamp;
      if (semantic) {
        next.gates = (next.gates ?? []).map((gate) => gate.status === 'pass' && gate.evaluatedSemanticRevision !== next.semanticRevision
          ? { ...gate, status: 'stale', staleAt: timestamp, staleReason: 'project-semantic-revision-changed' }
          : gate);
      }
      next.audit = appendAuditEvent(next, { type: semantic ? 'project-semantic-update' : 'project-operational-update', at: timestamp, metadata: { previousRevision: project.revision } });
      await this.#atomicWrite(this.#file(id), next, { beforeCommit: () => lease.assertOwned() });
      return structuredClone(next);
    } finally {
      await lease.release();
      releaseQueue();
      if (this.#locks.get(id) === tail) this.#locks.delete(id);
    }
  }

  async list() {
    await this.#ensure();
    this.#diagnostics = [];
    const files = (await readdir(this.#root)).filter((file) => /^forge_[A-Za-z0-9_-]+\.json$/.test(file));
    const projects = [];
    for (const file of files) {
      try {
        projects.push(await this.#readValidated(file.slice(0, -5)));
      } catch (error) {
        this.#diagnostics.push({ file, code: 'corrupt-project', message: error.message, observedAt: now() });
      }
    }
    return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async listSnapshots(id) {
    validateProjectId(id);
    const directory=path.join(this.#root,'.snapshots',id);
    let files=[];try{files=(await readdir(directory)).filter((name)=>name.endsWith('.json')).sort();}catch(error){if(error.code!=='ENOENT')throw error;}
    const result=[];
    for(const name of files){
      try{const wrapper=JSON.parse(await readFile(path.join(directory,name),'utf8'));result.push({revision:wrapper.revision,projectSha256:wrapper.projectSha256,createdAt:wrapper.createdAt});}catch(error){result.push({revision:Number.parseInt(name,10),valid:false,error:error.message});}
    }
    return result;
  }

  async verifySnapshot(id, revision) {
    validateProjectId(id);
    const file=path.join(this.#root,'.snapshots',id,`${String(revision).padStart(12,'0')}.json`);
    const wrapper=JSON.parse(await readFile(file,'utf8'));
    const actual=canonicalSha256(wrapper.project);
    return {valid:actual===wrapper.projectSha256,revision:wrapper.revision,expectedSha256:wrapper.projectSha256,actualSha256:actual};
  }

  async restoreSnapshot(id, revision, { expectedRevision = null, transform = null } = {}) {
    validateProjectId(id);
    const file=path.join(this.#root,'.snapshots',id,`${String(revision).padStart(12,'0')}.json`);
    const wrapper=JSON.parse(await readFile(file,'utf8'));
    if(canonicalSha256(wrapper.project)!==wrapper.projectSha256)throw new Error('Snapshot checksum mismatch');
    return this.update(id,(current)=>{
      const restored=structuredClone(wrapper.project);
      restored.id=current.id;
      restored.createdAt=current.createdAt;
      restored.access=structuredClone(current.access);
      restored.pendingApprovals=structuredClone(current.pendingApprovals);
      restored.audit=current.audit;
      if(transform) Object.assign(restored,transform(structuredClone(current),structuredClone(restored))??restored);
      restored.history=[...(restored.history??[]),{type:'snapshot-restored',fromRevision:revision,previousRevision:current.revision,at:now()}];
      restored.sealedAt=null;restored.releaseRevision=null;
      return restored;
    },{expectedRevision,semantic:true,allowReleased:true});
  }

  async exportBundle(id) {
    const project = await this.read(id);
    const content = `${JSON.stringify(project, null, 2)}\n`;
    return {
      projectId: id,
      fileName: `${id}.forge.json`,
      mimeType: 'application/vnd.forgeos.project+json',
      sha256: createHash('sha256').update(content).digest('hex'),
      revision: project.revision,
      content,
    };
  }
}
