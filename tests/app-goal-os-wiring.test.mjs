import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('application composes durable goals, adaptive replanning, browser, plugins, commands, settings, graph, and scheduler', async () => {
  const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  const adoption = await readFile(new URL('../src/adoption/trust-adoption-foundation.mjs', import.meta.url), 'utf8');
  for (const pattern of [
    /new GoalService/,
    /new AdaptiveReplanner/,
    /new GoalToolGateway/,
    /new BrowserAgentService/,
    /new BrowserToolGateway/,
    /new PluginService/,
    /createTrustAdoptionFoundation/,
    /new GoalRunService/,
    /new CommandRegistry/,
    /registerCoreCommands/,
    /new MissionGraphProjection/,
    /new GoalScheduler/,
  ]) assert.match(app, pattern);
  assert.match(adoption, /new SettingsService/);
  assert.match(adoption, /new PersonalizationProfileService/);
  assert.match(adoption, /new OnboardingService/);
  assert.match(adoption, /new SessionRestoreService/);
  assert.match(app, /goalGateway/);
  assert.match(app, /browserGateway/);
  assert.match(app, /pluginService/);
  assert.match(app, /goalScheduler\.start\(\)/);
  assert.match(app, /goalScheduler\.stop\(\)/);
});

test('app composes immutable remote plugins, managed Playwright runtime, and browser permission service', async () => {
  const source = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.match(source, /new RemotePluginSourceResolver/);
  assert.match(source, /sourceResolver:/);
  assert.match(source, /new PlaywrightRuntimeInstaller/);
  assert.match(source, /runtimeInstaller: browserRuntimeInstaller/);
  assert.match(source, /new BrowserPermissionService/);
  assert.match(source, /browserRuntimeInstaller/);
  assert.match(source, /browserPermissionService/);
});
