import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { AstIntelligenceService } from '../src/repository/ast-intelligence-service.mjs';
import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-ast-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src'), { recursive: true });
  const source = [
    'export class Counter {',
    '  value = 0;',
    '  increment(step: number = 1) {',
    '    this.value += step;',
    '    return this.value;',
    '  }',
    '}',
    '',
    'export function add(a: number, b: number) {',
    '  return a + b;',
    '}',
    '',
    'export const doubled = [1, 2].map((value) => value * 2);',
    '',
  ].join('\n');
  await writeFile(path.join(root, 'src', 'sample.ts'), source, { mode: 0o640 });
  return { root, source, service: new AstIntelligenceService({ workspaceRoot: root, allowedPaths: ['src/**'] }) };
}

test('AstIntelligenceService queries exact node kinds with names, ancestors, bounded previews, and receipts', async (t) => {
  const f = await fixture(t);
  const methods = await f.service.query({ path: 'src/sample.ts', nodeType: 'MethodDeclaration', name: 'increment' });
  assert.equal(methods.items.length, 1);
  assert.equal(methods.items[0].nodeType, 'MethodDeclaration');
  assert.equal(methods.items[0].name, 'increment');
  assert.equal(methods.items[0].startLine, 3);
  assert.equal(methods.items[0].endLine, 6);
  assert.match(methods.items[0].preview, /this\.value/);
  assert.match(methods.sourceSha256, /^[a-f0-9]{64}$/);
  assert.match(methods.items[0].nodeSha256, /^[a-f0-9]{64}$/);
  assert.match(methods.receiptSha256, /^[a-f0-9]{64}$/);

  const identifiers = await f.service.query({ path: 'src/sample.ts', nodeType: 'Identifier', ancestorType: 'ArrowFunction', textContains: 'value', limit: 2 });
  assert.equal(identifiers.items.length, 2);
  assert.ok(identifiers.items.every((item) => item.preview.includes('value')));
  assert.equal(Object.isFrozen(identifiers.items), true);
});

test('AstIntelligenceService validates selectors, limits, supported files, and workspace ownership', async (t) => {
  const f = await fixture(t);
  await assert.rejects(() => f.service.query({ path: 'src/sample.ts' }), (error) => error.code === 'AST_NODE_TYPE_REQUIRED');
  await assert.rejects(() => f.service.query({ path: 'src/sample.ts', nodeType: 'NoSuchKind' }), (error) => error.code === 'AST_NODE_TYPE_UNKNOWN');
  await assert.rejects(() => f.service.query({ path: 'src/sample.ts', nodeType: 'Identifier', limit: 201 }), (error) => error.code === 'AST_LIMIT_INVALID');
  await writeFile(path.join(f.root, 'outside.ts'), 'export const secret = 1;\n');
  await assert.rejects(() => f.service.query({ path: 'outside.ts', nodeType: 'Identifier' }), /outside task-owned paths/i);
  await writeFile(path.join(f.root, 'src', 'note.txt'), 'hello');
  await assert.rejects(() => f.service.query({ path: 'src/note.txt', nodeType: 'Identifier' }), /unsupported AST extension/i);
});

test('AstIntelligenceService dry-runs and atomically applies an exact hash-guarded AST patch', async (t) => {
  const f = await fixture(t);
  const query = await f.service.query({ path: 'src/sample.ts', nodeType: 'FunctionDeclaration', name: 'add' });
  const originalMode = (await stat(path.join(f.root, 'src', 'sample.ts'))).mode & 0o777;
  const replacement = 'export function add(a: number, b: number) {\n  return Number(a) + Number(b);\n}';
  const dry = await f.service.patch({
    path: 'src/sample.ts', nodeType: 'FunctionDeclaration', name: 'add',
    expectedSha256: query.sourceSha256, expectedNodeSha256: query.items[0].nodeSha256,
    replacement, dryRun: true,
  });
  assert.equal(dry.applied, false);
  assert.equal(dry.dryRun, true);
  assert.notEqual(dry.beforeSha256, dry.afterSha256);
  assert.equal(await readFile(path.join(f.root, 'src', 'sample.ts'), 'utf8'), f.source);

  const applied = await f.service.patch({
    path: 'src/sample.ts', nodeType: 'FunctionDeclaration', name: 'add',
    expectedSha256: query.sourceSha256, expectedNodeSha256: query.items[0].nodeSha256,
    replacement,
  });
  assert.equal(applied.applied, true);
  assert.equal(applied.dryRun, false);
  assert.match(applied.receiptSha256, /^[a-f0-9]{64}$/);
  assert.ok(applied.changedLines >= 1);
  assert.match(applied.preview.after, /Number\(a\)/);
  const final = await readFile(path.join(f.root, 'src', 'sample.ts'), 'utf8');
  assert.match(final, /Number\(a\) \+ Number\(b\)/);
  assert.equal((await stat(path.join(f.root, 'src', 'sample.ts'))).mode & 0o777, originalMode);
});

test('AstIntelligenceService rejects missing or stale hashes, ambiguous selectors, generated code, and invalid replacement syntax', async (t) => {
  const f = await fixture(t);
  const query = await f.service.query({ path: 'src/sample.ts', nodeType: 'FunctionDeclaration', name: 'add' });
  await assert.rejects(() => f.service.patch({ path: 'src/sample.ts', nodeType: 'FunctionDeclaration', name: 'add', replacement: 'function add() {}' }), (error) => error.code === 'AST_EXPECTED_SHA256_REQUIRED');
  await assert.rejects(() => f.service.patch({ path: 'src/sample.ts', nodeType: 'FunctionDeclaration', name: 'add', expectedSha256: '0'.repeat(64), replacement: 'function add() {}' }), (error) => error.code === 'AST_STALE_FILE');
  await assert.rejects(() => f.service.patch({ path: 'src/sample.ts', nodeType: 'FunctionDeclaration', name: 'add', expectedSha256: query.sourceSha256, expectedNodeSha256: '1'.repeat(64), replacement: 'function add() {}' }), (error) => error.code === 'AST_STALE_NODE');
  await assert.rejects(() => f.service.patch({ path: 'src/sample.ts', nodeType: 'Identifier', expectedSha256: query.sourceSha256, replacement: 'x' }), (error) => error.code === 'AST_NODE_AMBIGUOUS');
  await assert.rejects(() => f.service.patch({ path: 'src/sample.ts', nodeType: 'FunctionDeclaration', name: 'add', expectedSha256: query.sourceSha256, replacement: 'export function add( {' }), (error) => error.code === 'AST_PARSE_FAILED');
  assert.equal(await readFile(path.join(f.root, 'src', 'sample.ts'), 'utf8'), f.source);

  await mkdir(path.join(f.root, 'src', 'generated'), { recursive: true });
  const generated = 'export function generated() { return 1; }\n';
  await writeFile(path.join(f.root, 'src', 'generated', 'client.ts'), generated);
  await assert.rejects(() => f.service.patch({ path: 'src/generated/client.ts', nodeType: 'FunctionDeclaration', name: 'generated', expectedSha256: canonicalSha256(generated), replacement: 'export function generated() { return 2; }' }), (error) => error.code === 'AST_GENERATED_CODE_DENIED');
});

test('AstIntelligenceService preserves CRLF when applying replacement text', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-ast-crlf-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src'), { recursive: true });
  const source = 'export function value() {\r\n  return 1;\r\n}\r\n';
  await writeFile(path.join(root, 'src', 'value.ts'), source);
  const service = new AstIntelligenceService({ workspaceRoot: root, allowedPaths: ['src/**'] });
  const query = await service.query({ path: 'src/value.ts', nodeType: 'FunctionDeclaration', name: 'value' });
  await service.patch({
    path: 'src/value.ts', nodeType: 'FunctionDeclaration', name: 'value', expectedSha256: query.sourceSha256,
    replacement: 'export function value() {\n  return 2;\n}',
  });
  const final = await readFile(path.join(root, 'src', 'value.ts'), 'utf8');
  assert.equal(final, 'export function value() {\r\n  return 2;\r\n}\r\n');
});
