import test from 'node:test';
import assert from 'node:assert/strict';
import { CrossRepositoryWorkspaceMap } from '../src/frontier/cross-repository-workspace-map.mjs';

const H1 = '1'.repeat(64); const H2 = '2'.repeat(64); const H3 = '3'.repeat(64);

test('workspace map records repositories, contracts and dependency direction with provenance', () => {
  const map = new CrossRepositoryWorkspaceMap({ maxRepositories: 8, maxEdges: 16 });
  map.registerRepository({ repositoryId: 'backend', version: '2.0.0', fingerprintSha256: H1, owner: 'platform', role: 'backend' });
  map.registerRepository({ repositoryId: 'sdk', version: '1.4.0', fingerprintSha256: H2, owner: 'sdk-team', role: 'sdk' });
  map.registerContract({ contractId: 'api-v2', repositoryId: 'backend', version: '2.0.0', fingerprintSha256: H3, kind: 'http-api' });
  const edge = map.linkDependency({ fromRepositoryId: 'sdk', toRepositoryId: 'backend', contractId: 'api-v2', requiredVersion: '2.0.0', compatibility: { mode: 'dual', windowId: 'api-v1-v2' } });
  assert.equal(edge.fromRepositoryId, 'sdk');
  assert.equal(edge.toRepositoryId, 'backend');
  const snapshot = map.snapshot();
  assert.equal(snapshot.repositories.length, 2);
  assert.equal(snapshot.contracts.length, 1);
  assert.equal(snapshot.dependencies.length, 1);
  assert.match(snapshot.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(snapshot.claims.crossRepositoryTransactionExecuted, false);
});

test('workspace map rejects dependency cycles without explicit compatibility allowance', () => {
  const map = new CrossRepositoryWorkspaceMap();
  map.registerRepository({ repositoryId: 'a', version: '1.0.0', fingerprintSha256: H1, owner: 'a', role: 'service' });
  map.registerRepository({ repositoryId: 'b', version: '1.0.0', fingerprintSha256: H2, owner: 'b', role: 'service' });
  map.linkDependency({ fromRepositoryId: 'a', toRepositoryId: 'b', requiredVersion: '1.0.0' });
  assert.throws(() => map.linkDependency({ fromRepositoryId: 'b', toRepositoryId: 'a', requiredVersion: '1.0.0' }), /cycle/);
});
