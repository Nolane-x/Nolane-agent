import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { lstat, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { signed, safeLabel, safeRelativePath, TIME_TRAVEL_SCHEMAS } from './time-travel-schema.mjs';

const exec = promisify(execFile);
const SENSITIVE = /(?:^|\/)(?:\.env(?:\..*)?|credentials?(?:\..*)?|secrets?(?:\..*)?|id_[rd]sa|[^/]+\.(?:pem|key|p12|pfx))$/i;

function emptyState() { return { schema: TIME_TRAVEL_SCHEMAS.index, version: 1, checkpoints: [], actions: [] }; }
function hash(buffer) { return createHash('sha256').update(buffer).digest('hex'); }
function splitNul(value) { return String(value ?? '').split('\0').filter(Boolean); }
function bounded(value, fallback, min, max) { const n = Number(value); return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback; }

async function atomicJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, file);
}

async function runGit(root, args, maxBuffer = 16 * 1024 * 1024) {
  try {
    const result = await exec('git', args, { cwd: root, timeout: 120_000, maxBuffer, windowsHide: true, env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', SYSTEMROOT: process.env.SYSTEMROOT ?? '', GIT_TERMINAL_PROMPT: '0' } });
    return String(result.stdout ?? '');
  } catch (cause) {
    const error = Object.assign(new Error(`git ${args[0]} failed: ${String(cause?.stderr ?? cause?.message ?? cause).slice(0, 800)}`), { code: 'TIME_TRAVEL_GIT_FAILED', statusCode: 409, cause });
    throw error;
  }
}

export class CheckpointIndex {
  constructor({ dataDir, store, clock = () => new Date().toISOString(), maxFiles = 2_000, maxFileBytes = 5 * 1024 * 1024, maxTotalBytes = 100 * 1024 * 1024 } = {}) {
    if (!dataDir || !store?.getMission || !store?.listTasks) throw new TypeError('CheckpointIndex dataDir and store are required');
    this.root = path.resolve(dataDir, 'time-travel');
    this.file = path.join(this.root, 'checkpoint-index.json');
    this.blobRoot = path.join(this.root, 'blobs');
    this.store = store;
    this.clock = clock;
    this.limits = { maxFiles: bounded(maxFiles, 2_000, 1, 20_000), maxFileBytes: bounded(maxFileBytes, 5 * 1024 * 1024, 1_024, 100 * 1024 * 1024), maxTotalBytes: bounded(maxTotalBytes, 100 * 1024 * 1024, 1_024, 2 * 1024 * 1024 * 1024) };
    this.state = emptyState();
    this.ready = this.#load();
  }

  async #load() {
    try {
      const parsed = JSON.parse(await readFile(this.file, 'utf8'));
      if (parsed?.schema !== TIME_TRAVEL_SCHEMAS.index || Number(parsed.version) !== 1) throw new TypeError('Unsupported Time Travel index');
      this.state = { ...emptyState(), checkpoints: Array.isArray(parsed.checkpoints) ? parsed.checkpoints : [], actions: Array.isArray(parsed.actions) ? parsed.actions : [] };
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        try { await rename(this.file, `${this.file}.corrupt-${Date.now()}`); } catch {}
      }
      this.state = emptyState();
    }
  }

  async #persist() { await atomicJson(this.file, this.state); }
  async #blob(buffer) {
    const digest = hash(buffer); const target = path.join(this.blobRoot, digest.slice(0, 2), digest);
    try { await lstat(target); } catch { await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, buffer, { mode: 0o600 }); }
    return { sha256: digest, bytes: buffer.length };
  }

  async storeBlob(buffer) { await this.ready; return this.#blob(Buffer.from(buffer)); }

  async readBlob(sha256) {
    const digest = String(sha256 ?? '').toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(digest)) throw Object.assign(new TypeError('Invalid blob hash'), { code: 'TIME_TRAVEL_INVALID_BLOB', statusCode: 400 });
    return readFile(path.join(this.blobRoot, digest.slice(0, 2), digest));
  }

  async list({ missionId = null, projectId = null } = {}) {
    await this.ready;
    return this.state.checkpoints.filter((item) => (!missionId || item.missionId === String(missionId)) && (!projectId || item.projectId === String(projectId))).map((item) => structuredClone(item)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async get(checkpointId) {
    await this.ready;
    const record = this.state.checkpoints.find((item) => item.id === String(checkpointId));
    if (!record) throw Object.assign(new Error(`Unknown Time Travel checkpoint: ${checkpointId}`), { code: 'TIME_TRAVEL_CHECKPOINT_NOT_FOUND', statusCode: 404 });
    return structuredClone(record);
  }

  async create({ missionId, label = 'Checkpoint' } = {}) {
    await this.ready;
    const mission = this.store.getMission(String(missionId ?? ''));
    if (!mission) throw Object.assign(new Error(`Unknown mission: ${missionId}`), { code: 'TIME_TRAVEL_MISSION_NOT_FOUND', statusCode: 404 });
    const project = this.store.getProject(mission.projectId);
    if (!project) throw Object.assign(new Error(`Unknown project: ${mission.projectId}`), { code: 'TIME_TRAVEL_PROJECT_NOT_FOUND', statusCode: 404 });
    const repositoryRoot = path.resolve(project.workspaceRoot);
    const head = (await runGit(repositoryRoot, ['rev-parse', 'HEAD'])).trim();
    const branch = (await runGit(repositoryRoot, ['branch', '--show-current'])).trim() || null;
    const changed = new Set([
      ...splitNul(await runGit(repositoryRoot, ['diff', '--name-only', '-z', 'HEAD', '--', '.'])),
      ...splitNul(await runGit(repositoryRoot, ['diff', '--cached', '--name-only', '-z', 'HEAD', '--', '.'])),
      ...splitNul(await runGit(repositoryRoot, ['ls-files', '-o', '--exclude-standard', '-z'])),
    ].map(safeRelativePath));
    if (changed.size > this.limits.maxFiles) throw Object.assign(new Error(`Checkpoint contains ${changed.size} changed files; limit is ${this.limits.maxFiles}`), { code: 'TIME_TRAVEL_FILE_LIMIT', statusCode: 413 });
    const manifest = []; const excluded = []; let totalBytes = 0;
    for (const relative of [...changed].sort()) {
      if (SENSITIVE.test(relative)) { excluded.push({ path: relative, reason: 'sensitive-path' }); continue; }
      const absolute = path.resolve(repositoryRoot, relative);
      const lexical = path.relative(repositoryRoot, absolute);
      if (lexical.startsWith('..') || path.isAbsolute(lexical)) throw Object.assign(new Error('Checkpoint path escapes project'), { code: 'TIME_TRAVEL_PATH_ESCAPE', statusCode: 403 });
      try {
        const stat = await lstat(absolute);
        if (stat.isSymbolicLink()) { excluded.push({ path: relative, reason: 'symlink' }); continue; }
        if (!stat.isFile()) { excluded.push({ path: relative, reason: 'not-regular-file' }); continue; }
        if (stat.size > this.limits.maxFileBytes) { excluded.push({ path: relative, reason: 'file-size-limit', bytes: stat.size }); continue; }
        const bytes = await readFile(absolute); totalBytes += bytes.length;
        if (totalBytes > this.limits.maxTotalBytes) throw Object.assign(new Error('Checkpoint exceeds total byte limit'), { code: 'TIME_TRAVEL_TOTAL_SIZE_LIMIT', statusCode: 413 });
        manifest.push({ path: relative, state: 'present', mode: stat.mode & 0o777, ...(await this.#blob(bytes)) });
      } catch (error) {
        if (error?.code === 'ENOENT') manifest.push({ path: relative, state: 'deleted', sha256: null, bytes: 0 }); else throw error;
      }
    }
    const tasks = this.store.listTasks({ missionId: mission.id }).map((task) => ({ id: task.id, title: task.title, objective: task.objective, role: task.role, status: task.status, dependencies: task.dependencies, allowedPaths: task.allowedPaths, deniedPaths: task.deniedPaths, metadata: { taskContract: task.metadata?.taskContract ?? null } }));
    const lastEvent = this.store.listEvents({ afterSeq: 0, limit: 100_000 }).filter((event) => event.refs?.missionId === mission.id || event.payload?.missionId === mission.id).at(-1) ?? null;
    const base = {
      schema: TIME_TRAVEL_SCHEMAS.checkpoint,
      id: `ttcp_${randomUUID().replaceAll('-', '')}`,
      label: safeLabel(label),
      projectId: project.id,
      missionId: mission.id,
      repositoryRoot,
      git: { commit: head, branch, dirty: manifest.length > 0 || excluded.length > 0 },
      manifest,
      excluded,
      completeWorkingTreeCapture: excluded.length === 0,
      missionState: { objective: mission.objective, status: mission.status, metadata: { goalId: mission.metadata?.goalId ?? null }, tasks },
      eventCursor: Number(lastEvent?.seq ?? 0),
      createdAt: this.clock(),
    };
    const checkpoint = signed(base);
    this.state.checkpoints.push(checkpoint);
    if (this.state.checkpoints.length > 1_000) this.state.checkpoints.splice(0, this.state.checkpoints.length - 1_000);
    await this.#persist();
    return structuredClone(checkpoint);
  }

  async recordAction(input = {}) {
    await this.ready;
    const base = { schema: 'nolane.time-travel-action.v1', id: `ttact_${randomUUID().replaceAll('-', '')}`, checkpointId: String(input.checkpointId ?? ''), action: String(input.action ?? 'unknown'), projectId: input.projectId ?? null, missionId: input.missionId ?? null, path: input.path ?? null, details: input.details ?? {}, createdAt: this.clock() };
    const action = signed(base);
    this.state.actions.push(action);
    if (this.state.actions.length > 5_000) this.state.actions.splice(0, this.state.actions.length - 5_000);
    await this.#persist();
    return structuredClone(action);
  }
}
