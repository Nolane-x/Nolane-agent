import { createHash } from 'node:crypto';
import { readdir, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { canonicalSha256, clone, deepFreeze, boundedNumber } from './shared.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

async function walk(root, { maxFiles, maxBytes }) {
  const files = [];
  let totalBytes = 0;
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '.git' || entry.name === 'node_modules') continue;
        await visit(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      if (files.length >= maxFiles) throw new Error('Repository file budget exceeded');
      const bytes = await readFile(absolute);
      totalBytes += bytes.length;
      if (totalBytes > maxBytes) throw new Error('Repository byte budget exceeded');
      files.push({ path: path.relative(root, absolute).split(path.sep).join('/'), bytes: bytes.length, sha256: sha256(bytes) });
    }
  }
  await visit(root);
  return { files, totalBytes };
}

function assertOracle(oracle, name, { failureRequired = false } = {}) {
  if (oracle?.valid !== true || oracle.independent !== true || !/^[a-f0-9]{64}$/i.test(String(oracle.receiptSha256 ?? ''))) throw new Error(`${name} oracle must be valid, independent and receipted`);
  if (failureRequired && oracle.failureObserved !== true) throw new Error(`${name} oracle must observe the mutation failure`);
}

export class CurriculumFactory {
  #environments = new Map();
  #tasks = new Map();
  #roles = null;
  #splits = { train: [], validation: [], heldOut: [], contaminated: false };
  #mutations = [];
  #maxFiles;
  #maxBytes;

  constructor({ maxFiles = 20_000, maxBytes = 100 * 1024 * 1024 } = {}) {
    this.#maxFiles = maxFiles;
    this.#maxBytes = maxBytes;
  }

  async buildEnvironment({ id, root, license } = {}) {
    if (!id || !root || !license?.spdx || !license?.source) throw new TypeError('Environment id, root and license provenance are required');
    const resolvedRoot = await realpath(root);
    const { files, totalBytes } = await walk(resolvedRoot, { maxFiles: this.#maxFiles, maxBytes: this.#maxBytes });
    const contentSha256 = canonicalSha256(files);
    const base = {
      schema: 'nolane.small-model.repository-environment.v1', id: String(id), root: resolvedRoot,
      gitRequired: false, files, totalBytes, contentSha256,
      license: { spdx: String(license.spdx), source: String(license.source) },
    };
    const environment = deepFreeze({ ...base, environmentSha256: canonicalSha256(base) });
    this.#environments.set(environment.id, environment);
    return environment;
  }

  verifyMutation({ sourceText, mutation, baselineOracle, mutantOracle } = {}) {
    if (typeof sourceText !== 'string' || mutation?.op !== 'replace-exact' || typeof mutation.from !== 'string' || typeof mutation.to !== 'string') throw new TypeError('Declarative replace-exact mutation is required');
    assertOracle(baselineOracle, 'Baseline');
    assertOracle(mutantOracle, 'Mutant', { failureRequired: true });
    const index = sourceText.indexOf(mutation.from);
    if (index < 0) throw new Error('Mutation target not found');
    const mutant = `${sourceText.slice(0, index)}${mutation.to}${sourceText.slice(index + mutation.from.length)}`;
    if (mutant === sourceText) throw new Error('Mutation produced no change');
    const base = {
      schema: 'nolane.small-model.mutation-validity.v1', mutation: clone(mutation), validMutation: true,
      sourceSha256: sha256(sourceText), mutantSha256: sha256(mutant),
      oracleReceipts: [baselineOracle.receiptSha256, mutantOracle.receiptSha256],
    };
    const receipt = deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
    this.#mutations.push(receipt);
    return receipt;
  }

  registerRoles({ bugMaker, solver, adversary } = {}) {
    if (!bugMaker || !solver || !adversary || new Set([bugMaker, solver, adversary]).size !== 3) throw new Error('Bug-maker, solver and adversary roles must be separate');
    this.#roles = deepFreeze({ bugMaker: String(bugMaker), solver: String(solver), adversary: String(adversary) });
    return this.#roles;
  }

  generateTask({ id, environmentId, capability, difficulty, track = 'capability' } = {}) {
    if (!id || !this.#environments.has(environmentId) || !capability) throw new TypeError('Task id, known environment and capability are required');
    if (!['capability', 'safety', 'reward-hacking'].includes(track)) throw new TypeError('Unsupported curriculum track');
    const base = {
      schema: 'nolane.small-model.curriculum-task.v1', id: String(id), environmentId: String(environmentId), capability: String(capability),
      difficulty: boundedNumber(difficulty, 'task difficulty'), track, hiddenVerifierRequired: track === 'reward-hacking',
      roles: this.#roles,
    };
    const task = deepFreeze({ ...base, taskSha256: canonicalSha256(base) });
    this.#tasks.set(task.id, task);
    return task;
  }

  reduceTrajectory({ steps } = {}) {
    if (!Array.isArray(steps) || steps.length === 0) throw new TypeError('Trajectory steps are required');
    const reduced = steps.filter((step) => step?.verified === true && step.effect?.changed === true).map(clone);
    if (reduced.length === 0) throw new Error('Trajectory has no verified effective path');
    const weakestStepScore = Math.min(...reduced.map((step) => boundedNumber(step.score, 'step score')));
    const base = { schema: 'nolane.small-model.shortest-trajectory.v1', steps: reduced, weakestStepScore };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  defineSplits({ train = [], validation = [], heldOut = [] } = {}) {
    const normalized = {
      train: [...new Set(train.map(String))].sort(),
      validation: [...new Set(validation.map(String))].sort(),
      heldOut: [...new Set(heldOut.map(String))].sort(),
    };
    const all = [...normalized.train, ...normalized.validation, ...normalized.heldOut];
    if (new Set(all).size !== all.length) throw new Error('Repository contamination detected across splits');
    const base = { schema: 'nolane.small-model.repository-splits.v1', ...normalized, contaminated: false };
    this.#splits = deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
    return this.#splits;
  }

  progressCurriculum({ previous = [], frontier = [], retentionRate = 0.25 } = {}) {
    const rate = boundedNumber(retentionRate, 'retentionRate');
    const retainedCount = Math.min(previous.length, Math.max(previous.length > 0 && rate > 0 ? 1 : 0, Math.ceil(previous.length * rate)));
    const retained = [...previous].sort((a, b) => Number(b.difficulty) - Number(a.difficulty) || String(a.id).localeCompare(String(b.id))).slice(0, retainedCount);
    const newTasks = [...frontier].sort((a, b) => Number(a.difficulty) - Number(b.difficulty) || String(a.id).localeCompare(String(b.id)));
    return deepFreeze([...retained.map(clone), ...newTasks.map(clone)]);
  }

  snapshotDataset({ id, version } = {}) {
    if (!id || !version) throw new TypeError('Dataset id and version are required');
    const environments = [...this.#environments.values()].map((environment) => ({
      id: environment.id, contentSha256: environment.contentSha256, environmentSha256: environment.environmentSha256,
      files: environment.files, license: environment.license,
    })).sort((a, b) => a.id.localeCompare(b.id));
    const tasks = [...this.#tasks.values()].sort((a, b) => a.id.localeCompare(b.id));
    const licenses = environments.map((environment) => ({ environmentId: environment.id, spdx: environment.license.spdx, source: environment.license.source }));
    const base = {
      schema: 'nolane.small-model.dataset-snapshot.v1', id: String(id), version: String(version),
      environments, tasks, splits: this.#splits, licenses, mutationReceipts: this.#mutations.map((item) => item.receiptSha256).sort(),
      roles: this.#roles,
    };
    return deepFreeze({ ...base, datasetSha256: canonicalSha256(base) });
  }

  snapshot() {
    return deepFreeze({ schema: 'nolane.small-model.curriculum-factory.v1', environments: this.#environments.size, tasks: this.#tasks.size, mutations: this.#mutations.length, rolesSeparated: Boolean(this.#roles), splits: this.#splits });
  }
}
