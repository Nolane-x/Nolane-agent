import { createHash } from 'node:crypto';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
};
const deepFreeze = (value) => {
  if (Array.isArray(value)) { for (const entry of value) deepFreeze(entry); return Object.freeze(value); }
  if (value && typeof value === 'object') { for (const entry of Object.values(value)) deepFreeze(entry); return Object.freeze(value); }
  return value;
};
const eventHash = (event) => sha256(JSON.stringify(canonical({
  streamId: event.streamId,
  sequence: event.sequence,
  at: event.at,
  type: event.type,
  payload: event.payload,
  previousSha256: event.previousSha256,
})));

export class RuntimeReceiptLedger {
  constructor({ streamId, clock = () => Date.now(), seedEvents = [] } = {}) {
    if (!streamId) throw new TypeError('streamId is required');
    this.streamId = String(streamId);
    this.clock = clock;
    this.events = seedEvents.map((entry) => deepFreeze(structuredClone(entry)));
  }

  append({ type, payload = {} } = {}) {
    if (!type) throw new TypeError('receipt event type is required');
    const event = {
      streamId: this.streamId,
      sequence: this.events.length + 1,
      at: Number(this.clock()),
      type: String(type),
      payload: canonical(structuredClone(payload)),
      previousSha256: this.events.at(-1)?.sha256 ?? null,
    };
    event.sha256 = eventHash(event);
    const frozen = deepFreeze(event);
    this.events.push(frozen);
    return frozen;
  }

  snapshot() {
    const base = {
      schema: 'nolane.native-core.runtime-receipt-ledger.v1',
      streamId: this.streamId,
      eventCount: this.events.length,
      headSha256: this.events.at(-1)?.sha256 ?? null,
      events: this.events.map((entry) => structuredClone(entry)),
    };
    base.receiptSha256 = sha256(JSON.stringify(canonical(base)));
    return deepFreeze(base);
  }

  static verify(snapshot) {
    try {
      if (snapshot?.schema !== 'nolane.native-core.runtime-receipt-ledger.v1' || !snapshot.streamId || !Array.isArray(snapshot.events)) return { valid: false, reason: 'invalid schema' };
      let previous = null;
      for (let index = 0; index < snapshot.events.length; index += 1) {
        const event = snapshot.events[index];
        if (event.streamId !== snapshot.streamId || event.sequence !== index + 1 || event.previousSha256 !== previous || event.sha256 !== eventHash(event)) return { valid: false, reason: `receipt chain mismatch at sequence ${index + 1}` };
        previous = event.sha256;
      }
      if (snapshot.eventCount !== snapshot.events.length || snapshot.headSha256 !== previous) return { valid: false, reason: 'receipt summary mismatch' };
      const { receiptSha256, ...base } = snapshot;
      if (receiptSha256 !== sha256(JSON.stringify(canonical(base)))) return { valid: false, reason: 'receipt snapshot hash mismatch' };
      return { valid: true, headSha256: previous, eventCount: snapshot.events.length };
    } catch (error) {
      return { valid: false, reason: error.message };
    }
  }

  static restore(snapshot, { clock = () => Date.now() } = {}) {
    const verification = RuntimeReceiptLedger.verify(snapshot);
    if (!verification.valid) throw new Error(`Runtime receipt chain invalid: ${verification.reason}`);
    return new RuntimeReceiptLedger({ streamId: snapshot.streamId, clock, seedEvents: snapshot.events });
  }
}
