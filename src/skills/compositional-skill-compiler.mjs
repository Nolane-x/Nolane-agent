import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const HASH = /^[a-f0-9]{64}$/i;
const PRIVATE = /(?:chainOfThought|hiddenReasoning|rawPrompt|rawOutput|rawTranscript|secret|password|credential|authorization|api[_-]?key|access[_-]?token)/i;
function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; for (const child of Object.values(value)) freeze(child); return Object.freeze(value); }
function text(value, label, max = 2_000) { const out = String(value ?? '').trim(); if (!out) throw new TypeError(`${label} is required`); if (out.length > max) throw new TypeError(`${label} is too long`); return out; }
function assertPublic(value) { if (!value || typeof value !== 'object') return; for (const [key, child] of Object.entries(value)) { if (PRIVATE.test(key)) throw new TypeError(`private or hidden field is not allowed: ${key}`); assertPublic(child); } }
function signed(base) { return freeze({ ...base, receiptSha256: canonicalSha256(base) }); }
function normalizeList(value, label, max = 64) { if (!Array.isArray(value) || !value.length) throw new TypeError(`${label} must be a non-empty array`); return value.slice(0, max); }
function normalizeParameters(value) { return normalizeList(value, 'parameters').map((item) => freeze({ name: text(item.name, 'parameter name', 128), type: text(item.type, 'parameter type', 128), required: item.required !== false })); }
function normalizePreconditions(value) { return normalizeList(value, 'preconditions').map((item) => freeze({ key: text(item.key, 'precondition key', 256), type: text(item.type ?? 'boolean', 'precondition type', 128), equals: item.equals ?? true })); }
function normalizeEffects(value) { return normalizeList(value, 'effects').map((item) => freeze({ target: text(item.target, 'effect target', 256), operation: text(item.operation, 'effect operation', 64), valueType: text(item.valueType ?? 'unknown', 'effect valueType', 128) })); }

export class CompositionalSkillCompiler {
  compile(input = {}) {
    assertPublic(input);
    const episodes = normalizeList(input.episodes, 'episodes').map((episode) => {
      if (episode?.verified !== true || !HASH.test(String(episode.verificationReceiptSha256 ?? ''))) throw new TypeError('each source must be a verified episode with receipt');
      return freeze({ episodeId: text(episode.episodeId, 'episodeId', 256), repositoryId: text(episode.repositoryId ?? 'unknown', 'repositoryId', 256), outcome: text(episode.outcome ?? 'passed', 'episode outcome', 64), verificationReceiptSha256: String(episode.verificationReceiptSha256).toLowerCase() });
    });
    const name = text(input.name, 'skill name', 300);
    const preconditions = normalizePreconditions(input.preconditions);
    const parameters = normalizeParameters(input.parameters);
    const effects = normalizeEffects(input.effects);
    const invariants = normalizeList(input.invariants, 'invariants').map((item) => text(item, 'invariant', 1_000));
    const verifier = freeze({ kind: text(input.verifier?.kind, 'verifier kind', 64), commandId: text(input.verifier?.commandId, 'verifier commandId', 256) });
    const failureSignatures = normalizeList(input.failureSignatures, 'failureSignatures').map((item) => text(item, 'failure signature', 1_000));
    const costEstimate = freeze({ tokens: Math.max(0, Number(input.costEstimate?.tokens) || 0), timeSeconds: Math.max(0, Number(input.costEstimate?.timeSeconds) || 0), rssMbSeconds: Math.max(0, Number(input.costEstimate?.rssMbSeconds) || 0) });
    const rollback = freeze({ kind: text(input.rollback?.kind, 'rollback kind', 128), required: input.rollback?.required !== false });
    const decomposition = normalizeList(input.decomposition, 'decomposition', 64).map((item) => text(item, 'decomposition step', 1_000));
    const parentSkillIds = Array.isArray(input.parentSkillIds) ? [...new Set(input.parentSkillIds.map((item) => text(item, 'parent skill id', 256)))].slice(0, 16) : [];
    const lineageAction = text(input.lineageAction ?? (parentSkillIds.length > 1 ? 'merge' : parentSkillIds.length ? 'fork' : 'created'), 'lineage action', 64);
    const identity = canonicalSha256({ name, preconditions, parameters, effects, invariants, verifier, sourceEpisodes: episodes.map((item) => item.verificationReceiptSha256), parentSkillIds });
    return signed({ schema: 'forge.compositional-skill.v1', skillId: `skill_${identity.slice(0, 24)}`, revision: 1, name, state: 'draft', preconditions: freeze(preconditions), parameters: freeze(parameters), effects: freeze(effects), invariants: freeze(invariants), verifier, failureSignatures: freeze(failureSignatures), costEstimate, rollback, decomposition: freeze(decomposition), sourceEpisodes: freeze(episodes), parentSkillIds: freeze(parentSkillIds), lineageAction, claims: { hiddenReasoningStored: false, transferProven: false } });
  }

  recombine({ name, skills = [] } = {}) {
    if (!Array.isArray(skills) || skills.length < 2) throw new TypeError('at least two skills are required');
    const reasons = [];
    const parameterTypes = new Map();
    const effects = new Map();
    for (const skill of skills) {
      for (const parameter of skill.parameters ?? []) {
        if (parameterTypes.has(parameter.name) && parameterTypes.get(parameter.name) !== parameter.type) reasons.push(`parameter type conflict: ${parameter.name}`);
        parameterTypes.set(parameter.name, parameter.type);
      }
      for (const effect of skill.effects ?? []) {
        const key = effect.target;
        const signature = `${effect.operation}:${effect.valueType}`;
        if (effects.has(key) && effects.get(key) !== signature) reasons.push(`effect conflict: ${key}`);
        effects.set(key, signature);
      }
    }
    const base = { schema: 'forge.skill-recombination-decision.v1', name: text(name, 'combined skill name', 300), skillIds: skills.map((item) => text(item.skillId, 'skillId', 256)), compatible: reasons.length === 0, reasons: freeze(reasons), claims: { compositionExecuted: false } };
    return signed(base);
  }
}
