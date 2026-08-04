import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { canonicalSha256, deepFreeze } from './shared.mjs';
import { AstCodemodEngine } from './ast-codemod-engine.mjs';
import { verifyCheckpoint8AstPack } from './checkpoint-8-ast-pack.mjs';

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
      if (bytes > 1_000_000) { child.kill('SIGKILL'); reject(new Error('AST mission output budget exceeded')); return; }
      chunks.push(chunk);
    };
    child.stdout.on('data', onData); child.stderr.on('data', onData); child.on('error', reject);
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, command.timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) return reject(new Error('AST mission command timed out'));
      const output = Buffer.concat(chunks);
      resolve({ exitCode: Number(code ?? -1), durationMs: Math.max(0, Math.round(performance.now() - startedAt)), outputSha256: bytesSha(output), outputBytes: output.length });
    });
  });
}

function step(index, type, expectedEffect, actualEffect, verifier, extra = {}) {
  const base = { index, type, expectedEffect, actualEffect, verifier, ...extra };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}

async function executeRecovery({ root, pack, repairOperation, skill = null, trainingRepositoryIds = [] }) {
  const verified = await verifyCheckpoint8AstPack({ root, pack, trainingRepositoryIds });
  if (skill) {
    if (skill.schema !== 'nolane.small-model.ast-skill.v2' || !skill.allowedPaths.includes(verified.sourcePath)) throw new Error('AST skill is outside the held-out path soundness scope');
    if (skill.sourceRepositoryIds.includes(verified.repositoryId)) throw new Error('AST transfer repository overlaps induction lineage');
    if (canonicalSha256(skill.operations[0]) !== canonicalSha256(repairOperation)) throw new Error('AST transfer operation does not match skill definition');
  }
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'nolane-cp8-ast-'));
  const project = path.join(workspace, verified.repositoryId);
  const trackedSource = path.resolve(root, verified.rootPath, verified.sourcePath);
  const trackedBefore = bytesSha(await readFile(trackedSource));
  const engine = new AstCodemodEngine();
  let result = null;
  try {
    await cp(path.resolve(root, verified.rootPath), project, { recursive: true, errorOnExist: true, verbatimSymlinks: true });
    const sourceFile = path.join(project, verified.sourcePath);
    const original = await readFile(sourceFile, 'utf8');
    const steps = [];
    steps.push(step(1, 'inspect', 'source-and-test-hashes-observed', 'hashes-observed', { valid: true }, { sourceSha256: canonicalSha256(original), bestCandidateSha256: null }));
    const baseline = await runCommand(verified.command, project);
    if (baseline.exitCode !== 0) throw new Error('AST baseline verifier failed');
    steps.push(step(2, 'verify-baseline', 'test-pass', 'test-pass', { valid: true, exitCode: baseline.exitCode }, { outputSha256: baseline.outputSha256 }));
    const mutationReceipt = engine.apply({ source: original, operations: [verified.mutation.operation] });
    if (mutationReceipt.changedTokens !== 1) throw new Error('AST mutation did not change exactly one program token');
    await writeFile(sourceFile, mutationReceipt.output);
    const mutation = await runCommand(verified.command, project);
    if (mutation.exitCode === 0) throw new Error('AST mutation did not produce the expected verifier failure');
    steps.push(step(3, 'apply-mutation', 'test-fail', 'test-fail', { valid: true, exitCode: mutation.exitCode }, { candidateSha256: mutationReceipt.outputSha256, changedTokens: mutationReceipt.changedTokens }));
    const repairReceipt = engine.apply({ source: mutationReceipt.output, operations: [repairOperation] });
    if (repairReceipt.changedTokens !== 1 || repairReceipt.changedTokens > Number(skill?.maxChangedTokens ?? 4)) throw new Error('AST repair exceeded its changed-token bound');
    await writeFile(sourceFile, repairReceipt.output);
    const repair = await runCommand(verified.command, project);
    if (repair.exitCode !== 0) throw new Error('AST repair did not pass the verifier');
    const bestCandidateSha256 = repairReceipt.outputSha256;
    steps.push(step(4, 'apply-repair', 'test-pass', 'test-pass', { valid: true, exitCode: repair.exitCode }, { candidateSha256: bestCandidateSha256, changedTokens: repairReceipt.changedTokens, bestCandidateSha256 }));
    const rollbackReceipt = engine.apply({ source: repairReceipt.output, operations: [verified.mutation.operation] });
    const rollbackRestoredMutationHash = rollbackReceipt.outputSha256 === mutationReceipt.outputSha256;
    if (!rollbackRestoredMutationHash) throw new Error('AST rollback did not restore the mutation hash');
    steps.push(step(5, 'verify-rollback', 'mutation-hash-restored', 'mutation-hash-restored', { valid: true }, { rollbackSha256: rollbackReceipt.outputSha256, bestCandidateSha256 }));
    await writeFile(sourceFile, repairReceipt.output);
    const final = await runCommand(verified.command, project);
    if (final.exitCode !== 0 || repairReceipt.outputSha256 !== bestCandidateSha256) throw new Error('AST final candidate was not preserved');
    steps.push(step(6, 'final-verification', 'best-candidate-pass', 'best-candidate-pass', { valid: true, exitCode: final.exitCode }, { bestCandidateSha256 }));
    const trackedAfter = bytesSha(await readFile(trackedSource));
    const commentPreserved = repairReceipt.output.includes('// legacyName remains in comments and strings');
    const stringPreserved = repairReceipt.output.includes("'legacyName remains in string'");
    const base = {
      schema: 'nolane.small-model.ast-recovery-mission.v1', missionId: `${verified.repositoryId}:${skill?.id ?? 'declared-repair'}`,
      repositoryId: verified.repositoryId, role: verified.role, runtime: verified.runtime, language: verified.language,
      status: 'verified-recovery', sourcePath: verified.sourcePath, steps,
      baseline, mutation, repair, final,
      declaredMutation: { path: verified.sourcePath, operation: { ...verified.mutation.operation } },
      declaredRepair: { path: verified.sourcePath, operation: { ...repairOperation } },
      inputSha256: mutationReceipt.outputSha256, outputSha256: repairReceipt.outputSha256,
      rollbackRestoredMutationHash, trackedSourceUnchanged: trackedBefore === trackedAfter && trackedAfter === verified.sourceSha256,
      bestCandidatePreserved: true, bestCandidateSha256, changedTokens: repairReceipt.changedTokens,
      commentPreserved, stringPreserved, workspaceRemoved: true, shellUsed: false, hiddenChainOfThoughtStored: false,
      skillReceiptSha256: skill?.receiptSha256 ?? null,
      claims: { boundedAstRecovery: true, externalRepositoryGeneralization: false, generalCodingIntelligence: false, competitorSuperiority: false },
    };
    result = deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
  if (!result) throw new Error('AST recovery mission did not produce a result');
  return result;
}

export class AstSkillTransferLab {
  async collectRecoveryMission({ root = process.cwd(), pack } = {}) {
    const verified = await verifyCheckpoint8AstPack({ root, pack, trainingRepositoryIds: [] });
    return executeRecovery({ root, pack, repairOperation: verified.repair.operation });
  }

  async verify({ root = process.cwd(), skill, heldOutPack } = {}) {
    if (!skill || skill.schema !== 'nolane.small-model.ast-skill.v2' || !skill.receiptSha256) throw new TypeError('Verified AST skill v2 is required');
    const { receiptSha256, ...skillBase } = skill;
    if (canonicalSha256(skillBase) !== receiptSha256) throw new Error('AST skill receipt hash mismatch');
    const mission = await executeRecovery({ root, pack: heldOutPack, repairOperation: skill.operations[0], skill, trainingRepositoryIds: skill.sourceRepositoryIds });
    const base = {
      schema: 'nolane.small-model.ast-skill-transfer.v1', status: 'pass', skillId: skill.id, skillReceiptSha256: skill.receiptSha256,
      repositoryId: mission.repositoryId, sourceRepositoryIds: [...skill.sourceRepositoryIds], repositoryDisjoint: true,
      mission, missionReceiptSha256: mission.receiptSha256, baselinePassed: mission.baseline.exitCode === 0, mutationFailed: mission.mutation.exitCode !== 0,
      repairPassed: mission.repair.exitCode === 0, rollbackRestoredMutationHash: mission.rollbackRestoredMutationHash,
      trackedSourceUnchanged: mission.trackedSourceUnchanged, bestCandidatePreserved: mission.bestCandidatePreserved,
      commentPreserved: mission.commentPreserved, stringPreserved: mission.stringPreserved, changedTokens: mission.changedTokens,
      hiddenChainOfThoughtStored: false,
      claims: { boundedAstTransfer: true, externalRepositoryGeneralization: false, generalCodingIntelligence: false, competitorSuperiority: false },
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
}
