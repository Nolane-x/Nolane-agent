import assert from 'node:assert/strict';
import test from 'node:test';

import { PlaywrightCliDriver } from '../src/browser/playwright-cli-driver.mjs';

test('PlaywrightCliDriver captures a bounded journey using supported snapshot and screenshot commands', async () => {
  const calls = [];
  const driver = new PlaywrightCliDriver({ runProcess: async (input) => {
    calls.push(input);
    if (input.args.at(-1) === '--version') return { exitCode: 0, stdout: 'Version 1.0.0', stderr: '', durationMs: 1 };
    if (input.args.includes('snapshot')) return { exitCode: 0, stdout: '### Page\n- main\n- button "Continue"', stderr: '', durationMs: 2 };
    if (input.args.includes('screenshot')) return { exitCode: 0, stdout: 'saved', stderr: '', durationMs: 3 };
    throw new Error('unexpected command');
  } });
  const captured = await driver.captureJourney({ sessionName: 'forge-p1', screenshotPath: '/project/artifacts/page.png', depth: 5 });
  assert.match(captured.domSnapshot, /Continue/);
  assert.deepEqual(captured.artifacts, [{ kind: 'screenshot', path: '/project/artifacts/page.png' }, { kind: 'video', path: null }]);
  assert.equal(captured.console.status, 'unavailable');
  assert.equal(captured.network.status, 'unavailable');
  assert.ok(calls.some((call) => call.args.includes('snapshot') && call.args.includes('--depth=5')));
  assert.ok(calls.some((call) => call.args.includes('screenshot') && call.args.includes('--filename=/project/artifacts/page.png')));
});
