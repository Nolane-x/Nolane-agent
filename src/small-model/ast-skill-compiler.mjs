import path from 'node:path';
import { canonicalSha256, deepFreeze } from './shared.mjs';

const SHA256 = /^[a-f0-9]{64}$/;

function safeRelative(value) {
  const text = String(value ?? '').replaceAll('\\', '/');
  if (!text || path.posix.isAbsolute(text) || text.split('/').includes('..')) throw new Error('AST skill path scope is unsafe');
  return text;
}

function verifyReceipt(value, label) {
  if (!value || !SHA256.test(String(value.receiptSha256 ?? ''))) throw new Error(`${label} receipt is invalid`);
  const { receiptSha256, ...base } = value;
  if (canonicalSha256(base) !== receiptSha256) throw new Error(`${label} receipt hash mismatch`);
  return value;
}

function normalizeOperation(operation) {
  if (!operation || operation.op !== 'rename-identifier') throw new Error('AST skill supports rename-identifier operations only');
  if (operation.scope !== 'program') throw new Error('AST skill rename scope must be program');
  const from = String(operation.from ?? '');
  const to = String(operation.to ?? '');
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(from) || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(to) || from === to) throw new Error('AST skill identifiers are invalid');
  return { op: 'rename-identifier', from, to, scope: 'program' };
}

function validateMission(mission, index) {
  verifyReceipt(mission, `AST mission ${index}`);
  if (mission.schema !== 'nolane.small-model.ast-recovery-mission.v1' || mission.status !== 'verified-recovery') throw new Error(`AST mission ${index} is not a verified recovery`);
  if (!mission.repositoryId || !mission.missionId || !mission.declaredRepair?.path) throw new Error(`AST mission ${index} lacks identity or repair path`);
  if (mission.hiddenChainOfThoughtStored !== false) throw new Error(`AST mission ${index} must contain public evidence only`);
  if (mission.trackedSourceUnchanged !== true || mission.bestCandidatePreserved !== true || mission.rollbackRestoredMutationHash !== true) throw new Error(`AST mission ${index} lacks preservation evidence`);
  if (mission.repair?.exitCode !== 0 || mission.baseline?.exitCode !== 0 || mission.mutation?.exitCode === 0) throw new Error(`AST mission ${index} verifier outcomes are invalid`);
  return {
    mission,
    operation: normalizeOperation(mission.declaredRepair.operation),
    sourcePath: safeRelative(mission.declaredRepair.path),
  };
}

export class AstSkillCompiler {
  compile({ id, version, missions } = {}) {
    if (!String(id ?? '').trim() || !String(version ?? '').trim() || !Array.isArray(missions) || missions.length < 2) throw new TypeError('AST skill id, version and at least two verified missions are required');
    const values = missions.map(validateMission);
    if (new Set(values.map(({ mission }) => mission.receiptSha256)).size !== values.length) throw new Error('AST induction missions must have distinct receipts');
    if (new Set(values.map(({ mission }) => mission.repositoryId)).size !== values.length) throw new Error('AST induction missions must use distinct repositories');
    const operation = values[0].operation;
    const sourcePath = values[0].sourcePath;
    for (const value of values.slice(1)) {
      if (canonicalSha256(value.operation) !== canonicalSha256(operation)) throw new Error('AST induction operations must match exactly');
      if (value.sourcePath !== sourcePath) throw new Error('AST induction path scopes must match exactly');
    }
    const rollback = { op: 'rename-identifier', from: operation.to, to: operation.from, scope: 'program' };
    const base = {
      schema: 'nolane.small-model.ast-skill.v2', id: String(id), version: String(version), kind: 'ast-codemod', language: 'javascript',
      operations: [operation], rollbackOperations: [rollback], allowedPaths: [sourcePath], maxChangedTokens: 4,
      verifierObligations: ['baseline-pass', 'mutation-fail', 'repair-pass', 'parse-valid', 'rollback-restores-mutation-hash', 'tracked-source-unchanged'],
      soundnessScope: ['javascript-lossless-token-tree', 'program-scope-identifier-rename', `path:${sourcePath}`],
      knownIncompleteness: ['does-not-claim-full-ecmascript-binding-analysis', 'abstains-on-shadowed-or-out-of-scope-identifiers', 'does-not-rewrite-comments-strings-or-template-literals'],
      inductionMissionIds: values.map(({ mission }) => mission.missionId).sort(),
      inductionReceiptSha256: values.map(({ mission }) => mission.receiptSha256).sort(),
      sourceRepositoryIds: values.map(({ mission }) => mission.repositoryId).sort(),
      hiddenChainOfThoughtStored: false,
      claims: { boundedAstSkill: true, externalRepositoryGeneralization: false, generalCodingIntelligence: false, competitorSuperiority: false },
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
}
