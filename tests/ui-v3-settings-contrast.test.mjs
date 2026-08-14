import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Settings metadata foregrounds remain readable on the light canvas at compact widths', async () => {
  const styles = await readFile('ui-v3/styles/pages/settings.css', 'utf8');
  const toolbarEyebrow = styles.match(/\.settings-toolbar>div:first-child>\.eyebrow\{([^}]*)\}/)?.[1] ?? '';
  const layer = styles.match(/\.settings-layer\{([^}]*)\}/)?.[1] ?? '';
  const liveStatus = styles.match(/\.settings-live-status\{([^}]*)\}/)?.[1] ?? '';

  assert.match(toolbarEyebrow, /color:var\(--text-secondary\)/);
  assert.match(layer, /color:var\(--text-secondary\)/);
  assert.match(liveStatus, /color:var\(--text-secondary\)/);
  assert.doesNotMatch(`${toolbarEyebrow}${layer}${liveStatus}`, /color:var\(--text-muted\)/);
});
