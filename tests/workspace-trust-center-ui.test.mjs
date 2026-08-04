import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Workspace Trust Center exposes professional identity evidence, blocked surfaces, audit, and trust controls', async () => {
  const html = await readFile('ui/index.html', 'utf8');
  const app = await readFile('ui/app.js', 'utf8');
  const ui = await readFile('ui/workspace-trust-center.js', 'utf8');
  const css = await readFile('ui/workspace-trust-center.css', 'utf8');
  assert.match(html, /id="workspace-trust-button"[^>]*aria-label="Quản trị độ tin cậy workspace"/);
  assert.match(app, /trust:\s*\['\.\/workspace-trust-center\.js'/);
  assert.match(app, /await import\(spec\[0\]\)/);
  assert.match(ui, /id="workspace-trust-center"/);
  assert.match(ui, /id="workspace-trust-feature-grid"/);
  assert.match(ui, /Instructions/);
  assert.match(ui, /Lifecycle hooks/);
  assert.match(ui, /MCP tools/);
  assert.match(ui, /Plugin context/);
  assert.match(ui, /id="workspace-trust-approve"/);
  assert.match(ui, /id="workspace-trust-revoke"/);
  assert.match(ui, /\/api\/workspace-trust\//);
  assert.match(ui, /\/audit/);
  assert.match(css, /\.workspace-trust-center/);
  assert.match(css, /\.trust-feature-card/);
});
