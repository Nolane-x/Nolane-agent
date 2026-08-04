import test from 'node:test';
import assert from 'node:assert/strict';

import { PlaywrightCliDriver } from '../src/browser/playwright-cli-driver.mjs';

test('PlaywrightCliDriver prefers the pinned managed runtime and exposes one-click installation', async () => {
  const calls = [];
  const runtimeInstaller = {
    async status() { return { ready: true, version: '0.1.17', command: { executable: '/node', prefixArgs: ['/managed/cli.js'] }, browsersPath: '/managed/browsers' }; },
    async install(input) { calls.push(['install', input]); return this.status(); },
  };
  const driver = new PlaywrightCliDriver({ runtimeInstaller, runProcess: async (input) => { calls.push(['run', input]); return { exitCode: 0, stdout: 'playwright-cli 0.1.17', stderr: '' }; } });
  const detected = await driver.detect();
  assert.equal(detected.source, 'managed');
  await driver.run({ sessionName: 'p1', args: ['snapshot'] });
  const run = calls.find((item) => item[0] === 'run')[1];
  assert.equal(run.executable, '/node');
  assert.deepEqual(run.args, ['/managed/cli.js', '-s=p1', 'snapshot']);
  assert.equal(run.env.PLAYWRIGHT_BROWSERS_PATH, '/managed/browsers');
  const installed = await driver.installRuntime({ force: true });
  assert.equal(installed.ready, true);
  assert.deepEqual(calls.find((item) => item[0] === 'install')[1], { force: true });
});
