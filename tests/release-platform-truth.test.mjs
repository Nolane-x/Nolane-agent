import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tablePath = path.join(root, 'config', 'release-platform-capabilities.json');

test('release platform truth is machine-readable and fail-closed per platform', async () => {
  assert.equal(existsSync(tablePath), true, 'Task 12 requires config/release-platform-capabilities.json as the canonical machine-readable platform table');
  const table = JSON.parse(await readFile(tablePath, 'utf8'));
  assert.equal(table.schema, 'nolane.release-platform-capabilities.v1');
  assert.deepEqual(Object.keys(table.platforms).sort(), ['darwin', 'linux', 'win32']);

  const windows = table.platforms.win32;
  assert.deepEqual(windows.packageKinds, ['nsis']);
  assert.equal(windows.inAppUpdateHandoff.enabled, true);
  assert.equal(windows.nativeInstallHandoff.enabled, true);
  assert.equal(windows.nativeInstallHandoff.mechanism, 'nsis');

  const mac = table.platforms.darwin;
  assert.deepEqual(mac.packageKinds, ['dmg', 'zip']);
  assert.equal(mac.inAppUpdateHandoff.enabled, false);
  assert.equal(mac.nativeInstallHandoff.enabled, false);
  assert.match(mac.nativeInstallHandoff.reason, /verified|unsupported|not yet/i);

  const linux = table.platforms.linux;
  assert.deepEqual(linux.packageKinds, ['appimage', 'deb']);
  assert.equal(linux.inAppUpdateHandoff.enabled, false);
  assert.equal(linux.nativeInstallHandoff.enabled, false);
  assert.match(linux.nativeInstallHandoff.reason, /verified|unsupported|not yet/i);

  for (const platform of Object.values(table.platforms)) {
    assert.ok(['verified', 'conditional', 'unknown', 'blocked', 'not-applicable'].includes(platform.signing.status));
    assert.ok(['verified', 'conditional', 'unknown', 'blocked', 'not-applicable'].includes(platform.notarization.status));
    assert.equal(typeof platform.recovery.preUpdateSnapshot, 'boolean');
    assert.equal(typeof platform.recovery.migrationJournal, 'boolean');
    assert.ok(['verified', 'external-gate', 'unknown', 'blocked'].includes(platform.recovery.realUpdateReplay));
  }
});
