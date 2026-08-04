import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../ui-v3/app.mjs', import.meta.url), 'utf8');
const runtime = fs.readFileSync(new URL('../src/app.mjs', import.meta.url), 'utf8');
const routes = fs.readFileSync(new URL('../src/server/routes.mjs', import.meta.url), 'utf8');
const adoption = fs.readFileSync(new URL('../src/adoption/trust-adoption-foundation.mjs', import.meta.url), 'utf8');

test('durable session restoration is wired from runtime stores through API to the progressive UI', () => {
  assert.match(runtime, /createTrustAdoptionFoundation/);
  assert.match(adoption, /new SessionRestoreService/);
  assert.match(routes, /\/api\/session\/restore/);
  assert.match(routes, /\/api\/session\/draft/);
  assert.match(app, /createSessionRestoreController/);
  assert.match(app, /sessionRestore\.snapshot\(\)\.restore\?\.activeRoute/);
  assert.match(app, /sessionRestore\.scheduleDraft\('home'/);
  assert.match(app, /sessionRestore\.clearDraft\('home'\)/);
});
