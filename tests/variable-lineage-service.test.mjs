import test from 'node:test';
import assert from 'node:assert/strict';
import { VariableLineageService } from '../src/intelligence-completion/variable-lineage-service.mjs';

const S = (c) => c.repeat(64);
const citation = (path, c = 'a') => ({ path, startLine: 1, endLine: 2, sourceHash: S(c) });

test('tracks rename move type nullability scope serialization and database mapping over time', () => {
  const service = new VariableLineageService();
  const created = service.registerBinding({ repositoryId: 'repo', branch: 'main', bindingId: 'user-name', symbol: 'userName', path: 'src/model.mjs', type: 'string', nullable: false, scope: 'module', serializationName: 'user_name', databaseMapping: 'users.user_name', citation: citation('src/model.mjs') });
  assert.equal(created.current.symbol, 'userName');
  service.transitionBinding('user-name', { transitionId: 't1', branch: 'main', kind: 'rename', beforeSourceHash: S('a'), afterSourceHash: S('b'), symbol: 'displayName', citation: citation('src/model.mjs', 'b') });
  service.transitionBinding('user-name', { transitionId: 't2', branch: 'main', kind: 'move', beforeSourceHash: S('b'), afterSourceHash: S('c'), path: 'src/profile.mjs', citation: citation('src/profile.mjs', 'c') });
  service.transitionBinding('user-name', { transitionId: 't3', branch: 'main', kind: 'type', beforeSourceHash: S('c'), afterSourceHash: S('d'), type: 'DisplayName', compatible: true, compatibilityEvidence: [citation('src/types.mjs', 'd')], citation: citation('src/profile.mjs', 'd') });
  service.transitionBinding('user-name', { transitionId: 't4', branch: 'main', kind: 'nullability', beforeSourceHash: S('d'), afterSourceHash: S('e'), nullable: true, citation: citation('src/profile.mjs', 'e') });
  service.transitionBinding('user-name', { transitionId: 't5', branch: 'main', kind: 'scope', beforeSourceHash: S('e'), afterSourceHash: S('f'), scope: 'class', citation: citation('src/profile.mjs', 'f') });
  service.transitionBinding('user-name', { transitionId: 't6', branch: 'main', kind: 'serialization', beforeSourceHash: S('f'), afterSourceHash: S('1'), serializationName: 'display_name', citation: citation('src/profile.mjs', '1') });
  const final = service.transitionBinding('user-name', { transitionId: 't7', branch: 'main', kind: 'database-mapping', beforeSourceHash: S('1'), afterSourceHash: S('2'), databaseMapping: 'profiles.display_name', citation: citation('src/profile.mjs', '2') });
  assert.equal(final.current.symbol, 'displayName');
  assert.equal(final.current.path, 'src/profile.mjs');
  assert.equal(final.current.type, 'DisplayName');
  assert.equal(final.current.nullable, true);
  assert.equal(final.current.scope, 'class');
  assert.equal(final.current.serializationName, 'display_name');
  assert.equal(final.current.databaseMapping, 'profiles.display_name');
  assert.equal(final.transitions.length, 7);
  assert.equal(final.claims.identityInferredWithoutEvidence, false);
});

test('rejects uncited incompatible stale cross-branch duplicate and cyclic transitions', () => {
  const service = new VariableLineageService();
  service.registerBinding({ repositoryId: 'repo', branch: 'main', bindingId: 'x', symbol: 'x', path: 'src/a.mjs', type: 'number', nullable: false, scope: 'function', citation: citation('src/a.mjs') });
  assert.throws(() => service.transitionBinding('x', { transitionId: 'bad-citation', branch: 'main', kind: 'rename', beforeSourceHash: S('a'), afterSourceHash: S('b'), symbol: 'y' }), /citation/);
  assert.throws(() => service.transitionBinding('x', { transitionId: 'bad-type', branch: 'main', kind: 'type', beforeSourceHash: S('a'), afterSourceHash: S('b'), type: 'string', citation: citation('src/a.mjs', 'b') }), /compatibility evidence/);
  assert.throws(() => service.transitionBinding('x', { transitionId: 'branch', branch: 'feature', kind: 'rename', beforeSourceHash: S('a'), afterSourceHash: S('b'), symbol: 'y', citation: citation('src/a.mjs', 'b') }), /branch mismatch/);
  service.transitionBinding('x', { transitionId: 'rename', branch: 'main', kind: 'rename', beforeSourceHash: S('a'), afterSourceHash: S('b'), symbol: 'y', citation: citation('src/a.mjs', 'b') });
  assert.throws(() => service.transitionBinding('x', { transitionId: 'rename', branch: 'main', kind: 'rename', beforeSourceHash: S('b'), afterSourceHash: S('c'), symbol: 'z', citation: citation('src/a.mjs', 'c') }), /duplicate transition/);
  assert.throws(() => service.transitionBinding('x', { transitionId: 'cycle', branch: 'main', kind: 'rename', beforeSourceHash: S('b'), afterSourceHash: S('c'), symbol: 'x', citation: citation('src/a.mjs', 'c') }), /cycle/);
  assert.throws(() => service.transitionBinding('x', { transitionId: 'stale', branch: 'main', kind: 'rename', beforeSourceHash: S('a'), afterSourceHash: S('c'), symbol: 'z', citation: citation('src/a.mjs', 'c') }), /stale source hash/);
});

test('resolves current and historical aliases explicitly and reports ambiguity', () => {
  const service = new VariableLineageService();
  service.registerBinding({ repositoryId: 'repo', branch: 'main', bindingId: 'a', symbol: 'firstName', path: 'src/a.mjs', type: 'string', nullable: false, scope: 'module', serializationName: 'name', citation: citation('src/a.mjs') });
  service.registerBinding({ repositoryId: 'repo', branch: 'main', bindingId: 'b', symbol: 'lastName', path: 'src/b.mjs', type: 'string', nullable: false, scope: 'module', serializationName: 'name', citation: citation('src/b.mjs', 'b') });
  service.transitionBinding('a', { transitionId: 'rename-a', branch: 'main', kind: 'rename', beforeSourceHash: S('a'), afterSourceHash: S('c'), symbol: 'givenName', citation: citation('src/a.mjs', 'c') });
  assert.equal(service.resolve({ repositoryId: 'repo', branch: 'main', symbol: 'givenName', path: 'src/a.mjs' }).status, 'resolved');
  assert.equal(service.resolve({ repositoryId: 'repo', branch: 'main', symbol: 'firstName' }).status, 'resolved');
  assert.equal(service.resolve({ repositoryId: 'repo', branch: 'main', serializationName: 'name' }).status, 'ambiguous');
  assert.equal(service.resolve({ repositoryId: 'repo', branch: 'main', symbol: 'missing' }).status, 'not-found');
});
