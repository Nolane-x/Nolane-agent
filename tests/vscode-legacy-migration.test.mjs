import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';

import { buildVsCodeExtension } from '../scripts/build-vscode-extension.mjs';

const require = createRequire(import.meta.url);

test('VS Code migrates token, settings and active run without losing values', async () => {
  await buildVsCodeExtension();
  const modulePath = path.resolve('extensions/vscode/extension/dist/legacy-migration.js');
  delete require.cache[modulePath];
  const { readMigratedSecret, migratedSetting, readMigratedWorkspaceState } = require(modulePath);

  const secrets = new Map([['forgeStudio.token', 'legacy-secret']]);
  const secretStore = {
    async get(key) { return secrets.get(key); },
    async store(key, value) { secrets.set(key, value); },
    async delete(key) { secrets.delete(key); },
  };
  assert.equal(await readMigratedSecret(secretStore, 'nolaneAgent.token'), 'legacy-secret');
  assert.equal(secrets.get('nolaneAgent.token'), 'legacy-secret');
  assert.equal(secrets.has('forgeStudio.token'), false);

  const vscode = {
    workspace: {
      getConfiguration(namespace) {
        if (namespace === 'nolaneAgent') return { inspect() { return {}; }, get(_key, fallback) { return fallback; } };
        if (namespace === 'forgeStudio') return { get() { return 'legacy-value'; } };
        throw new Error(`unexpected namespace: ${namespace}`);
      },
    },
  };
  assert.equal(migratedSetting(vscode, 'projectId', ''), 'legacy-value');

  const state = new Map([['forgeStudio.activeRunId', 'run-legacy']]);
  const context = { workspaceState: { get(key, fallback) { return state.get(key) ?? fallback; }, update(key, value) { state.set(key, value); return Promise.resolve(); } } };
  assert.equal(readMigratedWorkspaceState(context, 'nolaneAgent.activeRunId'), 'run-legacy');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(state.get('nolaneAgent.activeRunId'), 'run-legacy');
});

test('VS Code legacy commands are hidden aliases that invoke canonical nolane commands', async () => {
  await buildVsCodeExtension();
  const modulePath = path.resolve('extensions/vscode/extension/dist/legacy-migration.js');
  delete require.cache[modulePath];
  const { registerLegacyCommandAliases } = require(modulePath);
  const registered = new Map();
  const executed = [];
  const vscode = { commands: {
    registerCommand(id, handler) { registered.set(id, handler); return { dispose() {} }; },
    executeCommand(...args) { executed.push(args); return Promise.resolve('ok'); },
  } };
  const context = { subscriptions: [] };
  registerLegacyCommandAliases(vscode, context, ['nolane.runTask', 'other.command']);
  assert.deepEqual([...registered.keys()], ['forge.runTask']);
  await registered.get('forge.runTask')('arg-1');
  assert.deepEqual(executed, [['nolane.runTask', 'arg-1']]);
  assert.equal(context.subscriptions.length, 1);
});
