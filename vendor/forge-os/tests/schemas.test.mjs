import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

test('public JSON schemas use draft 2020-12 and have stable ids', async () => {
  const files = (await readdir('schemas')).filter((file) => file.endsWith('.schema.json'));
  assert.ok(files.length >= 6);
  const ids = new Set();
  for (const file of files) {
    const schema = JSON.parse(await readFile(`schemas/${file}`, 'utf8'));
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.match(schema.$id, /^https:\/\/forgeos\.dev\/schemas\//);
    assert.ok(!ids.has(schema.$id));
    ids.add(schema.$id);
    assert.equal(typeof schema.type, 'string');
  }
});
