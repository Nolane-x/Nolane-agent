import { finite, signed, text } from './cognition-utils.mjs';

export class AgencyLedger {
  constructor({ maxEntries = 1_000 } = {}) {
    this.maxEntries = Math.max(1, Math.min(20_000, Math.floor(Number(maxEntries) || 1_000)));
    this.entries = [];
  }

  record(input = {}) {
    const base = {
      schema: 'forge.agency-record.v1',
      actionId: text(input.actionId, 'actionId', 256),
      taskId: text(input.taskId, 'taskId', 256),
      intent: text(input.intent, 'intent'),
      commandKind: text(input.commandKind, 'commandKind', 128),
      commandFingerprint: text(input.commandFingerprint, 'commandFingerprint', 256),
      expectedEffect: text(input.expectedEffect, 'expectedEffect'),
      actualEffect: text(input.actualEffect, 'actualEffect'),
      controllability: finite(input.controllability, 'controllability', { min: 0, max: 1 }),
      responsibleActor: text(input.responsibleActor, 'responsibleActor', 256),
      claims: { rawCommandStored: false, intentOutcomeDeltaStored: true },
    };
    const record = signed(base);
    this.entries.push(record);
    while (this.entries.length > this.maxEntries) this.entries.shift();
    return record;
  }

  snapshot() { return signed({ schema: 'forge.agency-ledger-snapshot.v1', entries: [...this.entries], count: this.entries.length }); }
}
