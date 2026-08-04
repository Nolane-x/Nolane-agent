import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Integrated Browser Center is lazy, project-bound, and exposes governed browser controls', async () => {
  const [app, html, module] = await Promise.all([
    readFile('ui/app.js', 'utf8'),
    readFile('ui/index.html', 'utf8'),
    readFile('ui/integrated-browser-center.js', 'utf8'),
  ]);
  assert.match(html, /id="integrated-browser-button"/);
  assert.match(html, /id="integrated-browser-center"/);
  assert.match(app, /integratedBrowser:\['\/integrated-browser-center\.js','initIntegratedBrowserCenter'/);
  for (const action of ['open', 'goto', 'snapshot', 'tabs', 'screenshot', 'close', 'status']) assert.match(module, new RegExp(`/api/browser/${action}`));
  assert.match(module, /state\.projectId/);
  assert.match(module, /https?:\/\//);
  assert.doesNotMatch(module, /file:\/\//i);
  assert.match(module, /url\.username \|\| url\.password/);
  assert.doesNotMatch(module, /credentialValue|authorizationHeader|cookieValue|secretField/i);
});
