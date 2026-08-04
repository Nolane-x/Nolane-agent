import { signed, text } from '../construction/construction-utils.mjs';
const SHA = /^[a-f0-9]{64}$/i;
function hash(value, label) { const out = text(value, label, 64).toLowerCase(); if (!SHA.test(out)) throw new TypeError(`${label} is invalid`); return out; }
export class ArtifactPlaybackService {
  constructor({ maxEvents = 500 } = {}) { this.maxEvents = Math.max(1, Math.min(10_000, Number(maxEvents) || 500)); this.events = []; this.checkpoints = new Map(); }
  #push(event) { this.events.push(signed(event)); if (this.events.length > this.maxEvents) this.events.splice(0, this.events.length - this.maxEvents); return this.events.at(-1); }
  append(input = {}) { return this.#push({ schema: 'forge.artifact-playback-event.v1', type: text(input.type, 'type', 128), summary: text(input.summary, 'summary', 2_000), artifactSha256: hash(input.artifactSha256, 'artifactSha256'), atMs: Number(input.atMs ?? Date.now()) }); }
  checkpoint(input = {}) { const checkpointId = text(input.checkpointId, 'checkpointId', 256); const checkpoint = signed({ schema: 'forge.playback-checkpoint.v1', checkpointId, gitCommit: text(input.gitCommit, 'gitCommit', 256), verificationReceiptSha256: hash(input.verificationReceiptSha256, 'verificationReceiptSha256'), atMs: Number(input.atMs ?? Date.now()) }); this.checkpoints.set(checkpointId, checkpoint); this.#push({ schema: 'forge.artifact-playback-event.v1', type: 'checkpoint', summary: `Checkpoint ${checkpointId}`, artifactSha256: checkpoint.verificationReceiptSha256, atMs: checkpoint.atMs }); return checkpoint; }
  rewindPlan({ checkpointId } = {}) { const checkpoint = this.checkpoints.get(text(checkpointId, 'checkpointId', 256)); if (!checkpoint) throw new Error('checkpoint not found'); return signed({ schema: 'forge.playback-rewind-plan.v1', allowed: true, checkpoint, claims: { rewindExecuted: false, irreversibleActionRun: false } }); }
  snapshot() { return signed({ schema: 'forge.artifact-playback-snapshot.v1', events: [...this.events], checkpoints: [...this.checkpoints.values()], claims: { rawCommandStored: false, rawPromptStored: false } }); }
}
