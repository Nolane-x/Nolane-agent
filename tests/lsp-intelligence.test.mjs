import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LspClient } from '../src/repository/lsp-client.mjs';
import { LanguageServerRegistry } from '../src/repository/language-server-registry.mjs';
import { CodeIntelligenceService } from '../src/repository/code-intelligence-service.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const fakeServer = path.join(root, 'fixtures', 'fake-lsp-server.mjs');

async function waitFor(predicate, timeoutMs = 1_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for LSP notification`);
}

test('LspClient frames JSON-RPC, synchronizes documents, and exposes symbols, definitions, references, diagnostics, and call hierarchy', async (t) => {
  const client = new LspClient({ command: process.execPath, args: [fakeServer], cwd: root, timeoutMs: 1_000, maxMessageBytes: 128 * 1024 });
  t.after(() => client.dispose());
  const initialized = await client.initialize({ rootUri: 'file:///workspace', capabilities: {} });
  assert.equal(initialized.capabilities.definitionProvider, true);
  const uri = 'file:///workspace/src/math.ts';
  await client.openDocument({ uri, languageId: 'typescript', text: 'export function add(a,b){return a+b}', version: 1 });
  const diagnostics = await waitFor(() => client.diagnostics(uri).length ? client.diagnostics(uri) : null);
  assert.equal(diagnostics[0].message, 'Example warning');
  const symbols = await client.workspaceSymbols('add');
  assert.equal(symbols[0].name, 'add');
  const definitions = await client.definition({ uri, line: 2, character: 7 });
  assert.equal(definitions[0].uri, uri);
  const references = await client.references({ uri, line: 2, character: 7, includeDeclaration: true });
  assert.equal(references.length, 2);
  const documentSymbols = await client.documentSymbols(uri);
  assert.equal(documentSymbols[0].name, 'add');
  const hierarchy = await client.callHierarchy({ uri, line: 0, character: 17 });
  assert.equal(hierarchy.items[0].name, 'add');
  assert.equal(hierarchy.incoming[0].from.name, 'test add');
  await client.shutdown();
});

test('LspClient times out and sends cancellation without hanging the session', async (t) => {
  const client = new LspClient({ command: process.execPath, args: [fakeServer], cwd: root, timeoutMs: 1_000, maxMessageBytes: 128 * 1024 });
  t.after(() => client.dispose());
  await client.initialize({ rootUri: 'file:///workspace', capabilities: {} });
  await assert.rejects(() => client.request('forge/slow', {}, { timeoutMs: 40 }), /LSP_TIMEOUT/);
});

test('LanguageServerRegistry resolves configured servers without shell execution and rejects unknown languages', () => {
  const registry = new LanguageServerRegistry({ servers: [{ id: 'typescript', languageIds: ['typescript', 'javascript'], command: process.execPath, args: [fakeServer], timeoutMs: 1000 }] });
  const definition = registry.resolve('typescript', '/workspace');
  assert.equal(definition.command, process.execPath);
  assert.deepEqual(definition.args, [fakeServer]);
  assert.equal(definition.shell, false);
  assert.equal(registry.resolve('python', '/workspace'), null);
  assert.throws(() => new LanguageServerRegistry({ servers: [{ id: 'bad', languageIds: ['typescript'], command: '', args: [] }] }), /LANGUAGE_SERVER_SCHEMA/);
});

test('CodeIntelligenceService normalizes bounded LSP results and falls back to RepositoryIndex symbols', async () => {
  const registry = new LanguageServerRegistry({ servers: [{ id: 'typescript', languageIds: ['typescript'], command: process.execPath, args: [fakeServer], timeoutMs: 1000 }] });
  const repositoryIndex = { symbols(projectId, options) { return [{ path: options.path ?? 'fallback.ts', kind: 'function', name: options.query ?? 'fallback', line: 4, signature: 'function fallback()' }]; } };
  const service = new CodeIntelligenceService({ registry, repositoryIndex, maxResults: 1 });
  const lsp = await service.workspaceSymbols({ projectId: 'p1', projectRoot: '/workspace', languageId: 'typescript', query: 'add' });
  assert.equal(lsp.source, 'lsp');
  assert.equal(lsp.items.length, 1);
  assert.equal(lsp.items[0].path, 'src/math.ts');
  assert.equal(lsp.items[0].range.start.line, 1);
  const fallback = await service.workspaceSymbols({ projectId: 'p1', projectRoot: '/workspace', languageId: 'python', query: 'fallback' });
  assert.equal(fallback.source, 'repository-index');
  assert.equal(fallback.items[0].line, 4);
});
