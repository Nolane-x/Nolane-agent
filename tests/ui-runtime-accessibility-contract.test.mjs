import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexUrl = new URL('../ui-v3/styles/index.css', import.meta.url);
const correctionUrl = new URL('../ui-v3/styles/accessibility-runtime.css', import.meta.url);
const prooflineCorrectionUrl = new URL('../ui-v3/styles/pages/mission-proofline-accessibility.css', import.meta.url);

test('runtime accessibility corrections remain a late semantic layer before host responsive policy', async () => {
  const index = await readFile(indexUrl, 'utf8');
  const home = index.indexOf("@import './pages/home.css';");
  const proofline = index.indexOf("@import './pages/mission-proofline.css';");
  const prooflineCorrection = index.indexOf("@import './pages/mission-proofline-accessibility.css';");
  const correction = index.indexOf("@import './accessibility-runtime.css';");
  const responsive = index.indexOf("@import './responsive.css';");

  assert.ok(home >= 0, 'home styles must remain in the canonical style graph');
  assert.ok(prooflineCorrection > proofline, 'Proofline accessibility corrections must refine the flagship architecture');
  assert.ok(correction > home, 'runtime accessibility corrections must refine rendered surface styles');
  assert.ok(responsive > correction, 'responsive host policy must remain the final authority');

  const css = await readFile(correctionUrl, 'utf8');
  for (const selector of [
    '.session-sidebar__groups section h2',
    '.session-sidebar__projects > header h2',
    '.session-row small',
    '.recent-mission__copy small',
  ]) {
    assert.ok(css.includes(selector), `missing runtime accessibility selector: ${selector}`);
  }
  assert.match(css, /color:\s*var\(--text-secondary\)/);
  for (const tone of ['neutral', 'active']) {
    assert.match(
      css,
      new RegExp(`\\.recent-mission__badge\\[data-tone="${tone}"\\]\\s*\\{[^}]*color:\\s*var\\(--text-primary\\)`, 's'),
      `the tiny ${tone} mission badge needs primary text contrast while its background preserves state`,
    );
  }
  assert.match(
    css,
    /button\[data-workroom-directory\]\s*>\s*strong\s*\{[^}]*color:\s*var\(--text-primary\)/s,
    'workroom directory labels need primary text contrast while the directory icon retains accent semantics',
  );
  assert.doesNotMatch(
    css,
    /\.recent-mission__badge\s*\{[^}]*color:/s,
    'the late accessibility layer must not flatten success or danger badge semantics',
  );
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i, 'runtime contrast repair must use semantic tokens, not hard-coded colors');

  const prooflineCss = await readFile(prooflineCorrectionUrl, 'utf8');
  for (const selector of [
    '.activity-event__kind',
    '.activity-event__body > code',
    '.activity-event__body details > summary',
    '.activity-event__body details code',
  ]) {
    assert.match(
      prooflineCss,
      new RegExp(`${selector.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*\\{[^}]*color:\\s*var\\(--text-primary\\)`, 's'),
      `Proofline ledger runtime evidence requires primary contrast for ${selector}`,
    );
  }
  assert.doesNotMatch(prooflineCss, /#[0-9a-f]{3,8}\b/i, 'Proofline contrast repair must remain token-driven');
});
