import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { canonicalSha256, deepFreeze } from './shared.mjs';
import { verifyHeldOutPack } from './checkpoint-7-heldout-pack.mjs';
import { BestCandidateLedger } from './best-candidate-ledger.mjs';

const hashBytes = (value) => createHash('sha256').update(value).digest('hex');
const hashFile = async (file) => hashBytes(await readFile(file));

function withReceipt(value) {
  return deepFreeze({ ...value, receiptSha256: canonicalSha256(value) });
}

async function runCommand({ argv, cwd, timeoutMs, maxOutputBytes = 1_000_000 }) {
  const started = Date.now();
  return await new Promise((resolve, reject) => {
    const env = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', PYTHONDONTWRITEBYTECODE: '1' };
    delete env.NODE_TEST_CONTEXT;
    const child = spawn(argv[0], argv.slice(1), { cwd, shell: false, windowsHide: true, env });
    const output = [];
    let bytes = 0;
    let timedOut = false;
    const append = (kind) => (chunk) => {
      bytes += chunk.length;
      if (bytes > maxOutputBytes) {
        child.kill('SIGKILL');
        reject(new Error('Mission command output budget exceeded'));
        return;
      }
      output.push(Buffer.from(`${kind}:`)); output.push(Buffer.from(chunk));
    };
    child.stdout.on('data', append('stdout'));
    child.stderr.on('data', append('stderr'));
    child.on('error', reject);
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (timedOut) return reject(new Error('Mission command timed out'));
      const combined = Buffer.concat(output);
      resolve({ exitCode: Number(code ?? -1), signal: signal ?? null, durationMs: Date.now() - started, outputSha256: hashBytes(combined), outputBytes: combined.length, shellUsed: false });
    });
  });
}

function step({ missionId, index, phase, parentStepId, state, action, expectedEffect, actualEffect, verifier, candidateSha256, bestCandidateId }) {
  const id = `${missionId}:step-${String(index + 1).padStart(2, '0')}`;
  const base = {
    schema: 'nolane.small-model.mission-step.v1', id, missionId, index, phase, parentStepId: parentStepId ?? null,
    state, action, expectedEffect, actualEffect, verifier, candidateSha256, bestCandidateId: bestCandidateId ?? null,
    hiddenChainOfThoughtStored: false,
  };
  return withReceipt(base);
}

function replaceExact(text, from, to, label) {
  const first = text.indexOf(from);
  if (first < 0) throw new Error(`${label} source pattern was not found`);
  if (text.indexOf(from, first + from.length) >= 0) throw new Error(`${label} source pattern is ambiguous`);
  return `${text.slice(0, first)}${to}${text.slice(first + from.length)}`;
}

export class MissionTrajectoryEngine {
  constructor({ trainingRepositoryIds = [] } = {}) { this.trainingRepositoryIds = [...trainingRepositoryIds].map(String); }

  async run({ root = process.cwd(), pack, runId = 'default' } = {}) {
    const verifiedPack = await verifyHeldOutPack({ root, pack, trainingRepositoryIds: this.trainingRepositoryIds });
    const missionId = `checkpoint-7:${verifiedPack.repositoryId}:${verifiedPack.taskId}:${String(runId)}`;
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'nolane-cp7-mission-'));
    const sourceProject = path.resolve(root, verifiedPack.rootPath);
    const workspaceProject = path.join(workspace, verifiedPack.repositoryId);
    const sourceFile = path.join(workspaceProject, verifiedPack.sourcePath);
    const testFile = path.join(workspaceProject, verifiedPack.testPath);
    const ledger = new BestCandidateLedger({ missionId });
    const steps = [];
    let resultBase = null;
    try {
      await cp(sourceProject, workspaceProject, { recursive: true, errorOnExist: true, verbatimSymlinks: true });
      const originalSource = await readFile(sourceFile, 'utf8');
      const originalSha = hashBytes(originalSource);
      const testSha = await hashFile(testFile);
      if (originalSha !== verifiedPack.sourceSha256 || testSha !== verifiedPack.testSha256) throw new Error('Copied held-out project hash mismatch');

      const inspectDecision = ledger.consider({ candidateId: `${missionId}:baseline`, sourceSha256: originalSha, verified: true, score: 10, stepId: `${missionId}:step-01` });
      steps.push(step({ missionId, index: 0, phase: 'inspect', state: { repositoryId: verifiedPack.repositoryId, runtime: verifiedPack.runtime }, action: { type: 'inspect-hashes' }, expectedEffect: { sourceSha256: verifiedPack.sourceSha256, testSha256: verifiedPack.testSha256 }, actualEffect: { changed: true, informationGain: 1, sourceSha256: originalSha, testSha256: testSha }, verifier: { valid: true, status: 'pass' }, candidateSha256: originalSha, bestCandidateId: ledger.best()?.candidateId }));

      const baseline = await runCommand({ ...verifiedPack.command, cwd: workspaceProject });
      if (baseline.exitCode !== verifiedPack.expected.baselineExitCode) throw new Error('Baseline verifier outcome differed from expected exit code');
      steps.push(step({ missionId, index: 1, phase: 'baseline-test', parentStepId: steps.at(-1).id, state: { candidateSha256: originalSha }, action: { type: 'run-verifier', argv: verifiedPack.command.argv }, expectedEffect: { exitCode: verifiedPack.expected.baselineExitCode }, actualEffect: { changed: true, criterionDelta: 1, ...baseline }, verifier: { valid: true, status: 'pass' }, candidateSha256: originalSha, bestCandidateId: ledger.best()?.candidateId }));

      const mutated = replaceExact(originalSource, verifiedPack.mutation.from, verifiedPack.mutation.to, 'Mutation');
      await writeFile(sourceFile, mutated);
      const mutatedSha = hashBytes(mutated);
      steps.push(step({ missionId, index: 2, phase: 'mutate', parentStepId: steps.at(-1).id, state: { candidateSha256: originalSha }, action: { type: 'apply-declared-mutation', path: verifiedPack.sourcePath }, expectedEffect: { sourceSha256Changed: true }, actualEffect: { changed: true, sourceSha256: mutatedSha }, verifier: { valid: true, status: 'mutation-applied' }, candidateSha256: mutatedSha, bestCandidateId: ledger.best()?.candidateId }));

      const mutationRun = await runCommand({ ...verifiedPack.command, cwd: workspaceProject });
      if (mutationRun.exitCode !== verifiedPack.expected.mutationExitCode) throw new Error('Mutation verifier outcome differed from expected exit code');
      ledger.consider({ candidateId: `${missionId}:mutated`, sourceSha256: mutatedSha, verified: false, score: 20, stepId: `${missionId}:step-04` });
      steps.push(step({ missionId, index: 3, phase: 'mutation-test', parentStepId: steps.at(-1).id, state: { candidateSha256: mutatedSha }, action: { type: 'run-verifier', argv: verifiedPack.command.argv }, expectedEffect: { exitCode: verifiedPack.expected.mutationExitCode }, actualEffect: { changed: true, regressionDelta: 1, ...mutationRun }, verifier: { valid: true, status: 'expected-failure' }, candidateSha256: mutatedSha, bestCandidateId: ledger.best()?.candidateId }));

      const repaired = replaceExact(mutated, verifiedPack.repair.from, verifiedPack.repair.to, 'Repair');
      await writeFile(sourceFile, repaired);
      const repairedSha = hashBytes(repaired);
      steps.push(step({ missionId, index: 4, phase: 'repair', parentStepId: steps.at(-1).id, state: { candidateSha256: mutatedSha }, action: { type: 'apply-declared-repair', path: verifiedPack.sourcePath }, expectedEffect: { sourceSha256: originalSha }, actualEffect: { changed: true, recoveryDelta: 1, sourceSha256: repairedSha }, verifier: { valid: repairedSha === originalSha, status: repairedSha === originalSha ? 'pass' : 'fail' }, candidateSha256: repairedSha, bestCandidateId: ledger.best()?.candidateId }));
      if (repairedSha !== originalSha) throw new Error('Repair did not restore the declared source hash');

      const recovery = await runCommand({ ...verifiedPack.command, cwd: workspaceProject });
      if (recovery.exitCode !== verifiedPack.expected.recoveryExitCode) throw new Error('Recovery verifier outcome differed from expected exit code');
      ledger.consider({ candidateId: `${missionId}:recovered`, sourceSha256: repairedSha, verified: true, score: 10, stepId: `${missionId}:step-06` });
      steps.push(step({ missionId, index: 5, phase: 'recovery-test', parentStepId: steps.at(-1).id, state: { candidateSha256: repairedSha }, action: { type: 'run-verifier', argv: verifiedPack.command.argv }, expectedEffect: { exitCode: verifiedPack.expected.recoveryExitCode }, actualEffect: { changed: true, criterionDelta: 1, recoveryDelta: 1, ...recovery }, verifier: { valid: true, status: 'pass' }, candidateSha256: repairedSha, bestCandidateId: ledger.best()?.candidateId }));

      const finalSha = await hashFile(sourceFile);
      steps.push(step({ missionId, index: 6, phase: 'final-integrity', parentStepId: steps.at(-1).id, state: { candidateSha256: finalSha }, action: { type: 'verify-integrity' }, expectedEffect: { sourceSha256: originalSha }, actualEffect: { changed: true, informationGain: 1, sourceSha256: finalSha }, verifier: { valid: finalSha === originalSha, status: finalSha === originalSha ? 'pass' : 'fail' }, candidateSha256: finalSha, bestCandidateId: ledger.best()?.candidateId }));
      if (finalSha !== originalSha) throw new Error('Final mission integrity verification failed');

      const ledgerSnapshot = ledger.snapshot();
      resultBase = {
        schema: 'nolane.small-model.mission-trajectory.v1', missionId, repositoryId: verifiedPack.repositoryId, runtime: verifiedPack.runtime,
        status: 'verified-recovery', steps, stepCount: steps.length, bestCandidate: ledger.best(), bestCandidateLedger: ledgerSnapshot,
        bestCandidatePreserved: ledgerSnapshot.regressionsRejected >= 1 && ledger.best()?.sourceSha256 === originalSha,
        trackedSourceUnchanged: (await hashFile(path.resolve(root, verifiedPack.rootPath, verifiedPack.sourcePath))) === verifiedPack.sourceSha256,
        declaredMutation: { ...verifiedPack.mutation }, declaredRepair: { ...verifiedPack.repair },
        trainingRepositoryDisjoint: true, hiddenChainOfThoughtStored: false,
      };
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
    if (!resultBase) throw new Error('Mission trajectory did not produce a result');
    return withReceipt({ ...resultBase, workspaceRemoved: true });
  }
}
