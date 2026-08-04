import { finite, signed } from './world-model-utils.mjs';
export class SimulationReceiptLedger {
  constructor({ maxEntries = 1000 } = {}) { this.maxEntries = Math.max(1, Math.floor(finite(maxEntries, 1000))); this.entries = []; }
  record(entry) { this.entries.push(entry); while (this.entries.length > this.maxEntries) this.entries.shift(); return entry; }
  find(receiptSha256) { return this.entries.find((entry) => entry.receiptSha256 === receiptSha256) ?? null; }
  list({ limit = 100 } = {}) { return signed({ schema: 'forge.simulation-ledger-snapshot.v1', entries: this.entries.slice(-Math.max(1, Math.min(this.maxEntries, Math.floor(finite(limit, 100))))).map((item) => ({ receiptSha256: item.receiptSha256, modelId: item.modelId, stateHash: item.stateHash, selectedCandidateId: item.selectedCandidateId, phase: item.phase })) }); }
}
