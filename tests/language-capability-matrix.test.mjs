import test from 'node:test';
import assert from 'node:assert/strict';
import { LanguageCapabilityMatrix } from '../src/repository/language-capability-matrix.mjs';

test('LanguageCapabilityMatrix reports operated and degraded capabilities without inflating parity', () => {
  const matrix = new LanguageCapabilityMatrix({ languages: [{ id: 'typescript', extensions: ['.ts'], parser: { status: 'operated', provider: 'typescript-compiler', version: '5.9.2', evidenceId: 'ev-ts' }, lsp: { status: 'external-gate', provider: 'typescript-language-server' } }, { id: 'ruby', extensions: ['.rb'], parser: { status: 'degraded', provider: 'lexical' } }] });
  assert.equal(matrix.resolveByPath('src/a.ts').id, 'typescript');
  assert.equal(matrix.status('typescript').parser.status, 'operated');
  assert.equal(matrix.status('typescript').lsp.status, 'external-gate');
  assert.equal(matrix.status('ruby').parityClaimed, false);
  assert.match(matrix.snapshot().receiptSha256, /^[a-f0-9]{64}$/);
});

test('LanguageCapabilityMatrix rejects unsupported status and duplicate extensions', () => {
  assert.throws(() => new LanguageCapabilityMatrix({ languages: [{ id: 'bad', extensions: ['.x'], parser: { status: 'magic' } }] }), /LANGUAGE_CAPABILITY_STATUS_INVALID/);
  assert.throws(() => new LanguageCapabilityMatrix({ languages: [{ id: 'a', extensions: ['.x'] }, { id: 'b', extensions: ['.x'] }] }), /LANGUAGE_CAPABILITY_EXTENSION_DUPLICATE/);
});
