import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relative) => readFile(new URL(relative, import.meta.url), 'utf8');

test('platform residue authority owns selection caret scrollbars and textarea resize without global native-control replacement', async () => {
  const css = await read('../ui-v3/styles/perfection/platform-residue.css');
  assert.match(css, /::selection\s*\{/);
  assert.match(css, /caret-color:\s*var\(--caret-color\)/);
  assert.match(css, /scrollbar-color:\s*var\(--scrollbar-thumb\)\s+transparent/);
  assert.match(css, /scrollbar-width:\s*thin/);
  assert.match(css, /textarea\s*\{\s*resize:\s*vertical/);
  assert.match(css, /\[data-resize-region="sidebar"\],\[data-resize-region="dock"\]\{cursor:col-resize\}/);
  assert.doesNotMatch(css, /appearance:\s*none/);
});

test('motion and forced-colors authorities remain explicit and final-state friendly', async () => {
  const [motion, responsive] = await Promise.all([
    read('../ui-v3/styles/motion.css'),
    read('../ui-v3/styles/responsive.css'),
  ]);
  assert.match(motion, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(motion, /scroll-behavior:\s*auto\s*!important/);
  assert.match(responsive, /@media\s*\(forced-colors:\s*active\)/);
  assert.match(responsive, /CanvasText/);
  assert.match(responsive, /Highlight/);
});
