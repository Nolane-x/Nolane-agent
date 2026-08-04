import { createHash } from 'node:crypto';
import { createAgentState } from './agent-state.mjs';
import { TurnStateMachine } from '../native-core/turn-state-machine.mjs';
import { RuntimeReceiptLedger } from '../native-core/runtime-receipt-ledger.mjs';
import { CancellationTree } from '../native-core/cancellation-tree.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const stable = (value) => { if (Array.isArray(value)) return value.map(stable); if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])); return value; };
const effectMatches = (expected, actual) => {
  if (!expected) return true; if (!actual || typeof actual !== 'object') return false;
  return Object.entries(expected).every(([key, value]) => JSON.stringify(stable(actual[key])) === JSON.stringify(stable(value)));
};

export class NolaneAgentLoop {
  constructor({ providers, tools, verifier, traceSink = () => {}, clock = () => Date.now() } = {}) {
    if (!providers?.invoke || !tools?.execute || typeof verifier !== 'function') throw new Error('NolaneAgentLoop requires providers, tools and verifier');
    this.providers = providers; this.tools = tools; this.verifier = verifier; this.traceSink = traceSink; this.clock = clock;
  }

  async run({ missionId, objective, criteria = [], requiredCapabilities = [], grantedCapabilities = [], approvals = [], budgets = {}, context = {}, signal } = {}) {
    const startedAt = this.clock();
    const state = createAgentState({ missionId, objective, criteria, budgets, startedAt });
    const kernel = new TurnStateMachine({ missionId, budgets, clock: this.clock });
    const receipts = new RuntimeReceiptLedger({ streamId: `mission:${missionId}`, clock: this.clock });
    const cancellations = new CancellationTree({ clock: this.clock });
    cancellations.create({ id: String(missionId) });
    const onAbort = () => cancellations.cancel(String(missionId), signal.reason ?? 'aborted');
    if (signal?.aborted) onAbort(); else signal?.addEventListener?.('abort', onAbort, { once: true });
    const runtimeSignal = cancellations.signal(String(missionId));
    const appendTransition = (next, metadata = {}) => {
      const transition = kernel.transition(next, metadata);
      receipts.append({ type: 'state-transition', payload: transition });
      return transition;
    };
    const consume = (kind) => {
      const budget = kernel.consume(kind);
      receipts.append({ type: 'budget-consumed', payload: budget });
      return budget;
    };

    state.transition('planning', { at: startedAt });
    appendTransition('planning', { at: startedAt });
    state.transition('executing', { at: startedAt });

    const transcript = []; const effects = []; let verification = null; let answer = null; let stopReason = null;
    if (runtimeSignal.aborted) {
      state.abort();
      state.transition('cancelled', { at: this.clock(), reason: String(runtimeSignal.reason ?? 'aborted') });
      appendTransition('cancelled', { at: this.clock(), reason: String(runtimeSignal.reason ?? 'aborted') });
      stopReason = 'aborted';
    } else {
      appendTransition('model', { at: this.clock() });
    }

    try {
      while (!stopReason) {
        if (runtimeSignal.aborted) state.abort();
        stopReason = state.shouldStop({ now: this.clock() });
        if (stopReason) {
          if (!['completed', 'failed', 'cancelled'].includes(state.snapshot().status)) state.transition(stopReason === 'aborted' ? 'cancelled' : 'failed', { at: this.clock(), reason: stopReason });
          if (!kernel.snapshot().terminal) appendTransition(stopReason === 'aborted' ? 'cancelled' : 'failed', { at: this.clock(), reason: stopReason });
          break;
        }

        consume('model');
        const capsule = state.snapshot();
        const response = await this.providers.invoke({ requiredCapabilities, stateCapsule: capsule, payload: Object.freeze({ objective, criteria, context, transcript: Object.freeze([...transcript]), effects: Object.freeze([...effects]), tools: this.tools.describe() }), signal: runtimeSignal });
        transcript.push(Object.freeze({ providerId: response.providerId, type: response.type, at: this.clock() }));

        if (response.type === 'tool') {
          appendTransition('tool', { at: this.clock(), reason: response.tool });
          consume('tool');
          const result = await this.tools.execute(response.tool, response.input ?? {}, { grantedCapabilities, approvals, missionId, signal: runtimeSignal });
          const matched = effectMatches(response.expectedEffect, result.output);
          const event = Object.freeze({ type: 'tool-effect', missionId, tool: response.tool, providerId: response.providerId, expectedEffect: response.expectedEffect ?? null, actualEffect: result.output, effectMatched: matched, receiptSha256: result.receiptSha256 });
          effects.push(event); this.traceSink(event); receipts.append({ type: 'tool-effect', payload: event });
          state.recordTurn({ tokens: response.tokens ?? 0, progress: matched, at: this.clock() });
          if (!matched) transcript.push(Object.freeze({ type: 'effect-mismatch', tool: response.tool }));
          appendTransition('model', { at: this.clock(), reason: matched ? 'tool-complete' : 'effect-mismatch' });
          continue;
        }

        if (response.type === 'final') {
          state.transition('verifying', { at: this.clock() });
          appendTransition('verifying', { at: this.clock() });
          verification = Object.freeze(await this.verifier({ missionId, objective, criteria: response.criteria ?? criteria, answer: response.answer, response, effects: Object.freeze([...effects]), state: state.snapshot() }));
          receipts.append({ type: 'verification', payload: verification });
          state.recordTurn({ tokens: response.tokens ?? 0, progress: Boolean(verification.verified), criteriaMet: Boolean(verification.verified), at: this.clock() });
          if (verification.verified) {
            answer = response.answer ?? '';
            state.transition('completed', { at: this.clock(), reason: 'verified' });
            appendTransition('completed', { at: this.clock(), reason: 'verified' });
            break;
          }
          state.transition('executing', { at: this.clock(), reason: 'verification-failed' });
          consume('retry');
          appendTransition('model', { at: this.clock(), reason: 'verification-failed' });
          continue;
        }

        if (response.type === 'ask') {
          state.transition('waiting', { at: this.clock(), reason: 'needs-input' });
          answer = response.question ?? '';
          appendTransition('cancelled', { at: this.clock(), reason: 'needs-input' });
          break;
        }
        throw new Error(`Unknown provider action type: ${response.type}`);
      }
    } catch (error) {
      if (!kernel.snapshot().terminal) appendTransition(runtimeSignal.aborted ? 'cancelled' : 'failed', { at: this.clock(), reason: error.message });
      error.kernelReceipt = receipts.snapshot();
      throw error;
    } finally {
      signal?.removeEventListener?.('abort', onAbort);
    }

    const snapshot = state.snapshot();
    const kernelSnapshot = Object.freeze({ state: kernel.snapshot(), cancellations: cancellations.snapshot(), receipts: receipts.snapshot() });
    const receiptBase = stable({ schema: 'nolane.agent.native-loop-receipt.v2', missionId, objective, criteria, status: snapshot.status, stopReason, answer, verification, effects, transcript, state: snapshot, kernel: kernelSnapshot });
    return Object.freeze({ status: snapshot.status, stopReason, answer, verification, effects: Object.freeze([...effects]), transcript: Object.freeze([...transcript]), state: snapshot, kernel: kernelSnapshot, receipt: Object.freeze({ schema: receiptBase.schema, sha256: sha256(JSON.stringify(receiptBase)) }) });
  }
}
