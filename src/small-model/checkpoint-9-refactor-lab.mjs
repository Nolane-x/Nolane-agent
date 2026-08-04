import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { canonicalSha256, deepFreeze } from './shared.mjs';
import { MultiFileRefactorEngine } from './multi-file-refactor-engine.mjs';
import { verifyCheckpoint9RefactorPack } from './checkpoint-9-refactor-pack.mjs';

const bytesSha = (value) => createHash('sha256').update(value).digest('hex');

async function runCommand(command, cwd) {
  const env = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', NODE_DISABLE_COLORS: '1' };
  delete env.NODE_TEST_CONTEXT;
  return await new Promise((resolve, reject) => {
    const startedAt = performance.now();
    const child = spawn(command.argv[0], command.argv.slice(1), { cwd, shell: false, windowsHide: true, env });
    const chunks = []; let bytes = 0; let timedOut = false;
    const onData = (chunk) => {
      bytes += chunk.length;
      if (bytes > 1_000_000) { child.kill('SIGKILL'); reject(new Error('Refactor mission output budget exceeded')); return; }
      chunks.push(chunk);
    };
    child.stdout.on('data', onData); child.stderr.on('data', onData); child.on('error', reject);
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, command.timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) return reject(new Error('Refactor mission command timed out'));
      const output = Buffer.concat(chunks);
      resolve({ exitCode: Number(code ?? -1), durationMs: Math.round(performance.now() - startedAt), outputSha256: bytesSha(output), outputBytes: output.length });
    });
  });
}

function step(index, type, verifier, extra = {}) {
  const base = { index, type, verifier, ...extra };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}

async function readProjectFiles(project, sourceFiles) {
  return await Promise.all(sourceFiles.map(async (item) => {
    const source = await readFile(path.join(project, item.path), 'utf8');
    return { path: item.path, source, sha256: canonicalSha256(source) };
  }));
}

async function writePlan(project, plan) {
  for (const file of plan.files) if (file.inputSha256 !== file.outputSha256) await writeFile(path.join(project, file.path), file.output);
}

async function execute({ root, pack, repairOperation, skill = null, trainingRepositoryIds = [] }) {
  const verified = await verifyCheckpoint9RefactorPack({ root, pack, trainingRepositoryIds });
  if (skill) {
    if (skill.schema !== 'nolane.small-model.multi-file-refactor-skill.v1') throw new Error('Verified multi-file refactor skill is required');
    const { receiptSha256, ...base } = skill;
    if (canonicalSha256(base) !== receiptSha256) throw new Error('Refactor skill receipt hash mismatch');
    if (skill.sourceRepositoryIds.includes(verified.repositoryId)) throw new Error('Refactor transfer repository overlaps induction lineage');
    if (canonicalSha256(skill.operation) !== canonicalSha256(repairOperation)) throw new Error('Refactor transfer operation does not match skill');
    if (canonicalSha256([...skill.allowedPaths].sort()) !== canonicalSha256(verified.sourceFiles.map((item) => item.path).sort())) throw new Error('Refactor transfer path scope mismatch');
  }
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'nolane-cp9-refactor-'));
  const project = path.join(workspace, verified.repositoryId);
  const tracked = new Map();
  for (const item of verified.sourceFiles) tracked.set(item.path, bytesSha(await readFile(path.join(root, verified.rootPath, item.path))));
  let result;
  try {
    await cp(path.join(root, verified.rootPath), project, { recursive: true, errorOnExist: true, verbatimSymlinks: true });
    const engine = new MultiFileRefactorEngine();
    const steps = [step(1, 'inspect', { valid: true }, { sourceFiles: verified.sourceFiles.length })];
    const baseline = await runCommand(verified.command, project);
    if (baseline.exitCode !== 0) throw new Error('Refactor baseline verifier failed');
    steps.push(step(2, 'verify-baseline', { valid: true, exitCode: 0 }, { outputSha256: baseline.outputSha256 }));
    const originals = await readProjectFiles(project, verified.sourceFiles);
    const mutationPlan = engine.plan({ files: originals, operation: verified.mutation });
    await writePlan(project, mutationPlan);
    const mutation = await runCommand(verified.command, project);
    if (mutation.exitCode === 0) throw new Error('Refactor mutation did not fail verifier');
    steps.push(step(3, 'apply-mutation', { valid: true, exitCode: mutation.exitCode }, { planReceiptSha256: mutationPlan.receiptSha256 }));
    const mutatedFiles = await readProjectFiles(project, verified.sourceFiles);
    const repairPlan = engine.plan({ files: mutatedFiles, operation: repairOperation });
    if (skill && (repairPlan.changedFiles > skill.maxChangedFiles || repairPlan.changedTokens > skill.maxChangedTokens)) throw new Error('Refactor repair exceeds learned bounds');
    await writePlan(project, repairPlan);
    const repair = await runCommand(verified.command, project);
    if (repair.exitCode !== 0) throw new Error('Refactor repair did not pass verifier');
    const bestCandidateSha256 = canonicalSha256(repairPlan.files.map((file) => [file.path, file.outputSha256]));
    steps.push(step(4, 'apply-repair', { valid: true, exitCode: 0 }, { planReceiptSha256: repairPlan.receiptSha256, bestCandidateSha256 }));
    const repairedFiles = await readProjectFiles(project, verified.sourceFiles);
    const rollbackPlan = engine.plan({ files: repairedFiles, operation: verified.mutation });
    const rollbackRestoredAllHashes = rollbackPlan.files.every((file) => file.outputSha256 === mutationPlan.files.find((candidate) => candidate.path === file.path).outputSha256);
    if (!rollbackRestoredAllHashes) throw new Error('Refactor rollback did not restore all mutation hashes');
    steps.push(step(5, 'verify-rollback', { valid: true }, { rollbackRestoredAllHashes, bestCandidateSha256 }));
    await writePlan(project, repairPlan);
    const final = await runCommand(verified.command, project);
    if (final.exitCode !== 0) throw new Error('Refactor final verifier failed');
    steps.push(step(6, 'final-verification', { valid: true, exitCode: 0 }, { bestCandidateSha256 }));
    const trackedSourcesUnchanged = (await Promise.all([...tracked].map(async ([filePath, sha256]) => bytesSha(await readFile(path.join(root, verified.rootPath, filePath))) === sha256))).every(Boolean);
    const api = repairPlan.files.find((file) => file.path === 'src/api.mjs').output;
    const base = {
      schema: 'nolane.small-model.multi-file-refactor-mission.v1',
      missionId: `${verified.repositoryId}:${skill?.id ?? 'declared-repair'}`,
      repositoryId: verified.repositoryId,
      role: verified.role,
      runtime: verified.runtime,
      language: verified.language,
      status: 'verified-recovery',
      sourcePaths: verified.sourceFiles.map((item) => item.path).sort(),
      steps,
      baseline,
      mutation,
      repair,
      final,
      mutationPlanReceiptSha256: mutationPlan.receiptSha256,
      repairPlanReceiptSha256: repairPlan.receiptSha256,
      declaredMutation: { ...verified.mutation },
      declaredRepair: { ...repairOperation },
      changedFiles: repairPlan.changedFiles,
      changedTokens: repairPlan.changedTokens,
      rollbackRestoredAllHashes,
      trackedSourcesUnchanged,
      bestCandidatePreserved: true,
      bestCandidateSha256,
      commentPreserved: api.includes('// canonicalName remains in comments'),
      stringPreserved: api.includes("'canonicalName remains in strings'"),
      propertyKeysPreserved: api.includes("{ canonicalName: 'property-key'") && api.includes('metadata.canonicalName'),
      workspaceRemoved: true,
      shellUsed: false,
      hiddenChainOfThoughtStored: false,
      skillReceiptSha256: skill?.receiptSha256 ?? null,
      claims: { boundedMultiFileRefactor: true, externalRepositoryGeneralization: false, generalCodingIntelligence: false, competitorSuperiority: false },
    };
    result = deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
  return result;
}

export class Checkpoint9RefactorLab {
  async collect({ root = process.cwd(), pack } = {}) {
    const verified = await verifyCheckpoint9RefactorPack({ root, pack });
    return execute({ root, pack, repairOperation: verified.repair });
  }

  async verify({ root = process.cwd(), skill, heldOutPack } = {}) {
    const mission = await execute({ root, pack: heldOutPack, repairOperation: skill.operation, skill, trainingRepositoryIds: skill.sourceRepositoryIds });
    const base = {
      schema: 'nolane.small-model.checkpoint-9-refactor-transfer.v1',
      status: 'pass',
      skillId: skill.id,
      skillReceiptSha256: skill.receiptSha256,
      repositoryId: mission.repositoryId,
      sourceRepositoryIds: [...skill.sourceRepositoryIds],
      repositoryDisjoint: true,
      mission,
      missionReceiptSha256: mission.receiptSha256,
      changedFiles: mission.changedFiles,
      changedTokens: mission.changedTokens,
      rollbackRestoredAllHashes: mission.rollbackRestoredAllHashes,
      trackedSourcesUnchanged: mission.trackedSourcesUnchanged,
      bestCandidatePreserved: mission.bestCandidatePreserved,
      commentPreserved: mission.commentPreserved,
      stringPreserved: mission.stringPreserved,
      propertyKeysPreserved: mission.propertyKeysPreserved,
      hiddenChainOfThoughtStored: false,
      claims: { boundedMultiFileTransfer: true, externalRepositoryGeneralization: false, generalCodingIntelligence: false },
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
}
