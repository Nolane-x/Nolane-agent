import test from 'node:test';
import assert from 'node:assert/strict';
import { GrammarPackRegistry } from '../src/repository/grammar-pack-registry.mjs';

test('GrammarPackRegistry resolves a pinned grammar and proves runtime capability', async () => {
  const registry = new GrammarPackRegistry({ packs: [{ id: 'c', languageId: 'c', extensions: ['.c', '.h'], command: 'tree-sitter', expectedVersion: '0.25.0', grammarSha256: 'a'.repeat(64) }], runner: async (_command, args) => args[0] === '--version' ? { stdout: 'tree-sitter 0.25.0' } : { stdout: JSON.stringify({ type: 'translation_unit' }) } });
  const capability = await registry.capabilityForPath('src/main.c');
  assert.equal(capability.status, 'operated');
  assert.equal(capability.version, '0.25.0');
  assert.equal(capability.grammarSha256, 'a'.repeat(64));
  const parsed = await registry.parse({ file: 'src/main.c', absolutePath: '/repo/src/main.c' });
  assert.equal(parsed.tree.type, 'translation_unit');
  assert.match(parsed.receiptSha256, /^[a-f0-9]{64}$/);
});

test('GrammarPackRegistry reports explicit external gate on missing runtime or version mismatch', async () => {
  const missing = new GrammarPackRegistry({ packs: [{ id: 'python', languageId: 'python', extensions: ['.py'], command: 'tree-sitter', expectedVersion: '0.25.0', grammarSha256: 'b'.repeat(64) }], runner: async () => { const e = new Error('missing'); e.code = 'ENOENT'; throw e; } });
  assert.equal((await missing.capabilityForPath('a.py')).status, 'external-gate');
  const mismatch = new GrammarPackRegistry({ packs: [{ id: 'go', languageId: 'go', extensions: ['.go'], command: 'tree-sitter', expectedVersion: '0.25.0', grammarSha256: 'c'.repeat(64) }], runner: async () => ({ stdout: 'tree-sitter 0.24.0' }) });
  assert.equal((await mismatch.capabilityForPath('a.go')).reason, 'version-mismatch');
});
