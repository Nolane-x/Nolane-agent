import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const PRIVATE = /(?:rawTranscript|rawPrompt|rawOutput|chainOfThought|hiddenReasoning|secret|password|credential|authorization|api[_-]?key|access[_-]?token)/i;
function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; for (const child of Object.values(value)) freeze(child); return Object.freeze(value); }
function clamp(value) { const n = Number(value ?? 0); return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0; }
function assertPublic(value) { if (!value || typeof value !== 'object') return; for (const [key, child] of Object.entries(value)) { if (PRIVATE.test(key)) throw new TypeError(`private or raw episode field is not allowed: ${key}`); assertPublic(child); } }
function signed(base) { return freeze({ ...base, receiptSha256: canonicalSha256(base) }); }

export class ReplayScheduler {
  constructor({ maxQueue = 32, replaySaturationPenalty = 0.12, cooldownModelTime = 2, weights = {} } = {}) {
    this.maxQueue = Math.max(1, Math.min(1_000, Number(maxQueue) || 32));
    this.saturationPenalty = Math.max(0, Number(replaySaturationPenalty) || 0.12);
    this.cooldownModelTime = Math.max(0, Number(cooldownModelTime) || 2);
    this.weights = Object.freeze({ predictionError: 0.35, conflict: 0.25, reverted: 0.35, transferValue: 0.20, commitment: 0.15, calibrationError: 0.15, ...weights });
  }
  schedule({ episodes = [], modelTime = 0 } = {}) {
    if (!Array.isArray(episodes)) throw new TypeError('episodes must be an array');
    assertPublic(episodes);
    const now = Number(modelTime) || 0; const queue = []; const omissions = [];
    for (const raw of episodes.slice(0, 10_000)) {
      const episodeId = String(raw.episodeId ?? '').trim(); if (!episodeId) throw new TypeError('episodeId is required');
      if (raw.commitmentCompleted === true) { omissions.push(freeze({ episodeId, reason: 'commitment-completed' })); continue; }
      const replayCount = Math.max(0, Math.floor(Number(raw.replayCount) || 0));
      const last = raw.lastReplayedModelTime == null ? null : Number(raw.lastReplayedModelTime);
      const cooldown = last != null && now - last < this.cooldownModelTime * Math.max(1, replayCount);
      if (cooldown) { omissions.push(freeze({ episodeId, reason: 'cooldown', nextEligibleModelTime: last + this.cooldownModelTime * Math.max(1, replayCount) })); continue; }
      const signals = {
        predictionError: clamp(raw.predictionError), conflict: clamp(raw.conflict), reverted: raw.reverted === true ? 1 : 0,
        transferValue: clamp(raw.transferValue), commitment: raw.commitmentPending === true ? 1 : 0, calibrationError: clamp(raw.calibrationError),
      };
      const rawScore = Object.entries(signals).reduce((sum, [key, value]) => sum + value * Number(this.weights[key] ?? 0), 0);
      const score = Math.max(0, rawScore - replayCount * this.saturationPenalty);
      const reasons = Object.entries(signals).filter(([, value]) => value > 0).sort((a,b) => b[1]-a[1]).map(([key]) => key);
      queue.push(freeze({ episodeId, score, replayCount, reasons, modelTime: now }));
    }
    queue.sort((a,b) => b.score-a.score || a.episodeId.localeCompare(b.episodeId));
    const selected = queue.slice(0, this.maxQueue);
    for (const item of queue.slice(this.maxQueue)) omissions.push(freeze({ episodeId: item.episodeId, reason: 'queue-cap' }));
    return signed({ schema: 'forge.replay-schedule.v1', modelTime: now, queue: freeze(selected), omissions: freeze(omissions), claims: { modelInvoked: false, rawTranscriptsStored: false } });
  }
}
