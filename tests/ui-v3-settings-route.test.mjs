import test from 'node:test';
import assert from 'node:assert/strict';

import { settingsSectionFromRoute } from '../ui-v3/core/settings-route.mjs';

const categories = [{ id: 'notifications' }, { id: 'shortcuts' }];

test('settings deep links accept only known settings categories', () => {
  assert.equal(settingsSectionFromRoute('/settings?section=notifications', { categories }), 'notifications');
  assert.equal(settingsSectionFromRoute('/settings?section=shortcuts', { categories }), 'shortcuts');
  assert.equal(settingsSectionFromRoute('/settings?section=not-a-category', { categories }), null);
  assert.equal(settingsSectionFromRoute('/projects?section=notifications', { categories }), null);
});
