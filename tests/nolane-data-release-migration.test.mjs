import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';

import { loadConfig } from '../src/config.mjs';
import { migrateLegacyDataDirectory, rollbackDataDirectoryMigration } from '../src/config/nolane-data-migration.mjs';
import { UpdateService } from '../src/update/update-service.mjs';

async function exists(file) { try { await stat(file); return true; } catch { return false; } }

test('default config uses the Nolane Agent data directory', () => {
  const home = os.homedir();
  const config = loadConfig({ totalMemoryBytes: 8 * 1024 ** 3 });
  assert.equal(config.dataDir, path.join(home, '.nolane-agent'));
});

test('legacy data directory migrates atomically and can be rolled back from its receipt', async (t) => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'nolane-data-migration-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const legacy = path.join(home, '.forge-studio');
  const canonical = path.join(home, '.nolane-agent');
  await mkdir(legacy, { recursive: true });
  await writeFile(path.join(legacy, 'state.db'), 'state');

  const result = await migrateLegacyDataDirectory({ homeDirectory: home });
  assert.equal(result.status, 'migrated');
  assert.equal(result.dataDir, canonical);
  assert.equal(await readFile(path.join(canonical, 'state.db'), 'utf8'), 'state');
  assert.equal(await exists(legacy), false);
  const receipt = JSON.parse(await readFile(result.receiptPath, 'utf8'));
  assert.equal(receipt.schema, 'nolane.agent.data-directory-migration.v1');
  assert.match(receipt.receiptSha256, /^[a-f0-9]{64}$/);

  const rolledBack = await rollbackDataDirectoryMigration({ receiptPath: result.receiptPath });
  assert.equal(rolledBack.status, 'rolled-back');
  assert.equal(await readFile(path.join(legacy, 'state.db'), 'utf8'), 'state');
  assert.equal(await exists(canonical), false);
});

test('data migration fails closed when canonical and legacy directories both exist', async (t) => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'nolane-data-conflict-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  await mkdir(path.join(home, '.forge-studio'));
  await mkdir(path.join(home, '.nolane-agent'));
  await assert.rejects(() => migrateLegacyDataDirectory({ homeDirectory: home }), /both.*exist|conflict/i);
});

test('explicit data directory is never migrated', async (t) => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'nolane-data-explicit-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const explicit = path.join(home, 'custom');
  const result = await migrateLegacyDataDirectory({ homeDirectory: home, explicitDataDir: explicit });
  assert.deepEqual(result, { status: 'explicit', dataDir: explicit, receiptPath: null });
});

test('update service accepts Nolane alpha, beta and stable channels but rejects unknown channels', () => {
  const common = { currentVersion: '5.0.0-alpha.2', launcherVersion: '5.0.0-alpha.2', publicKey: 'key', dataDir: '.', fetchImpl: async () => new Response() };
  for (const channel of ['alpha', 'beta', 'stable']) assert.doesNotThrow(() => new UpdateService({ ...common, channel }));
  assert.throws(() => new UpdateService({ ...common, channel: 'preview' }), /unsupported update channel/i);
});
