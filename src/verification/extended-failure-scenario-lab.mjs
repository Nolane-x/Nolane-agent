import { signed, text } from '../construction/construction-utils.mjs';

const SCENARIOS = new Set(['network-loss', 'network-timeout', 'dns-failure', 'provider-overload', 'memory-pressure', 'process-death', 'orphan-child', 'fd-exhaustion', 'database-lock', 'disk-full', 'stale-file-race']);
const SHA = /^[a-f0-9]{64}$/i;
function receipt(value, label) { const out = String(value ?? '').toLowerCase(); if (!SHA.test(out)) throw new TypeError(`${label} must be SHA-256`); return out; }

export class ExtendedFailureScenarioLab {
  constructor({ clock = Date.now } = {}) { this.clock = clock; }
  async run({ taskId, criterionId, scenario, checkpointAdapter, faultAdapter, operation, recoveryAdapter, verify } = {}) {
    const task = text(taskId, 'taskId', 512); const criterion = text(criterionId, 'criterionId', 512); const kind = text(scenario, 'scenario', 128);
    if (!SCENARIOS.has(kind)) throw new TypeError(`Unsupported failure scenario: ${kind}`);
    for (const [object, method, label] of [[checkpointAdapter,'save','checkpointAdapter'],[checkpointAdapter,'resume','checkpointAdapter'],[faultAdapter,'inject','faultAdapter'],[faultAdapter,'clear','faultAdapter'],[recoveryAdapter,'recover','recoveryAdapter']]) if (!object || typeof object[method] !== 'function') throw new TypeError(`${label}.${method} is required`);
    if (typeof operation !== 'function' || typeof verify !== 'function') throw new TypeError('operation and verify are required');
    const startedAt = Number(this.clock());
    const checkpoint = await checkpointAdapter.save({ taskId: task, criterionId: criterion });
    receipt(checkpoint?.receiptSha256, 'checkpoint.receiptSha256'); receipt(checkpoint?.sourceHash, 'checkpoint.sourceHash');
    let injection; let operationResult; let recovery; let resumed; let cleared;
    try {
      injection = await faultAdapter.inject({ taskId: task, criterionId: criterion, scenario: kind, reversible: true }); receipt(injection?.receiptSha256, 'injection.receiptSha256');
      try { operationResult = await operation({ taskId: task, criterionId: criterion, scenario: kind, checkpoint }); }
      catch (error) { operationResult = { status: 'failed', irreversibleActions: 0, receiptSha256: error?.receiptSha256 ?? '0'.repeat(64) }; }
      receipt(operationResult?.receiptSha256, 'operation.receiptSha256');
      recovery = await recoveryAdapter.recover({ taskId: task, criterionId: criterion, scenario: kind, checkpoint, operation: operationResult }); receipt(recovery?.receiptSha256, 'recovery.receiptSha256');
      resumed = await checkpointAdapter.resume(checkpoint); receipt(resumed?.receiptSha256, 'resume.receiptSha256');
    } finally {
      cleared = await faultAdapter.clear({ taskId: task, criterionId: criterion, scenario: kind }); receipt(cleared?.receiptSha256, 'clear.receiptSha256');
    }
    const verification = await verify({ taskId: task, criterionId: criterion, scenario: kind, checkpoint, recovery, resumed }); receipt(verification?.receiptSha256, 'verification.receiptSha256');
    const reasons = [];
    if (injection?.status !== 'injected' || injection?.reversible !== true) reasons.push('fault-not-bounded-reversible');
    if (Number(operationResult?.irreversibleActions ?? 0) > 0) reasons.push('irreversible-action-during-uncertainty');
    if (recovery?.status !== 'pass') reasons.push('recovery-failed');
    if (resumed?.status !== 'pass' || resumed?.checkpointId !== checkpoint.checkpointId) reasons.push('checkpoint-resume-failed');
    if (cleared?.status !== 'pass') reasons.push('fault-clear-failed');
    if (verification?.status !== 'pass' || verification?.criterionId !== criterion) reasons.push('criterion-not-reverified');
    const finishedAt = Number(this.clock());
    return signed({ schema: 'forge.extended-failure-proof.v1', taskId: task, criterionId: criterion, scenario: kind, status: reasons.length ? 'fail' : 'pass', reasons, durationMs: Math.max(0, finishedAt - startedAt), checkpoint: { checkpointId: checkpoint.checkpointId, sourceHash: checkpoint.sourceHash, receiptSha256: checkpoint.receiptSha256 }, injection: { status: injection?.status ?? null, reversible: injection?.reversible === true, receiptSha256: injection?.receiptSha256 ?? null }, operation: { status: operationResult?.status ?? null, irreversibleActions: Number(operationResult?.irreversibleActions ?? 0), receiptSha256: operationResult?.receiptSha256 ?? null }, recovery: { status: recovery?.status ?? null, strategy: recovery?.strategy ?? null, receiptSha256: recovery?.receiptSha256 ?? null }, resume: { status: resumed?.status ?? null, checkpointId: resumed?.checkpointId ?? null, receiptSha256: resumed?.receiptSha256 ?? null }, clear: { status: cleared?.status ?? null, receiptSha256: cleared?.receiptSha256 ?? null }, verification: { status: verification?.status ?? null, criterionId: verification?.criterionId ?? null, receiptSha256: verification?.receiptSha256 ?? null }, claims: { directHostFaultInjected: false, criterionReverifiedAfterRecovery: verification?.status === 'pass' } });
  }
}
