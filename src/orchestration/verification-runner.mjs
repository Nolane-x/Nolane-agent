import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

function commandInput(value) {
  if (!value || typeof value !== 'object') throw new TypeError('Verification command must be an object');
  const command = String(value.command ?? '').trim();
  if (!command) throw new TypeError('Verification command is required');
  if (!Array.isArray(value.args) || value.args.some((item) => typeof item !== 'string')) throw new TypeError('Verification command args must be strings');
  return { command, args: [...value.args], cwd: String(value.cwd ?? '.'), timeoutMs: value.timeoutMs };
}

function evidenceFor({ kind, label, result, commit, artifactSha256, metadata = {} }) {
  const status = result.status === 'pass' ? 'pass' : 'fail';
  return Object.freeze({
    kind,
    status,
    commit,
    artifactSha256,
    receiptSha256: result.receipt.receiptSha256,
    summary: status === 'pass' ? `${label} passed.` : `${label} failed with exit code ${result.output.exitCode}.`,
    command: result.output.command,
    args: result.output.args,
    exitCode: result.output.exitCode,
    durationMs: result.receipt.durationMs,
    ...metadata,
  });
}

function testEvidenceFor({ scope, result, commit, artifactSha256 }) {
  const status = result.status === 'pass' ? 'pass' : 'fail';
  return Object.freeze({
    kind: `test-${scope}`,
    status,
    commit,
    artifactSha256,
    receiptSha256: result.receipt.receiptSha256,
    summary: status === 'pass' ? `${scope} test gate passed.` : `${scope} test gate failed with exit code ${result.output?.exitCode ?? 'unknown'}.`,
    command: result.step?.command ?? null,
    args: result.step?.args ?? [],
    exitCode: result.output?.exitCode ?? null,
    durationMs: result.receipt.durationMs ?? null,
    framework: result.framework?.id ?? result.receipt.framework ?? null,
  });
}

function syntheticEvidence({ kind, status, summary, commit, artifactSha256, payload = {} }) {
  const base = { schema: 'forge.verification.synthetic-evidence.v1', kind, status, summary, commit, artifactSha256, payload };
  return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
}

function artifactEvidence({ artifact, result, commit, artifactSha256 }) {
  const base = {
    schema: 'forge.verification.artifact-evidence.v1',
    kind: 'required-artifact',
    status: result.status === 'pass' ? 'pass' : 'fail',
    summary: result.status === 'pass' ? `Required artifact ${artifact} exists.` : `Required artifact ${artifact} is unavailable.`,
    commit,
    artifactSha256,
    artifact,
    fileSha256: result.output?.sha256 ?? null,
    bytes: result.output?.fileBytes ?? result.output?.bytes ?? null,
    sourceReceiptSha256: result.receipt?.receiptSha256 ?? null,
  };
  return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
}

function criterionSourceHash(criterion = {}) {
  const explicit = String(criterion.sourceHash ?? '').trim().toLowerCase();
  if (explicit) {
    if (!/^[a-f0-9]{64}$/.test(explicit)) throw new TypeError(`Success criterion ${criterion.id ?? ''} sourceHash must be SHA-256`);
    return explicit;
  }
  return canonicalSha256({ id: criterion.id, description: criterion.description, verification: criterion.verification });
}

function criterionVerificationReceipt({ taskId, criterion, evidence, commit, artifactSha256 }) {
  const base = {
    schema: 'forge.acceptance-criterion-verification.v1',
    taskId,
    criterionId: String(criterion.id),
    status: evidence.status === 'pass' ? 'pass' : 'fail',
    sourceHash: criterionSourceHash(criterion),
    verifier: 'success-criterion',
    evidenceReceiptSha256: evidence.receiptSha256,
    commit,
    artifactSha256,
  };
  return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
}

export class VerificationRunner {
  constructor({ store, brokerFactory, testEngineFactory = null, environmentService = null } = {}) {
    if (!store || typeof brokerFactory !== 'function') throw new TypeError('VerificationRunner store and brokerFactory are required');
    this.store = store;
    this.brokerFactory = brokerFactory;
    this.testEngineFactory = testEngineFactory;
    this.environmentService = environmentService;
  }

  async runTask(taskId, { signal = null } = {}) {
    const task = this.store.getTask(taskId);
    if (!task) throw new Error(`Unknown task: ${taskId}`);
    if (task.status !== 'review') throw new Error(`Task ${taskId} must be in review before verification`);
    const broker = this.brokerFactory(task);
    const context = { signal, refs: { projectId: task.projectId, missionId: task.missionId, taskId: task.id, verification: true } };

    const head = await broker.execute({ tool: 'process.run', input: { command: 'git', args: ['rev-parse', 'HEAD'], cwd: '.' } }, context);
    if (head.status !== 'pass') throw new Error('Unable to resolve the candidate commit');
    const commit = head.output.stdout.trim();
    if (!/^[a-f0-9]{40,64}$/i.test(commit)) throw new Error('Candidate commit is invalid');

    const diff = await broker.execute({ tool: 'process.run', input: { command: 'git', args: ['diff', '--binary', 'HEAD'], cwd: '.', maxOutputBytes: undefined } }, context);
    if (diff.status !== 'pass') throw new Error('Unable to capture the candidate diff');
    if (diff.output?.truncated === true) throw new Error('Candidate diff was truncated; complete diff evidence is required');
    const artifactSha256 = canonicalSha256(diff.output.stdout);
    const evidence = [];
    const criterionReceipts = [];

    const diffCheck = await broker.execute({ tool: 'process.run', input: { command: 'git', args: ['diff', '--check', 'HEAD'], cwd: '.' } }, context);
    evidence.push(evidenceFor({ kind: 'diff-check', label: 'Git diff integrity check', result: diffCheck, commit, artifactSha256 }));

    const verificationPyramid = task.metadata?.verificationPyramid;
    const verificationStageCommands = task.metadata?.verificationStageCommands ?? {};
    for (const stage of verificationPyramid?.stages ?? []) {
      if (stage?.required !== true) continue;
      const stageKind = String(stage.kind ?? '').trim();
      if (!stageKind) {
        evidence.push(syntheticEvidence({
          kind: 'verification-stage-invalid',
          status: 'fail',
          summary: 'A required verification pyramid stage has no kind.',
          commit,
          artifactSha256,
        }));
        continue;
      }
      const rawCommands = verificationStageCommands?.[stageKind];
      if (!Array.isArray(rawCommands) || rawCommands.length === 0) {
        evidence.push(syntheticEvidence({
          kind: `verification-stage-${stageKind}`,
          status: 'fail',
          summary: `Required verification stage ${stageKind} has no command.`,
          commit,
          artifactSha256,
          payload: { stageKind },
        }));
        continue;
      }
      for (let index = 0; index < rawCommands.length; index += 1) {
        const command = commandInput(rawCommands[index]);
        const result = await broker.execute({ tool: 'process.run', input: command }, context);
        evidence.push(evidenceFor({
          kind: `verification-stage-${stageKind}`,
          label: `Verification stage ${stageKind} command ${index + 1}`,
          result,
          commit,
          artifactSha256,
          metadata: { stageKind },
        }));
      }
    }

    const matrix = task.metadata?.testMatrix;
    let fullMatrixCompleted = matrix?.requireFull !== true;
    if (matrix && this.testEngineFactory) {
      try {
        const engine = this.testEngineFactory(task);
        const plan = await engine.plan({ changedPaths: matrix.changedPaths ?? [], relatedTests: matrix.relatedTests ?? [], includeFull: matrix.requireFull !== false });
        const scopes = [];
        for (const step of plan.steps ?? []) {
          const input = { scope: step.scope, timeoutMs: matrix.timeoutMs, signal };
          if (step.path) input.path = step.path;
          else if (step.scope === 'file' && matrix.relatedTests?.[0]) input.path = matrix.relatedTests[0];
          else if (step.scope === 'module' && matrix.relatedTests?.[0]) input.path = matrix.relatedTests[0].split('/').slice(0, -1).join('/') || 'tests';
          const result = await engine.run(input);
          scopes.push(step.scope);
          evidence.push(testEvidenceFor({ scope: step.scope, result, commit, artifactSha256 }));
        }
        fullMatrixCompleted = scopes.includes('full');
        if (matrix.requireFull === true && !fullMatrixCompleted) {
          evidence.push(syntheticEvidence({ kind: 'test-full-gate', status: 'fail', summary: 'Required full test gate was not present in the verification plan.', commit, artifactSha256, payload: { scopes } }));
        }
      } catch (error) {
        fullMatrixCompleted = false;
        evidence.push(syntheticEvidence({ kind: 'test-matrix', status: 'fail', summary: `Test matrix could not be completed: ${String(error?.message ?? error).slice(0, 500)}`, commit, artifactSha256, payload: { code: error?.code ?? null } }));
      }
    } else if (matrix?.requireFull === true) {
      fullMatrixCompleted = false;
      evidence.push(syntheticEvidence({ kind: 'test-full-gate', status: 'fail', summary: 'A full test matrix is required but no test engine is configured.', commit, artifactSha256 }));
    }

    const successCriteria = task.metadata?.taskContract?.successCriteria ?? [];
    const taskContractCommands = successCriteria.map((criterion) => ({ ...commandInput({ ...criterion.verification, cwd: '.' }), criterionId: criterion.id, criterionDescription: criterion.description, criterion }));
    const metadataCommands = Array.isArray(task.metadata?.verificationCommands) ? task.metadata.verificationCommands.map((value) => ({ ...commandInput(value), criterionId: null, criterionDescription: null })) : [];
    const commands = [...metadataCommands, ...taskContractCommands];
    for (let index = 0; index < commands.length; index += 1) {
      const command = commands[index];
      const result = await broker.execute({ tool: 'process.run', input: command }, context);
      const evidenceItem = evidenceFor({
        kind: command.criterionId ? 'success-criterion' : 'verification-command',
        label: command.criterionId ? `Success criterion ${command.criterionId}` : `Verification command ${index + 1}`,
        result,
        commit,
        artifactSha256,
        metadata: command.criterionId ? { criterionId: command.criterionId, criterionDescription: command.criterionDescription, criterionSourceHash: criterionSourceHash(command.criterion) } : {},
      });
      evidence.push(evidenceItem);
      if (command.criterionId) criterionReceipts.push(criterionVerificationReceipt({ taskId: task.id, criterion: command.criterion, evidence: evidenceItem, commit, artifactSha256 }));
    }

    for (const artifact of task.metadata?.taskContract?.outputContract?.requiredArtifacts ?? []) {
      try {
        const result = await broker.execute({ tool: 'fs.read', input: { path: artifact, headLines: 1 } }, context);
        evidence.push(artifactEvidence({ artifact, result, commit, artifactSha256 }));
      } catch (error) {
        evidence.push(syntheticEvidence({ kind: 'required-artifact', status: 'fail', summary: `Required artifact ${artifact} is unavailable.`, commit, artifactSha256, payload: { artifact, code: error?.code ?? null } }));
      }
    }

    for (const requirement of task.metadata?.environmentRequirements ?? []) {
      const environmentId = String(requirement?.id ?? '').trim();
      const allowedStates = Array.isArray(requirement?.allowedStates) && requirement.allowedStates.length ? [...new Set(requirement.allowedStates.map(String))] : ['healthy'];
      if (!environmentId) {
        evidence.push(syntheticEvidence({ kind: 'environment-health', status: 'fail', summary: 'Environment verification requirement is missing an id.', commit, artifactSha256 }));
        continue;
      }
      if (!this.environmentService?.status) {
        evidence.push(syntheticEvidence({ kind: 'environment-health', status: 'fail', summary: `Required environment ${environmentId} cannot be verified because environment supervision is unavailable.`, commit, artifactSha256, payload: { environmentId, allowedStates } }));
        continue;
      }
      try {
        const state = await this.environmentService.status(environmentId, { projectId: task.projectId });
        const status = allowedStates.includes(String(state.state)) ? 'pass' : 'fail';
        evidence.push(syntheticEvidence({
          kind: 'environment-health', status,
          summary: status === 'pass' ? `Environment ${environmentId} is ${state.state}.` : `Environment ${environmentId} is ${state.state}; expected ${allowedStates.join(' or ')}.`,
          commit, artifactSha256,
          payload: { environmentId, projectId: task.projectId, state: state.state, allowedStates, environmentReceiptSha256: state.receiptSha256 ?? state.operationReceiptSha256 ?? null, lastHealth: state.lastHealth ?? null },
        }));
      } catch (error) {
        evidence.push(syntheticEvidence({ kind: 'environment-health', status: 'fail', summary: `Environment ${environmentId} verification failed.`, commit, artifactSha256, payload: { environmentId, allowedStates, code: error?.code ?? null } }));
      }
    }

    const verifiedCriterionIds = criterionReceipts.filter((item) => item.status === 'pass').map((item) => item.criterionId).sort();
    const verifiedSet = new Set(verifiedCriterionIds);
    const unverifiedCriterionIds = successCriteria.map((criterion) => String(criterion.id)).filter((id) => !verifiedSet.has(id)).sort();
    const criteria = Object.freeze({
      schema: 'forge.verification-criteria-binding.v1',
      verifiedCriterionIds: Object.freeze(verifiedCriterionIds),
      unverifiedCriterionIds: Object.freeze(unverifiedCriterionIds),
      receipts: Object.freeze(criterionReceipts),
      receiptSha256: canonicalSha256({ taskId: task.id, verifiedCriterionIds, unverifiedCriterionIds, receiptSha256: criterionReceipts.map((item) => item.receiptSha256) }),
    });
    return Object.freeze({
      schema: 'forge.verification.report.v1',
      taskId: task.id,
      status: evidence.every((item) => item.status === 'pass') && fullMatrixCompleted && unverifiedCriterionIds.length === 0 ? 'pass' : 'fail',
      commit,
      artifactSha256,
      diffBytes: Buffer.byteLength(diff.output.stdout),
      fullMatrixCompleted,
      evidence: Object.freeze(evidence),
      criteria,
    });
  }
}
