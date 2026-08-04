import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}
function text(value, label, max = 256) {
  const output = String(value ?? '').trim();
  if (!output) throw new TypeError(`${label} is required`);
  if (output.length > max) throw new TypeError(`${label} is too long`);
  return output;
}
function signed(base) { return freeze({ ...base, receiptSha256: canonicalSha256(base) }); }

export class ResourceLifecycleCoordinator {
  constructor({ admissionController, processLedger = null, processDriver = null, adapters = {}, clock = () => Date.now() } = {}) {
    if (!admissionController?.getLease || !admissionController?.release) throw new TypeError('admission controller with getLease() and release() is required');
    this.admission = admissionController;
    this.processLedger = processLedger;
    this.processDriver = processDriver;
    this.adapters = new Map(Object.entries(adapters ?? {}));
    this.clock = clock;
    this.journal = [];
    this.closed = false;
  }

  async stopMission({ missionId, leaseIds = [], reason = 'mission-stopped' } = {}) {
    if (this.closed) throw new Error('Resource lifecycle coordinator is closed');
    const mission = text(missionId, 'missionId');
    if (!Array.isArray(leaseIds)) throw new TypeError('leaseIds must be an array');
    const terminated = [];
    const skipped = [];
    const ledgerEntries = this.processLedger?.snapshot ? (this.processLedger.snapshot({ missionId: mission })?.entries ?? []) : [];

    for (const rawLeaseId of [...new Set(leaseIds.map(String))].slice(0, 2_000)) {
      const lease = this.admission.getLease(rawLeaseId);
      if (!lease) { skipped.push(freeze({ leaseId: rawLeaseId, reason: 'unknown-lease' })); continue; }
      if (lease.missionId !== mission) { skipped.push(freeze({ leaseId: lease.leaseId, reason: 'mission-ownership-mismatch' })); continue; }

      if (lease.processRoot != null) {
        const identity = ledgerEntries.find((entry) => entry.missionId === mission && Number(entry.rootPid) === Number(lease.processRoot) && entry.state !== 'exited');
        if (!identity) { skipped.push(freeze({ leaseId: lease.leaseId, resourceId: lease.resourceId, reason: 'process-identity-mismatch' })); continue; }
        if (!this.processDriver?.terminateTree) { skipped.push(freeze({ leaseId: lease.leaseId, resourceId: lease.resourceId, reason: 'process-driver-unavailable' })); continue; }
        try {
          const result = await this.processDriver.terminateTree(lease.processRoot, { signal: 'SIGTERM' });
          const closed = this.admission.release(lease.leaseId, { atMs: this.clock(), reason });
          terminated.push(freeze({ leaseId: lease.leaseId, resourceId: lease.resourceId, processRoot: lease.processRoot, terminatedPids: freeze([...(result?.terminated ?? [])]), closeReceiptSha256: closed.receiptSha256 }));
        } catch (error) {
          skipped.push(freeze({ leaseId: lease.leaseId, resourceId: lease.resourceId, reason: 'termination-failed', errorCode: String(error?.code ?? 'UNKNOWN').slice(0, 128) }));
        }
        continue;
      }

      const adapter = this.adapters.get(lease.kind);
      if (!adapter?.terminate) { skipped.push(freeze({ leaseId: lease.leaseId, resourceId: lease.resourceId, reason: 'adapter-unavailable' })); continue; }
      try {
        await adapter.terminate({ leaseId: lease.leaseId, resourceId: lease.resourceId, missionId: mission });
        const closed = this.admission.release(lease.leaseId, { atMs: this.clock(), reason });
        terminated.push(freeze({ leaseId: lease.leaseId, resourceId: lease.resourceId, processRoot: null, terminatedPids: freeze([]), closeReceiptSha256: closed.receiptSha256 }));
      } catch (error) {
        skipped.push(freeze({ leaseId: lease.leaseId, resourceId: lease.resourceId, reason: 'adapter-termination-failed', errorCode: String(error?.code ?? 'UNKNOWN').slice(0, 128) }));
      }
    }

    const event = signed({ schema: 'forge.resource-lifecycle-stop-mission.v1', missionId: mission, reason: String(reason).slice(0, 512), terminated: freeze(terminated), skipped: freeze(skipped), stoppedAtMs: Math.trunc(Number(this.clock())), claims: { unmatchedProcessKilled: false, rawCommandsStored: false } });
    this.journal.push(event);
    if (this.journal.length > 1_000) this.journal.splice(0, this.journal.length - 1_000);
    return event;
  }

  snapshot() {
    return signed({ schema: 'forge.resource-lifecycle-coordinator-snapshot.v1', closed: this.closed, events: freeze(this.journal.slice(-100).map((item) => ({ missionId: item.missionId, terminatedCount: item.terminated.length, skippedCount: item.skipped.length, receiptSha256: item.receiptSha256, stoppedAtMs: item.stoppedAtMs }))), claims: { rawCommandsStored: false } });
  }

  close() { this.closed = true; return this.snapshot(); }
}
