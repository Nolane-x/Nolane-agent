import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { safeRelativePath, signed, TIME_TRAVEL_SCHEMAS } from './time-travel-schema.mjs';

const exec = promisify(execFile);
function hash(buffer) { return createHash('sha256').update(buffer).digest('hex'); }
function splitNul(value) { return String(value ?? '').split('\0').filter(Boolean); }

async function git(root, args) {
  try { return String((await exec('git', args, { cwd: root, timeout: 120_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true, env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', SYSTEMROOT: process.env.SYSTEMROOT ?? '', GIT_TERMINAL_PROMPT: '0' } })).stdout ?? ''); }
  catch (cause) { throw Object.assign(new Error(`git comparison failed: ${String(cause?.stderr ?? cause?.message ?? cause).slice(0, 800)}`), { code: 'TIME_TRAVEL_GIT_FAILED', statusCode: 409, cause }); }
}

function parseNameStatus(text) {
  const values = splitNul(text); const records = [];
  for (let index = 0; index < values.length;) {
    const status = values[index++]; const file = values[index++];
    if (!status || !file) break;
    records.push({ status: status[0], path: safeRelativePath(file) });
  }
  return records;
}

async function currentState(root, relative) {
  const absolute = path.resolve(root, relative);
  const lexical = path.relative(root, absolute);
  if (lexical.startsWith('..') || path.isAbsolute(lexical)) throw Object.assign(new Error('Path escapes project'), { code: 'TIME_TRAVEL_PATH_ESCAPE', statusCode: 403 });
  try {
    const stat = await lstat(absolute);
    if (stat.isSymbolicLink()) return { state: 'symlink', sha256: null, bytes: 0 };
    if (!stat.isFile()) return { state: 'other', sha256: null, bytes: 0 };
    const bytes = await readFile(absolute);
    return { state: 'present', sha256: hash(bytes), bytes: bytes.length };
  } catch (error) {
    if (error?.code === 'ENOENT') return { state: 'deleted', sha256: null, bytes: 0 };
    throw error;
  }
}

export class StateComparator {
  constructor({ index, store, clock = () => new Date().toISOString() } = {}) {
    if (!index?.get || !store?.getProject) throw new TypeError('StateComparator index and store are required');
    this.index = index; this.store = store; this.clock = clock;
  }

  async compare({ checkpointId } = {}) {
    const checkpoint = await this.index.get(checkpointId);
    const project = this.store.getProject(checkpoint.projectId);
    if (!project) throw Object.assign(new Error(`Unknown project: ${checkpoint.projectId}`), { statusCode: 404, code: 'TIME_TRAVEL_PROJECT_NOT_FOUND' });
    const root = path.resolve(project.workspaceRoot);
    const currentHead = (await git(root, ['rev-parse', 'HEAD'])).trim();
    const diffRecords = parseNameStatus(await git(root, ['diff', '--name-status', '--no-renames', '-z', checkpoint.git.commit, '--', '.']));
    const untracked = splitNul(await git(root, ['ls-files', '-o', '--exclude-standard', '-z'])).map((file) => ({ status: 'A', path: safeRelativePath(file) }));
    const candidates = new Map([...diffRecords, ...untracked].map((item) => [item.path, item]));
    for (const entry of checkpoint.manifest ?? []) candidates.set(entry.path, candidates.get(entry.path) ?? { status: 'M', path: entry.path });
    const changes = [];
    for (const item of [...candidates.values()].sort((a, b) => a.path.localeCompare(b.path)).slice(0, 5_000)) {
      const captured = (checkpoint.manifest ?? []).find((entry) => entry.path === item.path) ?? null;
      const current = await currentState(root, item.path);
      const checkpointState = captured ? { state: captured.state, sha256: captured.sha256, bytes: captured.bytes } : { state: 'git', sha256: null, bytes: null };
      if (captured && captured.state === current.state && captured.sha256 === current.sha256) continue;
      changes.push({ path: item.path, status: current.state === 'deleted' ? 'deleted' : captured?.state === 'deleted' ? 'added' : item.status === 'A' ? 'added' : 'modified', checkpoint: checkpointState, current });
    }
    const base = {
      schema: TIME_TRAVEL_SCHEMAS.comparison,
      checkpointId: checkpoint.id,
      projectId: checkpoint.projectId,
      missionId: checkpoint.missionId,
      generatedAt: this.clock(),
      checkpointGitCommit: checkpoint.git.commit,
      currentGitCommit: currentHead,
      sameCommit: currentHead === checkpoint.git.commit,
      completeCheckpoint: checkpoint.completeWorkingTreeCapture === true,
      summary: { changed: changes.length, added: changes.filter((item) => item.status === 'added').length, modified: changes.filter((item) => item.status === 'modified').length, deleted: changes.filter((item) => item.status === 'deleted').length },
      changes,
    };
    return signed(base);
  }
}
