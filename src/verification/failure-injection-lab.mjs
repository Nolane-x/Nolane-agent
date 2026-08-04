import { boundedNumber, signed, text } from '../construction/construction-utils.mjs';

const HASH = /^[a-f0-9]{64}$/i;
const FAULTS = new Set(['network-loss', 'process-death', 'database-lock', 'stale-file-race', 'memory-pressure']);

function receipt(value, label) {
  const out = String(value ?? '').toLowerCase();
  if (!HASH.test(out)) throw new TypeError(`${label} must be SHA-256`);
  return out;
}

function adapter(value, method, label) {
  if (!value || typeof value[method] !== 'function') throw new TypeError(`${label}.${method} is required`);
  return value;
}

export class FailureInjectionLab {
  constructor({ clock = Date.now } = {}) {
    if (typeof clock !== 'function') throw new TypeError('clock must be a function');
    this.clock = clock;
  }

  async run({ taskId, criterionId, faultType, lease = {}, checkpointAdapter, faultAdapter, operation, recoveryAdapter, verify } = {}) {
    const task = text(taskId, 'taskId', 512);
    const criterion = text(criterionId, 'criterionId', 512);
    const fault = text(faultType, 'faultType', 128);
    if (!FAULTS.has(fault)) throw new TypeError(`Unsupported fault type: ${fault}`);
    const maxAttempts = Math.trunc(boundedNumber(lease.maxAttempts, 1, 1, 5, 'lease.maxAttempts'));
    const maxDurationMs = boundedNumber(lease.maxDurationMs, 30_000, 1, 300_000, 'lease.maxDurationMs');
    adapter(checkpointAdapter, 'save', 'checkpointAdapter');
    adapter(checkpointAdapter, 'resume', 'checkpointAdapter');
    adapter(faultAdapter, 'inject', 'faultAdapter');
    adapter(faultAdapter, 'clear', 'faultAdapter');
    adapter(recoveryAdapter, 'recover', 'recoveryAdapter');
    if (typeof operation !== 'function' || typeof verify !== 'function') throw new TypeError('operation and verify are required');

    const startedAt = Number(this.clock());
    const checkpoint = await checkpointAdapter.save({ taskId: task, criterionId: criterion });
    const checkpointRecord = Object.freeze({ checkpointId: text(checkpoint?.checkpointId, 'checkpointId', 512), sourceHash: receipt(checkpoint?.sourceHash, 'checkpoint.sourceHash'), receiptSha256: receipt(checkpoint?.receiptSha256, 'checkpoint.receiptSha256') });
    let attempts = 0;
    let injection;
    let operationResult;
    let recovery;
    let resumed;
    let cleared;
    let verification;
    let capturedError = null;

    try {
      attempts += 1;
      injection = await faultAdapter.inject({ taskId: task, criterionId: criterion, faultType: fault, attempt: attempts, lease: { maxAttempts, maxDurationMs } });
      receipt(injection?.receiptSha256, 'injection.receiptSha256');
      try {
        operationResult = await operation({ taskId: task, criterionId: criterion, faultType: fault, checkpoint: checkpointRecord });
      } catch (error) {
        capturedError = String(error?.message ?? error).slice(0, 500);
        operationResult = { status: 'failed', irreversibleActions: 0, receiptSha256: receipt(error?.receiptSha256 ?? '0'.repeat(64), 'operation error receipt') };
      }
      receipt(operationResult?.receiptSha256, 'operation.receiptSha256');
      recovery = await recoveryAdapter.recover({ taskId: task, criterionId: criterion, faultType: fault, checkpoint: checkpointRecord, operation: operationResult, capturedError });
      receipt(recovery?.receiptSha256, 'recovery.receiptSha256');
      resumed = await checkpointAdapter.resume(checkpointRecord);
      receipt(resumed?.receiptSha256, 'resume.receiptSha256');
    } finally {
      cleared = await faultAdapter.clear({ taskId: task, criterionId: criterion, faultType: fault });
      receipt(cleared?.receiptSha256, 'clear.receiptSha256');
    }
    verification = await verify({ taskId: task, criterionId: criterion, checkpoint: checkpointRecord, recovery, resumed });
    receipt(verification?.receiptSha256, 'verification.receiptSha256');
    const finishedAt = Number(this.clock());
    const irreversibleActions = Math.max(0, Math.trunc(Number(operationResult?.irreversibleActions ?? 0)));
    const reasons = [];
    if (attempts > maxAttempts) reasons.push('attempt-budget-exceeded');
    if (finishedAt - startedAt > maxDurationMs) reasons.push('duration-budget-exceeded');
    if (injection?.status !== 'injected' || injection?.reversible !== true) reasons.push('fault-not-bounded-reversible');
    if (irreversibleActions > 0) reasons.push('irreversible-action-during-uncertainty');
    if (recovery?.status !== 'pass') reasons.push('recovery-failed');
    if (resumed?.status !== 'pass' || resumed?.checkpointId !== checkpointRecord.checkpointId) reasons.push('checkpoint-resume-failed');
    if (cleared?.status !== 'pass') reasons.push('fault-clear-failed');
    if (verification?.status !== 'pass' || verification?.criterionId !== criterion) reasons.push('criterion-not-reverified');

    return signed({
      schema: 'forge.failure-injection-proof.v1',
      taskId: task,
      criterionId: criterion,
      faultType: fault,
      lease: { maxAttempts, maxDurationMs },
      attempts,
      startedAt,
      finishedAt,
      durationMs: Math.max(0, finishedAt - startedAt),
      checkpoint: checkpointRecord,
      injection: { status: injection?.status ?? null, reversible: injection?.reversible === true, receiptSha256: injection?.receiptSha256 ?? null },
      operation: { status: operationResult?.status ?? null, receiptSha256: operationResult?.receiptSha256 ?? null, capturedError },
      recovery: { status: recovery?.status ?? null, strategy: recovery?.strategy ?? null, receiptSha256: recovery?.receiptSha256 ?? null },
      resume: { status: resumed?.status ?? null, checkpointId: resumed?.checkpointId ?? null, receiptSha256: resumed?.receiptSha256 ?? null },
      clear: { status: cleared?.status ?? null, receiptSha256: cleared?.receiptSha256 ?? null },
      verification: { status: verification?.status ?? null, criterionId: verification?.criterionId ?? null, receiptSha256: verification?.receiptSha256 ?? null },
      irreversibleActions,
      reasons,
      status: reasons.length ? 'fail' : 'pass',
      claims: { directOsFaultInjected: false, irreversibleActionAllowedDuringUncertainty: false, criterionReverifiedAfterRecovery: verification?.status === 'pass' },
    });
  }
}
