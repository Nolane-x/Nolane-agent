import { execFile } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { signed, strings, text } from './construction-utils.mjs';
import { StateCapsuleStore } from './state-capsule-store.mjs';

const execFileAsync = promisify(execFile);
const SHA256 = /^[a-f0-9]{64}$/i;
const REQUIRED_CHECKPOINTS = Object.freeze(['parse', 'type', 'test']);

function sha(value, label) {
  const output = String(value ?? '').toLowerCase();
  if (!SHA256.test(output)) throw new TypeError(`${label} must be SHA-256`);
  return output;
}

function uniqueObjects(items, label, idField, normalize, max = 256) {
  if (!Array.isArray(items) || items.length > max) throw new TypeError(`${label} must be a bounded array`);
  const ids = new Set();
  return items.map((item, index) => {
    if (!item || typeof item !== 'object') throw new TypeError(`${label}[${index}] must be an object`);
    const normalized = normalize(item, index);
    if (ids.has(normalized[idField])) throw new TypeError(`${label} contains duplicate ${idField}: ${normalized[idField]}`);
    ids.add(normalized[idField]);
    return normalized;
  });
}

function defaultRunner(command, args, options = {}) {
  return execFileAsync(command, args, {
    cwd: options.cwd,
    windowsHide: true,
    timeout: options.timeoutMs ?? 30_000,
    maxBuffer: options.maxBuffer ?? 1_000_000,
  });
}

export class ConstructionContractRuntime {
  constructor({ workspaceRoot, stateRoot, runner = defaultRunner, maxFilesPerOwner = 64, maxContractsPerOwner = 16 } = {}) {
    this.workspaceRoot = path.resolve(text(workspaceRoot, 'workspaceRoot', 4096));
    this.stateRoot = path.resolve(text(stateRoot, 'stateRoot', 4096));
    this.runner = runner;
    this.maxFilesPerOwner = Math.max(1, Math.floor(Number(maxFilesPerOwner) || 64));
    this.maxContractsPerOwner = Math.max(1, Math.floor(Number(maxContractsPerOwner) || 16));
    this.capsules = new StateCapsuleStore({ root: path.join(this.stateRoot, 'capsules') });
    this.contracts = new Map();
    this.candidateSets = new Map();
  }

  compileContract(input = {}) {
    const contractId = text(input.contractId, 'contractId', 256);
    const types = uniqueObjects(input.types ?? [], 'types', 'name', (item, index) => ({
      name: text(item.name, `types[${index}].name`, 256),
      shape: text(item.shape, `types[${index}].shape`, 4096),
    }));
    const interfaces = uniqueObjects(input.interfaces ?? [], 'interfaces', 'name', (item, index) => ({
      name: text(item.name, `interfaces[${index}].name`, 256),
      methods: strings(item.methods ?? [], `interfaces[${index}].methods`, 256, 1024),
    }));
    const errors = uniqueObjects(input.errors ?? [], 'errors', 'code', (item, index) => ({
      code: text(item.code, `errors[${index}].code`, 256),
      recoverable: item.recoverable === true,
    }));
    const states = uniqueObjects(input.states ?? [], 'states', 'transitionId', (item, index) => ({
      transitionId: String(item.transitionId ?? `${item.from}:${item.event}:${item.to}`),
      from: text(item.from, `states[${index}].from`, 256),
      event: text(item.event, `states[${index}].event`, 256),
      to: text(item.to, `states[${index}].to`, 256),
    }));
    const compatibility = {
      publicApi: text(input.compatibility?.publicApi ?? 'unspecified', 'compatibility.publicApi', 256),
      data: String(input.compatibility?.data ?? 'unspecified').slice(0, 256),
      runtime: String(input.compatibility?.runtime ?? 'unspecified').slice(0, 256),
    };
    const contract = signed({
      schema: 'forge.construction-contract.v1', contractId, types, interfaces, errors, states, compatibility,
      status: 'ready',
      claims: { contractFirst: true, implementationGenerated: false, compatibilityVerifiedByDeclaration: false },
    });
    this.contracts.set(contract.receiptSha256, contract);
    return contract;
  }

  createVerticalPlan(input = {}) {
    const planId = text(input.planId, 'planId', 256);
    const contractReceiptSha256 = sha(input.contractReceiptSha256, 'contractReceiptSha256');
    if (!this.contracts.has(contractReceiptSha256)) throw new Error('unknown construction contract receipt');
    const slices = uniqueObjects(input.slices ?? [], 'slices', 'sliceId', (slice, index) => {
      const checkpoints = strings(slice.checkpoints ?? [], `slices[${index}].checkpoints`, 16, 64);
      if (!REQUIRED_CHECKPOINTS.every((checkpoint) => checkpoints.includes(checkpoint))) {
        throw new Error('each vertical slice requires parse, type, and test checkpoints');
      }
      return {
        sliceId: text(slice.sliceId, `slices[${index}].sliceId`, 256),
        taskIds: strings(slice.taskIds ?? [], `slices[${index}].taskIds`, 256, 256),
        allowedFiles: strings(slice.allowedFiles ?? [], `slices[${index}].allowedFiles`, 256, 1024),
        contractIds: strings(slice.contractIds ?? [], `slices[${index}].contractIds`, 64, 256),
        checkpoints: REQUIRED_CHECKPOINTS,
        status: index === 0 ? 'ready' : 'blocked',
        dependsOnSliceId: index === 0 ? null : String(input.slices[index - 1].sliceId),
      };
    });
    if (!slices.length) throw new TypeError('slices must contain at least one vertical slice');
    return signed({
      schema: 'forge.vertical-construction-plan.v1', planId, contractReceiptSha256, slices,
      activeTaskIds: [...new Set(slices.flatMap((slice) => slice.taskIds))], revokedTaskIds: [], revision: 1,
      claims: { verticalSlices: true, checkpointAfterEverySlice: true, allSlicesExecuted: false },
    });
  }

  replan({ plan, obsoleteTaskIds = [], reason, verificationReceiptSha256 } = {}) {
    if (!plan || plan.schema !== 'forge.vertical-construction-plan.v1') throw new TypeError('vertical construction plan is required');
    const revoked = strings(obsoleteTaskIds, 'obsoleteTaskIds', 256, 256);
    const why = text(reason, 'reason', 2048);
    const receipt = sha(verificationReceiptSha256, 'verificationReceiptSha256');
    const activeSet = new Set(plan.activeTaskIds ?? []);
    for (const taskId of revoked) {
      if (!activeSet.has(taskId)) throw new Error(`cannot revoke unknown or already inactive task: ${taskId}`);
      activeSet.delete(taskId);
    }
    return signed({
      schema: 'forge.vertical-construction-replan.v1', planId: plan.planId, fromRevision: plan.revision,
      revision: Number(plan.revision) + 1, activeTaskIds: [...activeSet].sort(), revokedTaskIds: [...new Set([...(plan.revokedTaskIds ?? []), ...revoked])].sort(),
      reason: why, verificationReceiptSha256: receipt,
      claims: { revokedTasksExecuted: false, replanVerified: true },
    });
  }

  bindOwnership({ milestoneId, assignments = [], maxFilesPerOwner, maxContractsPerOwner } = {}) {
    const milestone = text(milestoneId, 'milestoneId', 256);
    const fileLimit = Math.max(1, Math.floor(Number(maxFilesPerOwner) || this.maxFilesPerOwner));
    const contractLimit = Math.max(1, Math.floor(Number(maxContractsPerOwner) || this.maxContractsPerOwner));
    const fileOwners = new Map();
    const contractOwners = new Map();
    const normalized = uniqueObjects(assignments, 'assignments', 'ownerId', (assignment, index) => {
      const ownerId = text(assignment.ownerId, `assignments[${index}].ownerId`, 256);
      const files = strings(assignment.files ?? [], `assignments[${index}].files`, fileLimit, 1024);
      const contracts = strings(assignment.contracts ?? [], `assignments[${index}].contracts`, contractLimit, 256);
      for (const file of files) {
        if (fileOwners.has(file)) throw new Error(`file ownership conflict: ${file}`);
        fileOwners.set(file, ownerId);
      }
      for (const contract of contracts) {
        if (contractOwners.has(contract)) throw new Error(`contract ownership conflict: ${contract}`);
        contractOwners.set(contract, ownerId);
      }
      return { ownerId, files, contracts };
    });
    return signed({
      schema: 'forge.milestone-ownership.v1', milestoneId: milestone, status: 'bound', assignments: normalized,
      limits: { maxFilesPerOwner: fileLimit, maxContractsPerOwner: contractLimit },
      claims: { boundedOwnership: true, overlappingOwnershipAllowed: false },
    });
  }

  async launchCandidates({ verificationContractSha256, candidates = [], baseRef = 'HEAD' } = {}) {
    const contract = sha(verificationContractSha256, 'verificationContractSha256');
    if (!Array.isArray(candidates) || candidates.length < 2 || candidates.length > 3) throw new TypeError('candidate launch requires 2-3 candidates');
    const ids = new Set();
    const setId = canonicalSha256({ contract, candidates: candidates.map((candidate) => String(candidate.candidateId ?? '')).sort(), baseRef: String(baseRef) }).slice(0, 24);
    const root = path.join(this.stateRoot, 'candidate-worktrees', setId);
    await mkdir(root, { recursive: true });
    const launched = [];
    try {
      const head = (await this.runner('git', ['rev-parse', String(baseRef)], { cwd: this.workspaceRoot })).stdout.trim();
      for (const candidate of candidates) {
        const candidateId = text(candidate.candidateId, 'candidateId', 128);
        if (ids.has(candidateId)) throw new TypeError(`duplicate candidateId: ${candidateId}`);
        ids.add(candidateId);
        const safeName = candidateId.replace(/[^a-zA-Z0-9._-]/g, '_');
        const worktreePath = path.join(root, safeName);
        await this.runner('git', ['worktree', 'add', '--detach', worktreePath, head], { cwd: this.workspaceRoot, timeoutMs: 60_000 });
        const actualHead = (await this.runner('git', ['rev-parse', 'HEAD'], { cwd: worktreePath })).stdout.trim();
        const isolationBase = { candidateId, worktreePath, headSha: actualHead, verificationContractSha256: contract };
        launched.push({ ...isolationBase, isolated: true, isolationReceiptSha256: canonicalSha256(isolationBase) });
      }
    } catch (error) {
      for (const item of launched) {
        try { await this.runner('git', ['worktree', 'remove', '--force', item.worktreePath], { cwd: this.workspaceRoot, timeoutMs: 60_000 }); } catch {}
      }
      await rm(root, { recursive: true, force: true });
      throw error;
    }
    const receipt = signed({
      schema: 'forge.candidate-worktree-set.v1', setId, verificationContractSha256: contract,
      candidates: launched, claims: { realGitWorktrees: true, sharedVerificationContract: true, candidateSelected: false },
    });
    this.candidateSets.set(receipt.receiptSha256, receipt);
    return receipt;
  }

  async cleanupCandidates(candidateSet) {
    if (!candidateSet?.candidates) return;
    for (const candidate of candidateSet.candidates) {
      try { await this.runner('git', ['worktree', 'remove', '--force', candidate.worktreePath], { cwd: this.workspaceRoot, timeoutMs: 60_000 }); } catch {}
    }
    const roots = new Set(candidateSet.candidates.map((candidate) => path.dirname(candidate.worktreePath)));
    for (const root of roots) await rm(root, { recursive: true, force: true });
    try { await this.runner('git', ['worktree', 'prune'], { cwd: this.workspaceRoot }); } catch {}
  }

  saveState(input = {}) { return this.capsules.save(input); }

  async restoreState(capsuleId, currentState = {}) {
    const capsule = await this.capsules.load(capsuleId);
    const resume = await this.capsules.resume(capsuleId, currentState);
    if (resume.status !== 'resumable') {
      const error = new Error(`state capsule cannot resume exactly: ${resume.invalidReasons.join(', ')}`);
      error.code = 'STATE_CAPSULE_REVALIDATION_REQUIRED';
      error.resume = resume;
      throw error;
    }
    return signed({
      schema: 'forge.exact-construction-restore.v1', status: 'resumable', exactMatch: true,
      capsule, nextStepIds: capsule.nextStepIds, claims: { rebootSimulated: false, stateReconstructedFromReceipt: true },
    });
  }
}
