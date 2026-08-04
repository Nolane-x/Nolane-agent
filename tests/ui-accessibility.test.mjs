import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

function visibleText(fragment) {
  return fragment.replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

test('all default-shell buttons and form controls have accessible names', async () => {
  const html = await read('ui/index.html');
  for (const match of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
    const attributes = match[1];
    const text = visibleText(match[2]);
    assert.ok(/aria-label\s*=/.test(attributes) || text.length > 0, `Unnamed button: ${match[0].slice(0, 120)}`);
  }
  for (const match of html.matchAll(/<(?:input|textarea|select)\b([^>]*)>/gi)) {
    const attributes = match[1];
    const id = attributes.match(/\bid="([^"]+)"/)?.[1];
    const before = html.slice(0, match.index);
    const wrappedByLabel = before.lastIndexOf('<label') > before.lastIndexOf('</label>');
    const named = /aria-label\s*=|placeholder\s*=|title\s*=/.test(attributes) || wrappedByLabel || (id && new RegExp(`<label[^>]*for="${id}"`).test(html));
    assert.ok(named, `Unnamed form control: ${match[0]}`);
  }
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /role="dialog"|<dialog\b/);
});

test('UI preserves keyboard focus, reduced motion, readable tokens, and an offline-only default shell', async () => {
  const [html, css, app] = await Promise.all([read('ui/index.html'), read('ui/style.css'), read('ui/app.js')]);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /--text-normal:\s*#[a-f0-9]{6}/i);
  assert.match(css, /--background-primary:\s*#[a-f0-9]{6}/i);
  assert.doesNotMatch(`${html}\n${css}\n${app}`, /(?:src|href)=["']https?:\/\//i);
  assert.doesNotMatch(app, /^import .*?(?:monaco|xterm|workroom)/mi);
  assert.match(app, /import\(['"]\.\/workroom\.js['"]\)/);
});

test('AI connection center has accessible labels, live status, and keyboard-safe dialog controls', async () => {
  const html = await read('ui/index.html');
  assert.match(html, /<dialog id="provider-dialog"[^>]*aria-labelledby="provider-dialog-title"/);
  assert.match(html, /id="provider-connection-message"[^>]*aria-live="polite"/);
  assert.match(html, /<label[^>]*for="provider-kind"/);
  assert.match(html, /<label[^>]*for="provider-model"/);
  assert.match(html, /<label[^>]*for="provider-api-key"/);
  assert.match(html, /type="password"[^>]*autocomplete="off"/);
});
