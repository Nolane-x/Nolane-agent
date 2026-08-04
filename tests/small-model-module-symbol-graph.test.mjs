import test from 'node:test';
import assert from 'node:assert/strict';
import { buildModuleSymbolGraph } from '../src/small-model/module-symbol-graph.mjs';
import { canonicalSha256 } from '../src/small-model/shared.mjs';

const files = [
  {
    path: 'src/api.mjs',
    source: `export function legacyName(value) { return value + 1; }\nexport const stable = 1;\n`,
  },
  {
    path: 'src/use.mjs',
    source: `import { legacyName } from './api.mjs';\nexport const result = legacyName(2);\n`,
  },
  {
    path: 'src/alias.mjs',
    source: `import { legacyName as run } from './api.mjs';\nexport const result = run(3);\n`,
  },
].map((file) => ({ ...file, sha256: canonicalSha256(file.source) }));

test('buildModuleSymbolGraph resolves named exports, direct imports, aliases, and binding uses', () => {
  const graph = buildModuleSymbolGraph({ files, entrypoints: ['src/api.mjs'] });
  assert.equal(graph.schema, 'nolane.small-model.module-symbol-graph.v1');
  assert.equal(graph.modules.length, 3);
  assert.deepEqual(graph.entrypoints, ['src/api.mjs']);
  const api = graph.modules.find((module) => module.path === 'src/api.mjs');
  assert.equal(api.exports.some((item) => item.exported === 'legacyName' && item.local === 'legacyName'), true);
  const direct = graph.modules.find((module) => module.path === 'src/use.mjs');
  assert.equal(direct.imports[0].imported, 'legacyName');
  assert.equal(direct.imports[0].local, 'legacyName');
  assert.equal(direct.imports[0].resolvedPath, 'src/api.mjs');
  assert.equal(direct.uses.filter((item) => item.binding === 'legacyName').length >= 1, true);
  const alias = graph.modules.find((module) => module.path === 'src/alias.mjs');
  assert.equal(alias.imports[0].local, 'run');
  assert.equal(alias.uses.some((item) => item.binding === 'run'), true);
  assert.equal(graph.edges.length, 2);
  assert.equal(graph.hiddenChainOfThoughtStored, false);
  assert.match(graph.receiptSha256, /^[a-f0-9]{64}$/);
});

test('buildModuleSymbolGraph rejects stale hashes, traversal, missing modules, and ambiguous duplicate exports', () => {
  assert.throws(() => buildModuleSymbolGraph({ files: [{ ...files[0], sha256: '0'.repeat(64) }] }), /hash/i);
  assert.throws(() => buildModuleSymbolGraph({ files: [{ path: '../escape.mjs', source: 'export const x = 1;', sha256: canonicalSha256('export const x = 1;') }] }), /path|traversal/i);
  const missing = [{ path: 'src/use.mjs', source: `import { x } from './missing.mjs';`, sha256: canonicalSha256(`import { x } from './missing.mjs';`) }];
  assert.throws(() => buildModuleSymbolGraph({ files: missing }), /missing|resolve/i);
  const ambiguousSource = `export const value = 1;\nexport { value as duplicate };\nexport const duplicate = 2;\n`;
  assert.throws(() => buildModuleSymbolGraph({ files: [{ path: 'src/a.mjs', source: ambiguousSource, sha256: canonicalSha256(ambiguousSource) }] }), /duplicate|ambiguous/i);
});

test('buildModuleSymbolGraph is deterministic and does not record hidden reasoning', () => {
  const first = buildModuleSymbolGraph({ files, entrypoints: ['src/api.mjs'] });
  const second = buildModuleSymbolGraph({ files: [...files].reverse(), entrypoints: ['src/api.mjs'] });
  assert.equal(first.receiptSha256, second.receiptSha256);
  assert.deepEqual(first.modules, second.modules);
  assert.equal(JSON.stringify(first).includes('chainOfThought'), false);
});
