import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('UI v3 settings route mounts the real API controller and applies preferences', async () => {
  const app = await readFile(new URL('../ui-v3/app.mjs', import.meta.url), 'utf8');
  const view = await readFile(new URL('../ui-v3/views/settings/settings-view.mjs', import.meta.url), 'utf8');
  assert.match(app, /createApiClient/);
  assert.match(app, /createSettingsController/);
  assert.match(app, /applyPreferences/);
  assert.match(app, /view\.mount/);
  assert.match(app, /data-settings-action/);
  assert.match(app, /data-model-provider-setup/);
  assert.match(app, /configureProvider/);
  assert.match(app, /startProviderLogin/);
  assert.match(app, /refreshProviders/);
  assert.match(app, /logoutProvider/);
  assert.match(app, /captureViewState\(mountedRoot\)/);
  assert.match(app, /restoreViewState\(mountedRoot,viewState\)/);
  assert.match(app, /focus\(\{preventScroll:true\}\)/);
  assert.match(app, /settingsSectionFromRoute/);
  assert.match(app, /\/settings\?section=notifications/);
  assert.match(app, /\/settings\?section=shortcuts/);
  assert.match(view, /data-scroll-key="settings-content"/);
});

test('UI v3 settings keeps Vietnamese labels translated after a live language switch', async () => {
  const view = await readFile(new URL('../ui-v3/views/settings/settings-view.mjs', import.meta.url), 'utf8');
  assert.match(view, /Cài đặt Nolane/);
  assert.match(view, /Chuyên gia/);
  assert.match(view, /Mở giao diện phục hồi/);
  assert.match(view, /Đêm tím/);
  assert.match(view, /VI_SUFFIX/);
  assert.match(view, /ngày/);
  assert.match(view, /Đã đặt model định tuyến mặc định/);
  assert.match(view, /Mục này chỉ có thao tác và chẩn đoán/);
});

test('UI v3 settings preserves an unsaved language choice across the preview remount', async () => {
  const app = await readFile(new URL('../ui-v3/app.mjs', import.meta.url), 'utf8');

  assert.match(app, /let pendingSettingsLanguage=null;/);
  assert.match(app, /await controller\.load\(\);if\(pendingSettingsLanguage!==null\)controller\.set\('general\.language',pendingSettingsLanguage\)/);
  assert.match(app, /pendingSettingsLanguage=value;await languageSync\.preview\(value,currentRouteState\?\.path\?\?'\/settings'\)/);
  assert.match(app, /pendingSettingsLanguage=null;await languageSync\.commit\(currentRouteState\?\.path\?\?'\/settings'\)/);
});
