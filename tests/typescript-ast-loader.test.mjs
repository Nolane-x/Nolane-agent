import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TypeScriptAstLoader,
  SUPPORTED_AST_EXTENSIONS,
  parseAstSource,
} from '../src/repository/typescript-ast-loader.mjs';

test('TypeScriptAstLoader loads the pinned vendored compiler and parses JS TS JSX and TSX', () => {
  const loader = new TypeScriptAstLoader();
  assert.equal(loader.compilerVersion, '5.8.3');
  assert.deepEqual([...SUPPORTED_AST_EXTENSIONS], ['.cjs', '.cts', '.js', '.jsx', '.mjs', '.mts', '.ts', '.tsx']);
  const fixtures = [
    ['src/a.js', 'export function a() { return 1; }'],
    ['src/a.ts', 'export const a: number = 1;'],
    ['src/a.jsx', 'export const A = () => <div>A</div>;'],
    ['src/a.tsx', 'export const A = (): JSX.Element => <div>A</div>;'],
  ];
  for (const [path, source] of fixtures) {
    const parsed = loader.parse({ path, source });
    assert.equal(parsed.compilerVersion, '5.8.3');
    assert.equal(parsed.sourceFile.fileName, path);
    assert.equal(parsed.diagnostics.length, 0);
  }
});

test('parseAstSource rejects unsupported extensions, oversized input, and syntax errors', () => {
  assert.throws(() => parseAstSource({ path: 'src/a.py', source: 'x = 1' }), /unsupported AST extension/i);
  assert.throws(() => parseAstSource({ path: 'src/a.ts', source: 'x'.repeat(2 * 1024 * 1024 + 1) }), /exceeds 2097152 bytes/i);
  assert.throws(() => parseAstSource({ path: 'src/a.ts', source: 'export const = ;' }), (error) => error.code === 'AST_PARSE_FAILED' && error.diagnostics.length > 0);
});
