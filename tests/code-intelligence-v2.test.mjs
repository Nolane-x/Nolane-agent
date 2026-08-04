import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LanguageServerRegistry } from '../src/repository/language-server-registry.mjs';
import { LspSessionPool } from '../src/repository/lsp-session-pool.mjs';
import { CodeIntelligenceService } from '../src/repository/code-intelligence-service.mjs';
const root = path.dirname(fileURLToPath(import.meta.url));
const fakeServer = path.join(root, 'fixtures', 'fake-lsp-server.mjs');

test('CodeIntelligenceService V2 exposes hover, rename, type definition and diagnostics through a shared session', async () => {
  const registry = new LanguageServerRegistry({ servers: [{ id: 'typescript', languageIds: ['typescript'], command: process.execPath, args: [fakeServer], timeoutMs: 1000 }] });
  const pool = new LspSessionPool({ idleTtlMs: 50 });
  const service = new CodeIntelligenceService({ registry, sessionPool: pool });
  const input = { projectRoot: '/workspace', languageId: 'typescript', uri: 'file:///workspace/src/math.ts', line: 0, character: 17 };
  const hover = await service.hover(input);
  assert.equal(hover.source, 'lsp');
  assert.match(JSON.stringify(hover.result), /add/);
  const rename = await service.rename({ ...input, newName: 'sum' });
  assert.equal(rename.result.changes[input.uri][0].newText, 'sum');
  const types = await service.typeDefinition(input);
  assert.equal(types.items[0].path, 'src/types.ts');
  const diagnostics = await service.diagnostics({ projectRoot: '/workspace', languageId: 'typescript', uri: input.uri, text: 'export function add(a,b){return a+b}' });
  assert.equal(diagnostics.items[0].message, 'Example warning');
  assert.equal(pool.snapshot().sessions.length, 1);
  await pool.close();
});
