import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Secrets Manager only renders credential metadata and performs explicit set/delete actions', async () => {
  const [app, html, module] = await Promise.all([
    readFile('ui/app.js', 'utf8'),
    readFile('ui/index.html', 'utf8'),
    readFile('ui/secrets-manager.js', 'utf8'),
  ]);
  assert.match(html, /id="secrets-manager-button"/);
  assert.match(html, /id="secrets-manager"/);
  assert.match(app, /secrets:\['\/secrets-manager\.js','initSecretsManager'/);
  assert.match(module, /\/api\/credentials/);
  assert.match(module, /type = 'password'/);
  assert.match(module, /autocomplete = 'new-password'/);
  assert.doesNotMatch(module, /resolve|reveal|plaintext|showSecret/i);
  assert.match(module, /present/);
});
