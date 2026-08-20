import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('legacy UI exchanges bootstrap credentials for a cookie and never puts them in SSE or terminal URLs', async () => {
  const [app, workroom] = await Promise.all([
    readFile(new URL('../ui/app.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/workroom.js', import.meta.url), 'utf8'),
  ]);
  assert.match(app, /api\('\/api\/local-session\/bootstrap'/);
  assert.match(app, /history\.replaceState/);
  assert.match(app, /new EventSource\('\/events'\)/);
  assert.doesNotMatch(app, /EventSource\(`\/events\?token=/);
  assert.match(workroom, /new URL\(/);
  assert.match(workroom, /url\.searchParams\.set\('clientId', this\.clientId\)/);
  assert.match(workroom, /nolane-auth\.\$\{this\.token\}/);
  assert.doesNotMatch(workroom, /\/terminal\?token=/);
});
