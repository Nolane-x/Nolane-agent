import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');

test('app samples system memory and wires all runtime-profile limits into the governor', () => {
  assert.match(appSource, /import \{ SystemResourceSampler \} from '\.\/runtime\/system-resource-sampler\.mjs';/);
  assert.match(appSource, /const systemResourceSampler = new SystemResourceSampler\(\);/);
  assert.match(appSource, /maxBrowserSessions: config\.performance\.maxBrowserSessions/);
  assert.match(appSource, /maxToolOutputBytes: config\.performance\.maxToolOutputBytes/);
  assert.match(appSource, /maxEventHistory: config\.performance\.maxEventHistory/);
  assert.match(appSource, /semanticIndexing: config\.performance\.semanticIndexing/);
  assert.match(appSource, /backgroundRefresh: config\.performance\.backgroundRefresh/);
  assert.match(appSource, /resourceGovernor\.sample\(systemResourceSampler\.sample\(\{ eventLoopDelayMs: delay \}\)\)/);
});

test('runtime status exposes selected profile and feature policy', () => {
  assert.match(appSource, /profile: Object\.freeze\(\{/);
  assert.match(appSource, /requested: config\.performance\.requestedProfile/);
  assert.match(appSource, /resolved: config\.performance\.profile/);
  assert.match(appSource, /reducedEffects: config\.performance\.reducedEffects/);
});
