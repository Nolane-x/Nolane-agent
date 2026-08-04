import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const HASH = /^[a-f0-9]{64}$/i;
const STATES = new Set(['draft', 'transfer-tested', 'promoted', 'rejected', 'revoked']);
function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; for (const child of Object.values(value)) freeze(child); return Object.freeze(value); }
function signed(base) { return freeze({ ...base, receiptSha256: canonicalSha256(base) }); }
function required(value, label) { const out = String(value ?? '').trim(); if (!out) throw new TypeError(`${label} is required`); return out; }
function hash(value, label) { const out = String(value ?? ''); if (!HASH.test(out)) throw new TypeError(`${label} must be a SHA-256 hash`); return out.toLowerCase(); }

export class SkillRegistry {
  constructor({ maxSkills = 2_000 } = {}) { this.maxSkills = Math.max(1, Number(maxSkills) || 2_000); this.skills = new Map(); }
  add(skill) {
    if (!skill?.skillId || skill.state !== 'draft') throw new TypeError('a compiled draft skill is required');
    if (this.skills.has(skill.skillId)) return this.skills.get(skill.skillId);
    if (this.skills.size >= this.maxSkills) throw new Error('skill registry capacity reached');
    const lineage = [{ action: String(skill.lineageAction ?? 'created'), parentSkillIds: [...(skill.parentSkillIds ?? [])], receiptSha256: skill.receiptSha256 }];
    const record = signed({ ...structuredClone(skill), lineage: freeze(lineage), transferEvidence: freeze([]), claims: { ...skill.claims, hiddenReasoningStored: false } });
    this.skills.set(record.skillId, record); return record;
  }
  get(skillId) { return this.skills.get(required(skillId, 'skillId')) ?? null; }
  recordTransfer(skillId, input = {}) {
    const current = this.get(skillId); if (!current) throw new Error(`Unknown skill: ${skillId}`);
    const sourceRepositoryId = required(input.sourceRepositoryId, 'sourceRepositoryId'); const targetRepositoryId = required(input.targetRepositoryId, 'targetRepositoryId');
    const sourceVocabulary = required(input.sourceVocabulary, 'sourceVocabulary'); const targetVocabulary = required(input.targetVocabulary, 'targetVocabulary');
    if (sourceRepositoryId === targetRepositoryId && sourceVocabulary === targetVocabulary) throw new Error('transfer test requires a different repository or vocabulary');
    const evidence = freeze({ sourceRepositoryId, targetRepositoryId, sourceVocabulary, targetVocabulary, passed: input.passed === true, receiptSha256: hash(input.receiptSha256, 'transfer receipt') });
    const state = evidence.passed ? 'transfer-tested' : 'rejected';
    const lineage = [...current.lineage, { action: evidence.passed ? 'transfer-tested' : 'rejected', parentSkillIds: [...current.parentSkillIds], receiptSha256: evidence.receiptSha256 }];
    const next = signed({ ...structuredClone(current), revision: Number(current.revision) + 1, state, transferEvidence: freeze([...current.transferEvidence, evidence]), lineage: freeze(lineage), claims: { ...current.claims, transferProven: evidence.passed } });
    this.skills.set(skillId, next); return next;
  }
  transition(skillId, nextState, { actor, reason, receiptSha256 } = {}) {
    const current = this.get(skillId); if (!current) throw new Error(`Unknown skill: ${skillId}`);
    const state = String(nextState); if (!STATES.has(state)) throw new TypeError(`unknown skill state: ${state}`);
    if (state === 'promoted' && current.state !== 'transfer-tested') throw new Error('skill must be transfer-tested before promotion');
    const receipt = hash(receiptSha256, 'transition receipt');
    const lineage = [...current.lineage, { action: state, actor: required(actor, 'actor'), reason: required(reason, 'reason'), parentSkillIds: [...current.parentSkillIds], receiptSha256: receipt }];
    const next = signed({ ...structuredClone(current), revision: Number(current.revision) + 1, state, lineage: freeze(lineage) });
    this.skills.set(skillId, next); return next;
  }
  snapshot() { return signed({ schema: 'forge.skill-registry-snapshot.v1', count: this.skills.size, skills: freeze([...this.skills.values()].map((item) => ({ skillId: item.skillId, revision: item.revision, state: item.state, parentSkillIds: item.parentSkillIds, receiptSha256: item.receiptSha256 }))), claims: { hiddenReasoningStored: false } }); }
}
