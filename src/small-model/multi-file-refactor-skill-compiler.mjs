import path from 'node:path';
import { canonicalSha256, deepFreeze } from './shared.mjs';

function verifyReceipt(value, label) {
  if (!value || !/^[a-f0-9]{64}$/.test(String(value.receiptSha256 ?? ''))) throw new Error(`${label} receipt is invalid`);
  const { receiptSha256, ...base } = value;
  if (canonicalSha256(base) !== receiptSha256) throw new Error(`${label} receipt hash mismatch`);
  return value;
}

function safePath(value) {
  const text = String(value ?? '').replaceAll('\\', '/');
  if (!text || path.posix.isAbsolute(text) || text.split('/').includes('..')) throw new Error('Refactor skill path scope is unsafe');
  return path.posix.normalize(text);
}

export class MultiFileRefactorSkillCompiler {
  compile({ id, version, missions } = {}) {
    if (!String(id ?? '').trim() || !String(version ?? '').trim()) throw new Error('Refactor skill identity and version are required');
    if (!Array.isArray(missions) || missions.length < 2) throw new Error('At least two verified refactor missions are required');
    const verified = missions.map((mission, index) => verifyReceipt(mission, `Refactor mission ${index}`));
    const repositoryIds = verified.map((mission) => mission.repositoryId);
    if (new Set(repositoryIds).size !== repositoryIds.length) throw new Error('Refactor skill missions must use distinct repositories');
    for (const mission of verified) {
      if (mission.schema !== 'nolane.small-model.multi-file-refactor-mission.v1' || mission.status !== 'verified-recovery' || mission.trackedSourcesUnchanged !== true || mission.rollbackRestoredAllHashes !== true || mission.bestCandidatePreserved !== true || mission.hiddenChainOfThoughtStored !== false) throw new Error('Refactor mission is not verified public-state evidence');
    }
    const operationHash = canonicalSha256(verified[0].declaredRepair);
    if (!verified.every((mission) => canonicalSha256(mission.declaredRepair) === operationHash)) throw new Error('Refactor mission repair operations do not match');
    const allowedPaths = [...verified[0].sourcePaths].map(safePath).sort();
    if (!verified.every((mission) => canonicalSha256([...mission.sourcePaths].map(safePath).sort()) === canonicalSha256(allowedPaths))) throw new Error('Refactor mission path scopes do not match');
    const operation = { ...verified[0].declaredRepair };
    const rollbackOperation = { ...verified[0].declaredMutation };
    const base = {
      schema: 'nolane.small-model.multi-file-refactor-skill.v1',
      id: String(id),
      version: String(version),
      kind: 'type-aware-multi-file-refactor',
      operation,
      rollbackOperation,
      allowedPaths,
      maxChangedFiles: Math.max(...verified.map((mission) => mission.changedFiles)),
      maxChangedTokens: Math.max(...verified.map((mission) => mission.changedTokens)),
      sourceRepositoryIds: [...repositoryIds].sort(),
      sourceMissionReceiptSha256: verified.map((mission) => mission.receiptSha256).sort(),
      hiddenChainOfThoughtStored: false,
      soundnessScope: ['named ES module export rename', 'direct named imports', 'bound identifier references'],
      knownIncompleteness: ['namespace imports and re-export chains are unsupported', 'TypeScript type space is not modeled'],
      claims: { boundedMultiFileRefactor: true, externalRepositoryGeneralization: false, generalCodingIntelligence: false },
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
}
