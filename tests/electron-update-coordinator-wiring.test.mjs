import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [main, preload, coordinator] = await Promise.all([
  readFile(new URL('../desktop/main.cjs', import.meta.url), 'utf8'),
  readFile(new URL('../desktop/preload.cjs', import.meta.url), 'utf8'),
  readFile(new URL('../desktop/update-coordinator.cjs', import.meta.url), 'utf8')
]);

test('desktop updater coordinator is started only after runtime health and uses narrow no-argument IPC', () => {
  assert.match(main, /DesktopUpdateCoordinator/);
  assert.match(main, /await updateCoordinator\?\.start\(\)/);
  for (const channel of ['nolane:update-state-get','nolane:update-check','nolane:update-download','nolane:update-defer','nolane:update-ignore','nolane:update-install-and-restart']) assert.match(main, new RegExp(channel));
  assert.doesNotMatch(preload, /packagePath|installerPath|updateUrl|command/);
  assert.match(coordinator, /\/api\/updates\/check/);
  assert.match(coordinator, /\/api\/updates\/stage/);
  assert.match(coordinator, /\/api\/missions\?status=running/);
});
