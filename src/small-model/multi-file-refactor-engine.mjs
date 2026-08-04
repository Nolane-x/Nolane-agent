import path from 'node:path';
import { buildModuleSymbolGraph } from './module-symbol-graph.mjs';
import { canonicalSha256, deepFreeze } from './shared.mjs';

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function safePath(value) {
  const text = String(value ?? '').replaceAll('\\', '/');
  if (!text || path.posix.isAbsolute(text) || text.split('/').includes('..')) throw new Error('Refactor module path traversal is forbidden');
  return path.posix.normalize(text);
}

function verifyOperation(operation) {
  if (operation?.op !== 'rename-exported-symbol') throw new TypeError('rename-exported-symbol operation is required');
  const modulePath = safePath(operation.modulePath);
  const from = String(operation.from ?? '');
  const to = String(operation.to ?? '');
  if (!IDENTIFIER.test(from) || !IDENTIFIER.test(to) || from === to) throw new Error('Refactor identifiers are invalid');
  return { op: 'rename-exported-symbol', modulePath, from, to };
}

function addReplacement(map, occurrence, value) {
  if (!occurrence || !Number.isInteger(occurrence.start) || !Number.isInteger(occurrence.end)) throw new Error('Refactor occurrence is invalid');
  const key = `${occurrence.start}:${occurrence.end}`;
  const existing = map.get(key);
  if (existing && existing.value !== value) throw new Error('Conflicting refactor replacements');
  map.set(key, { start: occurrence.start, end: occurrence.end, value });
}

function applyReplacements(source, replacements) {
  let output = source;
  for (const replacement of [...replacements].sort((a, b) => b.start - a.start || b.end - a.end)) {
    output = `${output.slice(0, replacement.start)}${replacement.value}${output.slice(replacement.end)}`;
  }
  return output;
}

export class MultiFileRefactorEngine {
  plan({ files, operation: input } = {}) {
    const operation = verifyOperation(input);
    const graph = buildModuleSymbolGraph({ files, entrypoints: [operation.modulePath] });
    const target = graph.modules.find((module) => module.path === operation.modulePath);
    if (!target) throw new Error('Refactor target module is missing');
    const exported = target.exports.filter((item) => item.exported === operation.from);
    if (exported.length !== 1) throw new Error(`Refactor export is missing or ambiguous: ${operation.from}`);
    if (target.exports.some((item) => item.exported === operation.to) || target.declarations.some((item) => item.name === operation.to) || target.imports.some((item) => item.local === operation.to)) throw new Error(`Refactor target collision: ${operation.to}`);
    const targetLocal = exported[0].local;
    const replacementsByPath = new Map(graph.modules.map((module) => [module.path, new Map()]));

    const targetMap = replacementsByPath.get(target.path);
    for (const item of target.exports.filter((entry) => entry.local === targetLocal || entry.exported === operation.from)) {
      if (item.local === targetLocal) addReplacement(targetMap, item.localOccurrence, operation.to);
      if (item.exported === operation.from) addReplacement(targetMap, item.exportedOccurrence, operation.to);
    }
    for (const use of target.uses.filter((item) => item.binding === targetLocal)) addReplacement(targetMap, use, operation.to);

    for (const module of graph.modules) {
      if (module.path === target.path) continue;
      const map = replacementsByPath.get(module.path);
      for (const imported of module.imports.filter((item) => item.resolvedPath === target.path && item.imported === operation.from)) {
        addReplacement(map, imported.importedOccurrence, operation.to);
        if (imported.local === operation.from) {
          if (module.declarations.some((item) => item.name === operation.to) || module.imports.some((item) => item !== imported && item.local === operation.to)) throw new Error(`Refactor consumer collision in ${module.path}: ${operation.to}`);
          addReplacement(map, imported.localOccurrence, operation.to);
          for (const use of module.uses.filter((item) => item.binding === imported.local)) addReplacement(map, use, operation.to);
        }
      }
    }

    const originalByPath = new Map(files.map((file) => [String(file.path).replaceAll('\\', '/'), String(file.source)]));
    let changedTokens = 0;
    const planned = graph.modules.map((module) => {
      const source = originalByPath.get(module.path);
      const replacements = [...replacementsByPath.get(module.path).values()];
      changedTokens += replacements.length;
      const output = applyReplacements(source, replacements);
      return {
        path: module.path,
        inputSha256: canonicalSha256(source),
        outputSha256: canonicalSha256(output),
        changedTokens: replacements.length,
        replacements: replacements.sort((a, b) => a.start - b.start),
        output,
      };
    });
    const changedFiles = planned.filter((file) => file.inputSha256 !== file.outputSha256).length;
    if (changedFiles < 1 || changedTokens < 1) throw new Error('Refactor operation produced no changes');

    buildModuleSymbolGraph({ files: planned.map((file) => ({ path: file.path, source: file.output, sha256: file.outputSha256 })), entrypoints: [operation.modulePath] });
    const base = {
      schema: 'nolane.small-model.multi-file-refactor-plan.v1',
      operation,
      graphReceiptSha256: graph.receiptSha256,
      files: planned,
      changedFiles,
      changedTokens,
      executedSource: false,
      shellUsed: false,
      hiddenChainOfThoughtStored: false,
      soundnessScope: ['named ES module exports/imports', 'top-level declaration bindings', 'direct imported binding references'],
      knownIncompleteness: ['namespace imports are unsupported', 're-export chains are unsupported', 'TypeScript type space is not modeled'],
      claims: { boundedMultiFileRefactor: true, typeScriptCompiler: false, externalRepositoryGeneralization: false, generalCodingIntelligence: false },
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
}
