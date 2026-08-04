import { signed, text } from '../construction/construction-utils.mjs';
import { classifyBenchmarkFailure } from './failure-taxonomy.mjs';

export class RunEvidenceJournal {
  constructor({ maxEntries = 10_000 } = {}) { this.maxEntries = maxEntries; this.entries = []; }
  record(run = {}) {
    const failure = classifyBenchmarkFailure(run);
    const entry = signed({
      schema: 'forge.benchmark-run-evidence.v1',
      system: text(run.system, 'system', 512),
      taskId: text(run.taskId, 'taskId', 512),
      verified: run.verified === true,
      budgetExceeded: run.budgetExceeded === true,
      agentExitCode: Number(run.agentExitCode ?? -1),
      failureClass: failure.code,
      resources: { peakRssMb: Number(run.resources?.peakRssMb ?? 0), rssMbSeconds: Number(run.resources?.rssMbSeconds ?? 0), processCount: Number(run.resources?.processCount ?? 0) },
      corrections: { cycles: Number(run.corrections?.cycles ?? 0), revertedLines: Number(run.corrections?.revertedLines ?? 0), humanInterventions: Number(run.corrections?.humanInterventions ?? 0) },
      adapterHash: run.adapterHash ? String(run.adapterHash) : null,
      patchHash: run.patchHash ? String(run.patchHash) : null,
      stdoutHash: run.stdoutHash ? String(run.stdoutHash) : null,
      stderrHash: run.stderrHash ? String(run.stderrHash) : null,
      artifacts: Array.isArray(run.artifacts) ? run.artifacts.slice(0, 256).map((item) => ({ kind: String(item.kind ?? 'artifact'), sha256: String(item.sha256 ?? '') })) : [],
      claims: { rawCommandStored: false, rawOutputStored: false, secretMaterialStored: false },
    });
    this.entries.push(entry); while (this.entries.length > this.maxEntries) this.entries.shift();
    return entry;
  }
  snapshot() { return Object.freeze([...this.entries]); }
}
