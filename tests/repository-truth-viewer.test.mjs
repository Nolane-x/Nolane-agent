import assert from 'node:assert/strict';
import test from 'node:test';

import { RepositoryTruthViewer } from '../src/repository/repository-truth-viewer.mjs';

const HASH = 'a'.repeat(64);
const c = (path, line = 1) => ({ path, line, start: line * 10, end: line * 10 + 8, sourceHash: HASH, overlayId: null });
const twin = Object.freeze({
  schema: 'forge.repository-digital-twin.v2',
  twinSha256: 'f'.repeat(64),
  architecture: {
    nodes: [
      { id: 'workspace', kind: 'workspace', name: 'Truth', path: '.', citation: null },
      { id: 'domain-auth', kind: 'domain', name: 'auth', path: 'src/auth', citation: c('src/auth/session.mjs') },
      { id: 'service-session', kind: 'service', name: 'session', path: 'src/auth/session.mjs', citation: c('src/auth/session.mjs') },
      { id: 'file-session', kind: 'file', name: 'session.mjs', path: 'src/auth/session.mjs', citation: c('src/auth/session.mjs') },
    ],
    edges: [
      { id: 'a1', kind: 'contains', from: 'workspace', to: 'domain-auth', citation: c('src/auth/session.mjs') },
      { id: 'a2', kind: 'contains', from: 'domain-auth', to: 'service-session', citation: c('src/auth/session.mjs') },
      { id: 'a3', kind: 'implemented-by', from: 'service-session', to: 'file-session', citation: c('src/auth/session.mjs') },
    ],
  },
  symbols: {
    nodes: [
      { id: 'symbol-create', kind: 'symbol', name: 'createSession', path: 'src/auth/session.mjs', citation: c('src/auth/session.mjs', 2) },
      { id: 'symbol-write', kind: 'symbol', name: 'writeSession', path: 'src/auth/session.mjs', citation: c('src/auth/session.mjs', 5) },
      { id: 'test-session', kind: 'test', name: 'session.test.mjs', path: 'tests/session.test.mjs', citation: c('tests/session.test.mjs') },
    ],
    edges: [
      { id: 's1', kind: 'defines', from: 'file-session', to: 'symbol-create', citation: c('src/auth/session.mjs', 2) },
      { id: 's2', kind: 'calls', from: 'symbol-create', to: 'symbol-write', citation: c('src/auth/session.mjs', 3) },
      { id: 's3', kind: 'verifies', from: 'test-session', to: 'symbol-create', citation: c('tests/session.test.mjs') },
    ],
  },
  runtime: { nodes: [], edges: [] },
});

test('RepositoryTruthViewer zooms workspace to domain, service, file, symbol, and source span', () => {
  const viewer = new RepositoryTruthViewer();
  const workspace = viewer.open(twin, { level: 'workspace', limit: 10 });
  assert.deepEqual(workspace.nodes.map((node) => node.id), ['workspace']);
  const domains = viewer.open(twin, { level: 'domain', parentId: 'workspace', limit: 10 });
  assert.deepEqual(domains.nodes.map((node) => node.id), ['domain-auth']);
  const services = viewer.open(twin, { level: 'service', parentId: 'domain-auth', limit: 10 });
  assert.deepEqual(services.nodes.map((node) => node.id), ['service-session']);
  const files = viewer.open(twin, { level: 'file', parentId: 'service-session', limit: 10 });
  assert.deepEqual(files.nodes.map((node) => node.id), ['file-session']);
  const symbols = viewer.open(twin, { level: 'symbol', parentId: 'file-session', limit: 10 });
  assert.deepEqual(symbols.nodes.map((node) => node.id), ['symbol-create']);
  const span = viewer.open(twin, { level: 'source-span', nodeId: 'symbol-create' });
  assert.deepEqual(span.sourceSpan, { path: 'src/auth/session.mjs', line: 2, start: 20, end: 28, sourceHash: HASH, overlayId: null });
});

test('RepositoryTruthViewer loads only the requested page and exposes continuation metadata', () => {
  const viewer = new RepositoryTruthViewer();
  const first = viewer.open(twin, { level: 'symbol', limit: 1 });
  assert.equal(first.loadedNodeCount, 1);
  assert.equal(first.totalNodeCount, 2);
  assert.equal(first.truncated, true);
  assert.ok(first.nextCursor);
  const second = viewer.open(twin, { level: 'symbol', limit: 1, cursor: first.nextCursor });
  assert.equal(second.loadedNodeCount, 1);
  assert.notEqual(second.nodes[0].id, first.nodes[0].id);
  assert.equal(second.nextCursor, null);
});

test('RepositoryTruthViewer returns a bounded cited neighborhood without loading the whole graph', () => {
  const viewer = new RepositoryTruthViewer();
  const result = viewer.open(twin, { level: 'symbol', parentId: 'file-session', limit: 1, neighborhood: 1 });
  assert.equal(result.loadedNodeCount, 1);
  assert.ok(result.edges.length <= 1);
  assert.ok(result.edges.every((edge) => edge.citation.sourceHash === HASH));
  assert.equal(result.loadedNodeCount < result.graphTotalNodeCount, true);
});

test('RepositoryTruthViewer rejects corrupt or cross-twin cursors', () => {
  const viewer = new RepositoryTruthViewer();
  const first = viewer.open(twin, { level: 'symbol', limit: 1 });
  assert.throws(() => viewer.open(twin, { level: 'symbol', limit: 1, cursor: `${first.nextCursor}x` }), /cursor/i);
  assert.throws(() => viewer.open({ ...twin, twinSha256: 'e'.repeat(64) }, { level: 'symbol', limit: 1, cursor: first.nextCursor }), /cursor/i);
});

test('RepositoryTruthViewer fails closed on unknown levels or missing source-span nodes', () => {
  const viewer = new RepositoryTruthViewer();
  assert.throws(() => viewer.open(twin, { level: 'unknown' }), /level/i);
  assert.throws(() => viewer.open(twin, { level: 'source-span', nodeId: 'missing' }), /node/i);
});
