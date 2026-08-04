import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { canonicalSha256, deepFreeze } from './shared.mjs';
import { verifyHeldOutPack } from './checkpoint-7-heldout-pack.mjs';
import { SolverSandbox } from './solver-sandbox.mjs';
import { SymbolicSolverCompiler } from './symbolic-solver-compiler.mjs';

const hashBytes = (value) => createHash('sha256').update(value).digest('hex');
const hashFile = async (file) => hashBytes(await readFile(file));

async function runCommand({ argv, timeoutMs }, cwd) {
  const env = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', PYTHONDONTWRITEBYTECODE: '1' };
  delete env.NODE_TEST_CONTEXT;
  return await new Promise((resolve, reject) => {
    const child = spawn(argv[0], argv.slice(1), { cwd, shell: false, windowsHide: true, env });
    const chunks = []; let bytes = 0; let timedOut = false;
    const onData = (chunk) => { bytes += chunk.length; if (bytes > 1_000_000) { child.kill('SIGKILL'); return reject(new Error('Skill transfer output budget exceeded')); } chunks.push(chunk); };
    child.stdout.on('data', onData); child.stderr.on('data', onData); child.on('error', reject);
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
    child.on('close', (code) => { clearTimeout(timer); if (timedOut) return reject(new Error('Skill transfer timed out')); const output = Buffer.concat(chunks); resolve({ exitCode: Number(code ?? -1), outputSha256: hashBytes(output), outputBytes: output.length }); });
  });
}

function executeSingleOperation(operation, input, id) {
  return new SolverSandbox().execute({ solver: { id, version: '1', definition: { kind: 'text-rewrite', operations: [operation] } }, input });
}

export class SkillTransferLab {
  async verify({ root = process.cwd(), skill, sourceRepositoryIds = [], heldOutPack } = {}) {
    if (!skill || skill.schema !== 'nolane.small-model.verified-skill.v1' || !skill.solver) throw new TypeError('Verified declarative skill is required');
    const verifiedPack = await verifyHeldOutPack({ root, pack: heldOutPack, trainingRepositoryIds: sourceRepositoryIds });
    const operation = skill.solver.definition.operations?.[0];
    const rollbackOperation = skill.solver.definition.rollbackOperation;
    if (!operation || !rollbackOperation || operation.from !== verifiedPack.repair.from || operation.to !== verifiedPack.repair.to || rollbackOperation.from !== operation.to || rollbackOperation.to !== operation.from) throw new Error('Held-out repair pattern is outside the skill soundness scope');
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'nolane-cp7-skill-transfer-'));
    const project = path.join(workspace, verifiedPack.repositoryId);
    let resultBase = null;
    try {
      await cp(path.resolve(root, verifiedPack.rootPath), project, { recursive: true, errorOnExist: true, verbatimSymlinks: true });
      const source = path.join(project, verifiedPack.sourcePath);
      const originalText = await readFile(source, 'utf8');
      const mutatedText = originalText.replace(verifiedPack.mutation.from, verifiedPack.mutation.to);
      if (mutatedText === originalText) throw new Error('Held-out mutation pattern was not found');
      await writeFile(source, mutatedText);
      const inputHash = canonicalSha256(mutatedText);
      const applied = new SolverSandbox().execute({ solver: skill.solver, input: mutatedText });
      if (applied.status !== 'applied' || applied.appliedOperations !== 1) throw new Error('Skill solver abstained or applied outside its bound');
      await writeFile(source, applied.output);
      const test = await runCommand(verifiedPack.command, project);
      if (test.exitCode !== 0) throw new Error('Transferred skill did not pass the held-out verifier');
      const rollback = executeSingleOperation(rollbackOperation, applied.output, `${skill.id}:rollback`);
      if (rollback.status !== 'applied' || rollback.outputSha256 !== inputHash) throw new Error('Skill rollback did not restore the pre-skill input hash');
      const transfer = new SymbolicSolverCompiler().gateTransfer({ solverId: skill.id, sourceDomain: sourceRepositoryIds.join(','), heldOut: [{ repositoryId: verifiedPack.repositoryId, tuned: false, passed: true }] });
      resultBase = {
        schema: 'nolane.small-model.skill-transfer-verification.v1', status: 'pass', skillId: skill.id, skillReceiptSha256: skill.receiptSha256,
        repositoryId: verifiedPack.repositoryId, sourceRepositoryIds: [...sourceRepositoryIds].map(String).sort(), repositoryDisjoint: true,
        solverApplied: true, testPassed: true, rollbackRestoredInputHash: true, transferReceiptSha256: transfer.receiptSha256,
        inputSha256: inputHash, outputSha256: applied.outputSha256, testOutputSha256: test.outputSha256,
        trackedSourceUnchanged: (await hashFile(path.resolve(root, verifiedPack.rootPath, verifiedPack.sourcePath))) === verifiedPack.sourceSha256,
        shellUsed: false, hiddenChainOfThoughtStored: false,
        claims: { boundedTransfer: true, generalCodingIntelligence: false, competitorSuperiority: false },
      };
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
    if (!resultBase) throw new Error('Skill transfer did not produce a result');
    const base = { ...resultBase, workspaceRemoved: true };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
}
