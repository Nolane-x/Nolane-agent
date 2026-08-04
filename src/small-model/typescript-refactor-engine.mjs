import { canonicalSha256, deepFreeze } from './shared.mjs';
import { TypeScriptSemanticWorkspace } from './typescript-semantic-workspace.mjs';

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
function apply(source, replacements) {
  let output = source;
  for (const item of [...replacements].sort((a, b) => b.start - a.start)) output = `${output.slice(0, item.start)}${item.value}${output.slice(item.start + item.length)}`;
  return output;
}
export class TypeScriptRefactorEngine {
  plan({ files, target, replacement, allowedPaths } = {}) {
    if (!IDENTIFIER.test(String(replacement ?? ''))) throw new Error('TypeScript replacement identifier is invalid');
    const allowed = new Set((allowedPaths ?? []).map(String));
    if (!Array.isArray(files) || files.length < 1 || allowed.size !== files.length) throw new Error('TypeScript refactor requires an exact allowed path set');
    for (const file of files) if (!allowed.has(file.path)) throw new Error('TypeScript refactor path is outside the allowed scope');
    const workspace = new TypeScriptSemanticWorkspace({ files });
    const locations = workspace.findRenameLocations({ path: target?.path, name: target?.name });
    const byPath = new Map(files.map((file) => [file.path, []]));
    for (const location of locations) {
      if (!allowed.has(location.path)) throw new Error('TypeScript rename location escaped allowed scope');
      byPath.get(location.path).push({ ...location, value: replacement });
    }
    const planned = files.map((file) => {
      const output = apply(file.source, byPath.get(file.path));
      return { path: file.path, inputSha256: file.sha256, outputSha256: canonicalSha256(output), changedTokens: byPath.get(file.path).length, output, rollbackSource: file.source, rollbackSha256: file.sha256 };
    }).sort((a, b) => a.path.localeCompare(b.path));
    const changedFiles = planned.filter((file) => file.inputSha256 !== file.outputSha256).length;
    const changedTokens = planned.reduce((sum, file) => sum + file.changedTokens, 0);
    if (!changedFiles || !changedTokens) throw new Error('TypeScript refactor produced no changes');
    new TypeScriptSemanticWorkspace({ files: planned.map((file) => ({ path: file.path, source: file.output, sha256: file.outputSha256 })) });
    const base = { schema: 'nolane.small-model.typescript-refactor-plan.v1', target, replacement, files: planned, changedFiles, changedTokens, diagnostics: [], compilerVersion: '5.8.3', executedSource: false, shellUsed: false, hiddenChainOfThoughtStored: false, soundnessScope: ['TypeScript interface rename', 'type-only imports', 'namespace imports', 'direct re-exports', 'export-star chains'], claims: { boundedTypeScriptRefactor: true, externalRepositoryGeneralization: false, generalCodingIntelligence: false } };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
}
