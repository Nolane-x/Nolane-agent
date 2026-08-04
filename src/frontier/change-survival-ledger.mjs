import { finite, optionalText, sha, signed, text } from './frontier-utils.mjs';

const DAY_MS = 86_400_000;
const KINDS = new Set(['revert', 'rewrite', 'bug', 'security-regression', 'technical-debt', 'healthy']);
const KIND_PENALTY = { revert: 0.65, rewrite: 0.35, bug: 0.4, 'security-regression': 0.8, 'technical-debt': 0.2, healthy: -0.05 };
const SEVERITY_FACTOR = { low: 0.5, medium: 0.75, high: 1, critical: 1.25 };

export class ChangeSurvivalLedger {
  constructor({ clock = () => Date.now(), maxChanges = 5_000, maxObservations = 100 } = {}) {
    this.clock = typeof clock === 'function' ? clock : () => Date.now();
    this.maxChanges = maxChanges; this.maxObservations = maxObservations; this.changes = new Map();
  }

  registerChange(input = {}) {
    if (this.changes.size >= this.maxChanges) throw new RangeError('change survival limit exceeded');
    const changeId = text(input.changeId, 'changeId', 200);
    if (this.changes.has(changeId)) throw new TypeError(`duplicate change: ${changeId}`);
    const observationWindowDays = finite(input.observationWindowDays, 'observationWindowDays', 7, 30);
    const state = {
      changeId, mergedAtMs: finite(input.mergedAtMs, 'mergedAtMs', 0), observationWindowDays,
      commitReceiptSha256: sha(input.commitReceiptSha256, 'commitReceiptSha256'),
      patchReceiptSha256: sha(input.patchReceiptSha256, 'patchReceiptSha256'),
      routerChoiceId: optionalText(input.routerChoiceId, 'routerChoiceId', 160), skillId: optionalText(input.skillId, 'skillId', 160),
      observations: [],
    };
    this.changes.set(changeId, state);
    return this.#snapshot(state);
  }

  observe(changeId, input = {}) {
    const state = this.#state(changeId);
    if (state.observations.length >= this.maxObservations) throw new RangeError('change observation limit exceeded');
    const kind = text(input.kind, 'kind', 40); if (!KINDS.has(kind)) throw new TypeError(`unsupported survival observation: ${kind}`);
    const severity = text(input.severity, 'severity', 20); if (!Object.hasOwn(SEVERITY_FACTOR, severity)) throw new TypeError(`unsupported severity: ${severity}`);
    const observedAtMs = finite(input.observedAtMs ?? this.clock(), 'observedAtMs', state.mergedAtMs);
    const observation = signed({ schema: 'forge.change-survival-observation.v1', kind, severity, observedAtMs, sourceReceiptSha256: sha(input.sourceReceiptSha256, 'sourceReceiptSha256') });
    state.observations.push(observation);
    return observation;
  }

  evaluate(changeId) {
    const state = this.#state(changeId); const now = finite(this.clock(), 'clock', 0);
    const maturesAtMs = state.mergedAtMs + state.observationWindowDays * DAY_MS;
    let penalty = 0;
    for (const observation of state.observations) penalty += (KIND_PENALTY[observation.kind] ?? 0) * SEVERITY_FACTOR[observation.severity];
    const survivalScore = Math.max(0, Math.min(1, 1 - penalty));
    return signed({
      schema: 'forge.change-survival-evaluation.v1', changeId: state.changeId,
      status: now >= maturesAtMs ? 'matured' : 'observing', nowMs: now, maturesAtMs,
      observationWindowDays: state.observationWindowDays, survivalScore,
      observationCounts: Object.fromEntries([...KINDS].map((kind) => [kind, state.observations.filter((item) => item.kind === kind).length])),
      claims: { productionDurabilityProven: false, productionRoutingChanged: false },
    });
  }

  shadowCredit(changeId) {
    const state = this.#state(changeId); const evaluation = this.evaluate(changeId);
    if (evaluation.status !== 'matured') throw new Error('survival window has not matured');
    return signed({ schema: 'forge.change-survival-shadow-credit.v1', changeId: state.changeId, routerChoiceId: state.routerChoiceId, skillId: state.skillId, reward: evaluation.survivalScore * 2 - 1, shadowOnly: true, productionRoutingChanged: false, sourceEvaluationReceiptSha256: evaluation.receiptSha256 });
  }

  snapshot(changeId) { return this.#snapshot(this.#state(changeId)); }
  #state(changeId) { const id = text(changeId, 'changeId', 200); const state = this.changes.get(id); if (!state) throw new RangeError(`unknown change: ${id}`); return state; }
  #snapshot(state) { return signed({ schema: 'forge.change-survival-record.v1', changeId: state.changeId, mergedAtMs: state.mergedAtMs, observationWindowDays: state.observationWindowDays, commitReceiptSha256: state.commitReceiptSha256, patchReceiptSha256: state.patchReceiptSha256, routerChoiceId: state.routerChoiceId, skillId: state.skillId, observations: state.observations, claims: { productionDurabilityProven: false } }); }
}
