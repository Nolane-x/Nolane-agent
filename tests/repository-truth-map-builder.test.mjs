import assert from 'node:assert/strict';
import test from 'node:test';

import { RepositoryFactLedger } from '../src/repository/repository-fact-ledger.mjs';
import { RepositoryTruthMapBuilder } from '../src/repository/repository-truth-map-builder.mjs';

const H = {
  pkg: '1'.repeat(64), api: '2'.repeat(64), internal: '3'.repeat(64), test: '4'.repeat(64),
  config: '5'.repeat(64), schema: '6'.repeat(64), runtime: '7'.repeat(64), overlay: '8'.repeat(64),
};
const branchContext = { branch: 'feature/truth', worktree: '/repo', headSha: 'a'.repeat(40), dirtyHash: 'dirty-1', editorOverlayHash: null };

function fixture() {
  return {
    project: { id: 'truth_project', name: 'Truth', workspaceRoot: '/repo' },
    branchContext,
    files: [
      { path: 'package.json', sha256: H.pkg, language: 'json', content: JSON.stringify({ name: 'truth-app', scripts: { build: 'node build.mjs', test: 'node --test' }, dependencies: { fastify: '^5.0.0' } }) },
      { path: 'src/api/session.mjs', sha256: H.api, language: 'javascript', content: "export function createSession(user) { return writeSession(user); }\nfunction writeSession(user) { return user.id; }\n" },
      { path: 'src/internal/token.mjs', sha256: H.internal, language: 'javascript', content: 'export const TOKEN_TTL = 60;\n' },
      { path: 'tests/session.test.mjs', sha256: H.test, language: 'javascript', content: "import { createSession } from '../src/api/session.mjs';\ncreateSession({id:'u1'});\n" },
      { path: 'config/app.json', sha256: H.config, language: 'json', content: '{"sessionTtl":60}' },
      { path: 'db/schema.sql', sha256: H.schema, language: 'sql', content: 'CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL);' },
    ],
    symbols: [
      { path: 'src/api/session.mjs', kind: 'function', name: 'createSession', line: 1, signature: 'export function createSession(user)' },
      { path: 'src/api/session.mjs', kind: 'function', name: 'writeSession', line: 2, signature: 'function writeSession(user)' },
      { path: 'src/internal/token.mjs', kind: 'constant', name: 'TOKEN_TTL', line: 1, signature: 'export const TOKEN_TTL' },
    ],
    imports: [{ sourcePath: 'tests/session.test.mjs', targetPath: 'src/api/session.mjs' }],
    relationshipEdges: [
      { kind: 'calls', from: 'symbol:createSession', to: 'symbol:writeSession', citation: { path: 'src/api/session.mjs', line: 1, sourceHash: H.api }, confidence: 'ast' },
      { kind: 'writes', from: 'symbol:writeSession', to: 'schema:sessions', citation: { path: 'src/api/session.mjs', line: 2, sourceHash: H.api }, confidence: 'ast' },
      { kind: 'controls', from: 'config:config/app.json', to: 'service:session', citation: { path: 'config/app.json', line: 1, sourceHash: H.config }, confidence: 'exact' },
    ],
    runtimeEdges: [
      { kind: 'request', from: 'request:POST /sessions', to: 'service:session', citation: { path: 'runtime/session.ndjson', line: 1, sourceHash: H.runtime }, confidence: 'runtime-observed' },
      { kind: 'event', from: 'service:session', to: 'event:session.created', citation: { path: 'runtime/session.ndjson', line: 2, sourceHash: H.runtime }, confidence: 'runtime-observed' },
      { kind: 'process', from: 'process:api', to: 'service:session', citation: { path: 'runtime/session.ndjson', line: 3, sourceHash: H.runtime }, confidence: 'runtime-observed' },
      { kind: 'state', from: 'state:anonymous', to: 'state:authenticated', citation: { path: 'runtime/session.ndjson', line: 4, sourceHash: H.runtime }, confidence: 'runtime-observed' },
      { kind: 'data-flow', from: 'request:POST /sessions', to: 'schema:sessions', citation: { path: 'runtime/session.ndjson', line: 5, sourceHash: H.runtime }, confidence: 'runtime-observed' },
    ],
  };
}

test('RepositoryTruthMapBuilder models architecture surfaces, schemas, config, targets, services, layers, and domains with citations', () => {
  const ledger = new RepositoryFactLedger();
  const result = new RepositoryTruthMapBuilder({ ledger }).build(fixture());
  const kinds = new Set(result.architecture.nodes.map((node) => node.kind));
  for (const kind of ['public-api','internal-api','database-schema','configuration','build-target','external-dependency','service','layer','domain']) assert.equal(kinds.has(kind), true, kind);
  assert.ok(result.architecture.edges.some((edge) => edge.kind === 'controls'));
  assert.ok(result.architecture.nodes.every((node) => node.kind === 'workspace' || node.citation?.sourceHash?.length === 64));
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
  assert.ok(ledger.size > 0);
});

test('RepositoryTruthMapBuilder models definitions, references, callers, types, implementations, and verifying tests', () => {
  const result = new RepositoryTruthMapBuilder({ ledger: new RepositoryFactLedger() }).build(fixture());
  const symbol = result.symbols.nodes.find((node) => node.name === 'createSession');
  assert.ok(symbol);
  assert.equal(symbol.metadata.exported, true);
  assert.equal(symbol.metadata.type, 'function');
  for (const kind of ['defines','references','calls','implements','verifies']) assert.ok(result.symbols.edges.some((edge) => edge.kind === kind), kind);
  assert.ok(result.symbols.nodes.some((node) => node.kind === 'test'));
});

test('RepositoryTruthMapBuilder keeps observed request, event, process, state, data flow, reads, writes, and controls relations cited', () => {
  const input = fixture();
  input.relationshipEdges.push({ kind: 'reads', from: 'symbol:createSession', to: 'config:config/app.json', citation: { path: 'src/api/session.mjs', line: 1, sourceHash: H.api }, confidence: 'ast' });
  const result = new RepositoryTruthMapBuilder({ ledger: new RepositoryFactLedger() }).build(input);
  for (const kind of ['request','event','process','state','data-flow','reads','writes','controls']) {
    const edge = [...result.runtime.edges, ...result.architecture.edges, ...result.symbols.edges].find((item) => item.kind === kind);
    assert.ok(edge, kind);
    assert.match(edge.citation.sourceHash, /^[a-f0-9]{64}$/);
  }
});

test('RepositoryTruthMapBuilder creates a separate editor overlay namespace without mutating disk source facts', () => {
  const input = fixture();
  input.branchContext = { ...branchContext, editorOverlayHash: H.overlay };
  input.editorOverlays = [{ path: 'src/api/session.mjs', content: 'export function createSession(user) { return user.email; }', sha256: H.overlay, overlayId: 'editor:src/api/session.mjs' }];
  const ledger = new RepositoryFactLedger();
  const result = new RepositoryTruthMapBuilder({ ledger }).build(input);
  assert.equal(result.context.editorOverlayCount, 1);
  const overlay = result.symbols.nodes.find((node) => node.citation?.overlayId === 'editor:src/api/session.mjs');
  assert.ok(overlay);
  assert.equal(overlay.citation.sourceHash, H.overlay);
  assert.equal(result.symbols.nodes.some((node) => node.citation?.sourceHash === H.api), true);
});

test('RepositoryTruthMapBuilder rejects uncited provider edges and reports unavailable runtime evidence', () => {
  const input = fixture();
  input.relationshipEdges.push({ kind: 'calls', from: 'a', to: 'b', citation: null });
  input.runtimeEdges = null;
  const result = new RepositoryTruthMapBuilder({ ledger: new RepositoryFactLedger() }).build(input);
  assert.ok(result.unknowns.includes('runtime-observation-unavailable'));
  assert.ok(result.unknowns.includes('relationship-edge-rejected:missing-citation'));
  assert.equal(result.runtime.edges.some((edge) => edge.confidence === 'runtime-observed'), false);
  assert.ok(result.runtime.edges.some((edge) => edge.kind === 'writes'));
});

test('RepositoryTruthMapBuilder remains bounded and marks truncation', () => {
  const input = fixture();
  const result = new RepositoryTruthMapBuilder({ ledger: new RepositoryFactLedger() }).build({ ...input, limits: { maxNodesPerMap: 2, maxEdgesPerMap: 1 } });
  assert.equal(result.truncated, true);
  assert.ok(result.architecture.nodes.length <= 2);
  assert.ok(result.symbols.edges.length <= 1);
});
