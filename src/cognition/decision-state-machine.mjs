import { signed, text } from './cognition-utils.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const TERMINAL = new Set(['committed', 'rejected', 'aborted', 'rolled_back']);
const NEXT = Object.freeze({ specified: 'proposed', proposed: 'verified', verified: 'authorized', authorized: 'executed', executed: 'observed', observed: 'committed' });
const RECEIPT_KIND = Object.freeze({ specified: 'specification', proposed: 'proposal', verified: 'verification', authorized: 'authorization', executed: 'execution', observed: 'effect', committed: 'commit', rejected: 'rejection', aborted: 'abort', rolled_back: 'rollback' });

function sha(value, label) {
  const output = String(value ?? '').trim().toLowerCase();
  if (!SHA256.test(output)) throw new TypeError(`${label} must be SHA-256`);
  return output;
}

function timestamp(value, label = 'timestamp') {
  const atMs = Math.trunc(Number(value));
  if (!Number.isSafeInteger(atMs) || atMs < 0) throw new TypeError(`${label} must be a non-negative safe integer`);
  return atMs;
}

export class DecisionStateMachine {
  constructor({ clock = () => Date.now(), maxDecisions = 20_000, maxHistory = 64 } = {}) {
    this.clock = typeof clock === 'function' ? clock : () => Date.now();
    this.maxDecisions = Math.max(1, Math.floor(Number(maxDecisions) || 20_000));
    this.maxHistory = Math.max(7, Math.min(256, Math.floor(Number(maxHistory) || 64)));
    this.decisions = new Map();
  }

  create(input = {}) {
    const decisionId = text(input.decisionId, 'decisionId', 256);
    if (this.decisions.has(decisionId)) throw new TypeError(`duplicate decision state: ${decisionId}`);
    if (this.decisions.size >= this.maxDecisions) throw new RangeError(`decision state capacity exceeded: ${this.maxDecisions}`);
    const missionId = text(input.missionId, 'missionId', 256);
    const taskId = text(input.taskId, 'taskId', 256);
    const receiptSha256 = sha(input.specificationReceiptSha256, 'specificationReceiptSha256');
    const atMs = timestamp(this.clock());
    const history = [{ from: null, to: 'specified', receiptKind: 'specification', receiptSha256, atMs }];
    this.decisions.set(decisionId, { decisionId, missionId, taskId, state: 'specified', history, lastAtMs: atMs });
    return this.snapshot(decisionId);
  }

  transition(decisionId, input = {}) {
    const record = this.#record(decisionId);
    if (TERMINAL.has(record.state)) throw new TypeError(`decision ${record.decisionId} is terminal in state ${record.state}`);
    const to = String(input.to ?? '').trim().toLowerCase();
    const special = to === 'rejected' || to === 'aborted' || (to === 'rolled_back' && (record.state === 'executed' || record.state === 'observed'));
    if (!special && NEXT[record.state] !== to) throw new TypeError(`invalid transition from ${record.state} to ${to || '<empty>'}`);
    const requiredKind = RECEIPT_KIND[to];
    const receiptKind = String(input.receiptKind ?? '').trim().toLowerCase();
    if (receiptKind !== requiredKind) throw new TypeError(`transition to ${to} requires ${requiredKind} receipt`);
    const receiptSha256 = sha(input.receiptSha256, 'receiptSha256');
    if (record.history.some((item) => item.receiptSha256 === receiptSha256)) throw new TypeError(`duplicate transition receipt: ${receiptSha256}`);
    const atMs = timestamp(input.atMs === undefined ? this.clock() : input.atMs);
    if (atMs < record.lastAtMs) throw new TypeError('transition time must be monotonic');
    record.history.push({ from: record.state, to, receiptKind, receiptSha256, atMs });
    if (record.history.length > this.maxHistory) record.history.splice(0, record.history.length - this.maxHistory);
    record.state = to;
    record.lastAtMs = atMs;
    return this.snapshot(record.decisionId);
  }

  snapshot(decisionId) {
    const record = this.#record(decisionId);
    return signed({
      schema: 'forge.decision-state.v1', decisionId: record.decisionId, missionId: record.missionId, taskId: record.taskId,
      state: record.state, terminal: TERMINAL.has(record.state),
      history: record.history.map((item) => Object.freeze({ ...item })),
      claims: { skippedExecutionAllowed: false, commitBeforeObservationAllowed: false, duplicateExecutionAllowed: false },
    });
  }

  #record(decisionId) {
    const id = text(decisionId, 'decisionId', 256);
    const record = this.decisions.get(id);
    if (!record) throw new RangeError(`unknown decision state: ${id}`);
    return record;
  }
}
