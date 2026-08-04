import { number, signed, text, uniqueStrings, receipt } from './learning-utils.mjs';

const ALLOWED = new Set(['taskId', 'taskType', 'languages', 'repoSize', 'risk', 'context', 'tools', 'localOnly']);

export class TaskFeatureEncoder {
  constructor({ capabilityMatrixRevision } = {}) {
    this.capabilityMatrixRevision = receipt(capabilityMatrixRevision, 'capabilityMatrixRevision');
  }

  encode(input = {}) {
    for (const key of Object.keys(input)) if (!ALLOWED.has(key)) throw new TypeError(`unknown feature field: ${key}`);
    const repoSize = input.repoSize ?? {};
    const context = input.context ?? {};
    const base = {
      schema: 'forge.task-feature-vector.v1',
      taskId: text(input.taskId, 'taskId', 256),
      taskType: text(input.taskType, 'taskType', 128).toLowerCase(),
      languages: uniqueStrings(input.languages ?? [], 'languages', 64),
      repository: Object.freeze({
        files: number(repoSize.files ?? 0, 'repoSize.files', { min: 0, max: 10_000_000, integer: true }),
        bytes: number(repoSize.bytes ?? 0, 'repoSize.bytes', { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true }),
        symbols: number(repoSize.symbols ?? 0, 'repoSize.symbols', { min: 0, max: 100_000_000, integer: true }),
      }),
      risk: number(input.risk ?? 0, 'risk', { min: 0, max: 1 }),
      context: Object.freeze({
        tokenBudget: number(context.tokenBudget ?? 0, 'context.tokenBudget', { min: 0, max: 10_000_000, integer: true }),
        selectedTokens: number(context.selectedTokens ?? 0, 'context.selectedTokens', { min: 0, max: 10_000_000, integer: true }),
      }),
      tools: uniqueStrings(input.tools ?? [], 'tools', 256),
      localOnly: input.localOnly === true,
      capabilityMatrixRevision: this.capabilityMatrixRevision,
      claims: Object.freeze({ rawPromptStored: false, rawContextStored: false, taskFeatureConditioned: true }),
    };
    if (base.context.selectedTokens > base.context.tokenBudget) throw new TypeError('context.selectedTokens exceeds tokenBudget');
    return signed(base);
  }
}
