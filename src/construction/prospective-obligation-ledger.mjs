import { signed, strings, text } from './construction-utils.mjs';

export class ProspectiveObligationLedger {
  constructor({ maxObligations = 2_000 } = {}) { this.maxObligations = Math.max(1, Number(maxObligations) || 2_000); this.obligations = new Map(); this.events = new Set(); }

  register(input = {}) {
    const obligationId = text(input.obligationId, 'obligationId', 256);
    if (this.obligations.has(obligationId)) throw new TypeError(`duplicate obligation: ${obligationId}`);
    if (this.obligations.size >= this.maxObligations) throw new RangeError('obligation limit exceeded');
    const trigger = input.trigger ?? {};
    const obligation = signed({ schema: 'forge.prospective-obligation.v1', obligationId, trigger: { type: text(trigger.type, 'trigger.type', 128), key: text(trigger.key, 'trigger.key', 256), equals: text(trigger.equals, 'trigger.equals', 512) }, action: text(input.action, 'action', 2_048), requiredVerificationIds: strings(input.requiredVerificationIds ?? [], 'requiredVerificationIds', 128, 256), status: 'pending', triggerReceiptId: null, completionReceiptId: null });
    this.obligations.set(obligationId, obligation);
    return obligation;
  }

  observe(event = {}) {
    const eventId = text(event.eventId, 'eventId', 256);
    if (this.events.has(eventId)) throw new TypeError(`duplicate obligation event: ${eventId}`);
    this.events.add(eventId);
    const type = text(event.type, 'event.type', 128); const key = text(event.key, 'event.key', 256); const value = text(event.value, 'event.value', 512); const receiptId = text(event.receiptId, 'event.receiptId', 512);
    const triggeredObligationIds = [];
    for (const [id, obligation] of this.obligations) if (obligation.status === 'pending' && obligation.trigger.type === type && obligation.trigger.key === key && obligation.trigger.equals === value) {
      const updated = signed({ ...obligation, status: 'triggered', triggerReceiptId: receiptId });
      this.obligations.set(id, updated); triggeredObligationIds.push(id);
    }
    return signed({ schema: 'forge.prospective-obligation-observation.v1', eventId, triggeredObligationIds });
  }

  complete(obligationId, input = {}) {
    const id = text(obligationId, 'obligationId', 256); const obligation = this.obligations.get(id);
    if (!obligation) throw new RangeError(`unknown obligation: ${id}`);
    if (obligation.status !== 'triggered') throw new Error(`obligation is not triggered: ${id}`);
    const verificationIds = strings(input.verificationIds ?? [], 'verificationIds', 128, 256);
    const missing = obligation.requiredVerificationIds.filter((item) => !verificationIds.includes(item));
    if (missing.length) throw new Error(`missing obligation verification: ${missing.join(', ')}`);
    const updated = signed({ ...obligation, status: 'completed', completionReceiptId: text(input.receiptId, 'completion receiptId', 512), verificationIds });
    this.obligations.set(id, updated); return updated;
  }

  snapshot() { return signed({ schema: 'forge.prospective-obligation-ledger.v1', obligations: [...this.obligations.values()] }); }
}
