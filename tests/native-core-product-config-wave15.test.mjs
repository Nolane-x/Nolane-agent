import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ProductConfigurationRuntimeWave15 } from '../src/native-core/product-configuration-runtime-wave15.mjs';

async function temp(t) { const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-wave15-')); t.after(() => rm(root, { recursive: true, force: true })); return root; }

test('shared product model projects identical runtime state to Electron, web, TUI, CLI and VS Code', async (t) => {
  const root = await temp(t); const runtime = new ProductConfigurationRuntimeWave15({ file: path.join(root, 'product.json') }); await runtime.open();
  runtime.product.apply({ type: 'session.upsert', payload: { id: 's1', title: 'Session', state: 'running' } });
  runtime.product.apply({ type: 'tool.activity', payload: { id: 'tool-1', state: 'running', outputSha256: 'a'.repeat(64) } });
  runtime.product.apply({ type: 'runtime.health', payload: { status: 'healthy', latencyMs: 12 } });
  const receipts = ['electron', 'web', 'tui', 'cli', 'vscode'].map((surface) => runtime.project(surface).stateReceiptSha256);
  assert.equal(new Set(receipts).size, 1);
  assert.equal(runtime.project('web').state.sessions[0].id, 's1');
  assert.throws(() => runtime.product.apply({ type: 'session.upsert', expectedRevision: 0, payload: { id: 's2' } }), (error) => error.code === 'PRODUCT_REVISION_CONFLICT');
});

test('configuration is versioned, profile-scoped and stores credential references only', async (t) => {
  const root = await temp(t); const file = path.join(root, 'product.json'); const runtime = new ProductConfigurationRuntimeWave15({ file }); await runtime.open();
  const profile = runtime.config.createProfile({ id: 'p1', name: 'Local', provider: 'openai-compatible', model: 'local-coder', credentialRef: 'vault:p1', toolset: ['files:read'] });
  assert.equal(profile.version, 1);
  runtime.config.updateProfile({ id: 'p1', expectedVersion: 1, patch: { model: 'local-coder-v2', ssh: { host: 'devbox', credentialRef: 'vault:ssh' } } });
  assert.throws(() => runtime.config.updateProfile({ id: 'p1', expectedVersion: 1, patch: { model: 'stale' } }), (error) => error.code === 'CONFIG_VERSION_CONFLICT');
  assert.equal(JSON.stringify(runtime.snapshot()).includes('raw-secret'), false);
  await runtime.persist(); const reopened = new ProductConfigurationRuntimeWave15({ file }); await reopened.open(); assert.equal(reopened.config.getProfile('p1').version, 2);
  const deletion = reopened.config.deleteProfile({ id: 'p1', routeSessionsTo: 'default' }); assert.equal(deletion.routeSessionsTo, 'default');
});

test('bootstrap and connection plans are shell-free, bounded and fail closed on missing credential references', async (t) => {
  const root = await temp(t); const runtime = new ProductConfigurationRuntimeWave15({ file: path.join(root, 'product.json') }); await runtime.open();
  const plan = runtime.bootstrap.plan({ platform: 'win32', backend: 'ssh', host: 'devbox', workspace: 'C:/repo', credentialRef: 'vault:ssh' });
  assert.equal(plan.command.shell, false); assert.equal(plan.command.args.includes('C:/repo'), true); assert.equal(JSON.stringify(plan).includes('password'), false);
  assert.throws(() => runtime.bootstrap.plan({ platform: 'win32', backend: 'ssh', host: 'devbox', workspace: 'C:/repo' }), (error) => error.code === 'BOOTSTRAP_CREDENTIAL_REFERENCE_REQUIRED');
  assert.throws(() => runtime.bootstrap.plan({ platform: 'win32', backend: 'ssh', host: 'devbox;rm', workspace: 'C:/repo', credentialRef: 'vault:ssh' }), (error) => error.code === 'BOOTSTRAP_INPUT_INVALID');
});

test('model picker and toolset configuration are deterministic and entitlement-aware', async (t) => {
  const root = await temp(t); const runtime = new ProductConfigurationRuntimeWave15({ file: path.join(root, 'product.json'), entitlementTier: 'community' }); await runtime.open();
  runtime.models.register({ id: 'small-code', provider: 'local', context: 32768, capabilities: ['tools'], tier: 'community' });
  runtime.models.register({ id: 'frontier', provider: 'cloud', context: 200000, capabilities: ['tools', 'vision'], tier: 'pro' });
  assert.deepEqual(runtime.models.search({ query: 'code', requiredCapabilities: ['tools'] }).map((m) => m.id), ['small-code']);
  assert.throws(() => runtime.models.select({ profileId: 'p1', modelId: 'frontier' }), (error) => error.code === 'ENTITLEMENT_REQUIRED');
  runtime.toolsets.define({ id: 'safe', tools: ['files:read', 'repo:search'], permissions: ['storage:read'] });
  assert.deepEqual(runtime.toolsets.get('safe').tools, ['files:read', 'repo:search']);
});

test('update lifecycle only stages verified updates and exposes recovery actions through shared state', async (t) => {
  const root = await temp(t); const runtime = new ProductConfigurationRuntimeWave15({ file: path.join(root, 'product.json') }); await runtime.open();
  assert.throws(() => runtime.updates.stage({ version: '5.0.0', verified: false, assetSha256: 'a'.repeat(64) }), (error) => error.code === 'UPDATE_UNVERIFIED');
  runtime.updates.stage({ version: '5.0.0-beta.16', verified: true, assetSha256: 'a'.repeat(64) }); runtime.updates.markRebuildRequired({ reason: 'native-module' }); runtime.updates.readyToRelaunch();
  assert.equal(runtime.updates.snapshot().state, 'ready-to-relaunch');
  runtime.product.apply({ type: 'error.reported', payload: { code: 'BOOT_FAILED', recoveryActions: ['rollback-update', 'reauthenticate'] } });
  assert.deepEqual(runtime.project('electron').state.errors[0].recoveryActions, ['rollback-update', 'reauthenticate']);
});
