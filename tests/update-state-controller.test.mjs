import test from 'node:test';
import assert from 'node:assert/strict';

import { createUpdateStateController } from '../ui-v3/core/update-state-controller.mjs';

function desktopFixture() {
  const calls = [];
  let listener = null;
  const desktop = {
    getUpdateState: async () => ({ state: 'available', version: '5.0.0-beta.7' }),
    checkForUpdates: async () => { calls.push(['check']); return { state: 'upToDate' }; },
    downloadAvailableUpdate: async () => { calls.push(['download']); return { state: 'staged', ready: true }; },
    deferUpdate: async () => { calls.push(['defer']); return { state: 'deferred' }; },
    ignoreVersion: async () => { calls.push(['ignore']); return { state: 'ignored' }; },
    installUpdateAndRestart: async () => { calls.push(['install']); return { state: 'installing' }; },
    onUpdateState: (next) => { listener = next; return () => { listener = null; }; }
  };
  return { desktop, calls, emit: (state) => listener?.(state), hasListener: () => Boolean(listener) };
}

test('update state controller loads, subscribes, and invokes only narrow no-argument desktop methods', async () => {
  const fixture = desktopFixture();
  const changes = [];
  const controller = createUpdateStateController({ desktop: fixture.desktop, onChange: (state) => changes.push(state) });
  assert.equal((await controller.load()).state, 'available');
  assert.equal(fixture.hasListener(), true);
  fixture.emit({ state: 'downloading', version: '5.0.0-beta.7' });
  assert.equal(controller.snapshot().state, 'downloading');
  await controller.check();
  await controller.download();
  await controller.defer();
  await controller.ignore();
  await controller.install();
  assert.deepEqual(fixture.calls, [['check'], ['download'], ['defer'], ['ignore'], ['install']]);
  assert.equal(changes.at(-1).state, 'installing');
  controller.destroy();
  assert.equal(fixture.hasListener(), false);
});

test('update state controller retains a user-visible failure state when desktop IPC rejects', async () => {
  const controller = createUpdateStateController({ desktop: {
    getUpdateState: async () => ({ state: 'available', version: '5.0.0-beta.7' }),
    downloadAvailableUpdate: async () => { throw new Error('verification failed'); }
  } });
  await controller.load();
  const result = await controller.download();
  assert.equal(result.state, 'downloadFailed');
  assert.match(result.error, /verification failed/);
  assert.equal(result.version, '5.0.0-beta.7');
});

test('legacy install bridge remains available without exposing a path or command argument', async () => {
  const calls = [];
  const controller = createUpdateStateController({ desktop: {
    getUpdateStatus: async () => ({ state: 'staged', ready: true }),
    installStagedUpdate: async (...args) => { calls.push(args); return { state: 'installing' }; }
  } });
  await controller.load();
  await controller.install();
  assert.deepEqual(calls, [[]]);
});
