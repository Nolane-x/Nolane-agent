import test from 'node:test';
import assert from 'node:assert/strict';

import { RuntimeModuleManager } from '../src/runtime/runtime-module-manager.mjs';

test('module manager activates dependencies once and records lifecycle receipts', async () => {
  const calls = [];
  const manager = new RuntimeModuleManager({ profile: 'lite' });
  manager.register({ id: 'core', essential: true, activate: async () => { calls.push('core'); return { close() { calls.push('core-close'); } }; } });
  manager.register({ id: 'browser', dependencies: ['core'], profiles: ['lite', 'balanced', 'performance'], activate: async () => { calls.push('browser'); return { ping: () => 'pong', close() { calls.push('browser-close'); } }; } });
  const [first, second] = await Promise.all([manager.activate('browser'), manager.activate('browser')]);
  assert.equal(first, second);
  assert.deepEqual(calls, ['core', 'browser']);
  assert.equal(manager.snapshot().modules.find((item) => item.id === 'browser').state, 'active');
  assert.match(manager.snapshot().modules.find((item) => item.id === 'browser').receipt, /^[a-f0-9]{64}$/);
  await manager.close();
  assert.deepEqual(calls.slice(-2).sort(), ['browser-close', 'core-close'].sort());
});

test('module manager supports idle suspend resume and unload without losing descriptor state', async () => {
  const calls = [];
  const manager = new RuntimeModuleManager({ profile: 'balanced' });
  manager.register({
    id: 'index',
    activate: async () => ({
      suspend: async () => calls.push('suspend'),
      resume: async () => calls.push('resume'),
      close: async () => calls.push('close'),
    }),
  });
  await manager.activate('index');
  manager.markIdle('index');
  assert.equal(manager.get('index').state, 'idle');
  await manager.suspend('index', 'pressure');
  assert.equal(manager.get('index').state, 'suspended');
  await manager.activate('index');
  assert.equal(manager.get('index').state, 'active');
  await manager.unload('index', 'idle-timeout');
  assert.equal(manager.get('index').state, 'unloaded');
  assert.deepEqual(calls, ['suspend', 'resume', 'close']);
});

test('emergency policy unloads optional modules and denies new optional activation', async () => {
  const manager = new RuntimeModuleManager({ profile: 'lite' });
  manager.register({ id: 'core', essential: true, activate: async () => ({}) });
  manager.register({ id: 'semantic-index', activate: async () => ({ close() {} }) });
  await manager.activate('core');
  await manager.activate('semantic-index');
  await manager.applyPolicy({ state: 'emergency', unloadOptionalModules: true });
  assert.equal(manager.get('core').state, 'active');
  assert.equal(manager.get('semantic-index').state, 'unloaded');
  await assert.rejects(() => manager.activate('semantic-index'), /emergency/i);
});

test('module manager rejects cycles and profile-incompatible modules', async () => {
  const cyclic = new RuntimeModuleManager({ profile: 'balanced' });
  cyclic.register({ id: 'a', dependencies: ['b'], activate: async () => ({}) });
  cyclic.register({ id: 'b', dependencies: ['a'], activate: async () => ({}) });
  await assert.rejects(() => cyclic.activate('a'), /cycle/i);

  const manager = new RuntimeModuleManager({ profile: 'lite' });
  manager.register({ id: 'swarm', profiles: ['performance'], activate: async () => ({}) });
  await assert.rejects(() => manager.activate('swarm'), /profile/i);
});
