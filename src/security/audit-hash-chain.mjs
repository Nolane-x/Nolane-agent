import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { deepFreeze, text } from '../construction/construction-utils.mjs';

export class AuditHashChain {
  constructor() { this.entries = []; }
  append({ actorId, scope, event } = {}) {
    const previousReceiptSha256 = this.entries.at(-1)?.receiptSha256 ?? '0'.repeat(64);
    const base = { schema: 'forge.audit-chain-entry.v1', sequence: this.entries.length + 1, previousReceiptSha256, actorId: text(actorId, 'actorId', 512), scope: text(scope, 'scope', 256), event: { type: text(event?.type, 'event.type', 256), digest: text(event?.digest, 'event.digest', 128) } };
    const entry = deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
    this.entries.push(entry);
    return entry;
  }
  verify(entries = this.entries) {
    if (!Array.isArray(entries)) throw new TypeError('entries must be an array');
    let previous = '0'.repeat(64);
    let expectedSequence = 1;
    for (const entry of entries) {
      const base = { schema: entry.schema, sequence: entry.sequence, previousReceiptSha256: entry.previousReceiptSha256, actorId: entry.actorId, scope: entry.scope, event: entry.event };
      if (entry.sequence !== expectedSequence || entry.previousReceiptSha256 !== previous || canonicalSha256(base) !== entry.receiptSha256) return deepFreeze({ schema: 'forge.audit-chain-verification.v1', status: 'tampered', failedSequence: expectedSequence });
      previous = entry.receiptSha256; expectedSequence += 1;
    }
    if (entries.length && entries.length !== this.entries.length) return deepFreeze({ schema: 'forge.audit-chain-verification.v1', status: 'tampered', failedSequence: entries.length + 1 });
    return deepFreeze({ schema: 'forge.audit-chain-verification.v1', status: 'pass', entries: entries.length, headReceiptSha256: previous });
  }
}
