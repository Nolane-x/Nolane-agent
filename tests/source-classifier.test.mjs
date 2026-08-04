import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceClassifier } from '../src/repository/source-classifier.mjs';

test('SourceClassifier distinguishes source, test, generated, vendored, migration, lockfile, build output, and config', () => {
  const c = new SourceClassifier();
  assert.equal(c.classify('src/app.mjs').kind, 'source');
  assert.equal(c.classify('tests/app.test.mjs').kind, 'test');
  assert.equal(c.classify('src/generated/client.js', { content: '// generated file' }).kind, 'generated');
  assert.equal(c.classify('vendor/lib/index.js').kind, 'vendored');
  assert.equal(c.classify('migrations/001_init.sql').kind, 'migration');
  assert.equal(c.classify('package-lock.json').kind, 'lockfile');
  assert.equal(c.classify('dist/app.js').kind, 'build-output');
  assert.equal(c.classify('config/app.json').kind, 'configuration');
});

test('SourceClassifier emits evidence and denies normal edits to generated/build/vendored content', () => {
  const c = new SourceClassifier();
  const row = c.classify('dist/app.js');
  assert.equal(row.editPolicy, 'deny-normal-source-edit');
  assert.ok(row.evidence.length > 0);
  assert.match(row.receiptSha256, /^[a-f0-9]{64}$/);
});
