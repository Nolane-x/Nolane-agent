import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { SettingsService } from '../src/settings/settings-service.mjs';
import { PersonalizationProfileService } from '../src/personalization/personalization-profile-service.mjs';
import { PERSONALIZATION_PROFILE_SCHEMA } from '../src/personalization/personalization-profile-schema.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-personalization-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  let tick = 0;
  const clock = () => `2026-08-03T15:00:${String(tick++).padStart(2, '0')}.000Z`;
  const settings = new SettingsService({
    dataDir: path.join(root, 'data'),
    getProject: () => null,
    defaults: {
      experience: { level: 'everyday' },
      general: { language: 'system', defaultIntent: 'ask', notifications: true },
      personalization: { explanationDepth: 'balanced', responseStyle: 'direct', askBeforeAmbiguousChanges: true, showReasoningSummary: true, preferredDocumentationLanguage: 'system' },
      appearance: { theme: 'system', accent: 'violet', density: 'comfortable', motion: 'system', codeFontSize: 14, zoom: 100 },
      accessibility: { highContrast: false, alwaysShowFocus: false, screenReaderAnnouncements: true, keyboardResizeStep: 16 },
      memory: { enabled: true, retentionDays: 365 },
      context: { strategy: 'auto', maxUtilizationPercent: 80 },
      notifications: { desktop: true, taskCompletion: true, approvals: true, errors: true, sound: 'important', quietHours: false },
      data: { telemetry: false, historyRetentionDays: 365, autoBackup: true },
      updates: { channel: 'beta', autoDownload: false, includeModelCatalog: true },
      permissions: { defaultMode: 'workspace' }
    }
  });
  const service = new PersonalizationProfileService({ settingsService: settings, dataDir: path.join(root, 'data'), clock });
  return { root, settings, service };
}

test('exports a versioned profile projected from effective Settings', async (t) => {
  const { service } = await fixture(t);
  const profile = await service.exportProfile();
  assert.equal(profile.schema, PERSONALIZATION_PROFILE_SCHEMA);
  assert.equal(profile.preferences.experience.level, 'everyday');
  assert.equal(profile.preferences.personalization.explanationDepth, 'balanced');
  assert.equal(profile.provenance['experience.level'].winningLayer, 'defaults');
  assert.match(profile.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(profile.preferences.permissions, undefined);
});

test('previews and applies imports through the user Settings layer while preserving extensions', async (t) => {
  const { root, settings, service } = await fixture(t);
  const profile = {
    schema: PERSONALIZATION_PROFILE_SCHEMA,
    profileId: 'default',
    version: 1,
    preferences: {
      experience: { level: 'expert' },
      general: { language: 'vi' },
      personalization: { explanationDepth: 'research', responseStyle: 'reviewer' },
      futureArea: { futurePreference: 'preserve-me' }
    },
    extensions: { vendor: { feature: true } },
    futureTopLevel: { revision: 2 }
  };
  const preview = await service.previewImport({ profile });
  assert.equal(preview.valid, true);
  assert.deepEqual(preview.acceptedPaths, ['experience.level', 'general.language', 'personalization.explanationDepth', 'personalization.responseStyle']);
  assert.equal(preview.extensions.unknownPreferences.futureArea.futurePreference, 'preserve-me');
  assert.equal(preview.extensions.unknownTopLevel.futureTopLevel.revision, 2);

  const applied = await service.applyImport({ profile, source: 'onboarding' });
  assert.equal(applied.profile.preferences.experience.level, 'expert');
  assert.equal((await settings.layer('user')).general.language, 'vi');
  assert.equal(applied.profile.provenance['experience.level'].source, 'onboarding');
  assert.equal(applied.profile.extensions.unknownPreferences.futureArea.futurePreference, 'preserve-me');

  const metadata = JSON.parse(await readFile(path.join(root, 'data', 'personalization', 'default.metadata.json'), 'utf8'));
  assert.equal(metadata.history.at(-1).source, 'onboarding');
  assert.equal(metadata.fields['experience.level'].source, 'onboarding');
});

test('rejects invalid enum values and never imports authority paths', async (t) => {
  const { service } = await fixture(t);
  const invalid = {
    schema: PERSONALIZATION_PROFILE_SCHEMA,
    profileId: 'default',
    version: 1,
    preferences: { experience: { level: 'god-mode' } }
  };
  const preview = await service.previewImport({ profile: invalid });
  assert.equal(preview.valid, false);
  assert.ok(preview.errors.some((error) => error.path === 'experience.level'));
  await assert.rejects(() => service.applyImport({ profile: invalid }), (error) => error.code === 'personalization_import_invalid');

  await assert.rejects(
    () => service.updatePreferences({ patch: { permissions: { defaultMode: 'full' } } }),
    (error) => error.code === 'personalization_paths_unsupported'
  );
});

test('runtime context contains communication preferences but excludes security, memory and update controls', async (t) => {
  const { service } = await fixture(t);
  const context = await service.compileContext();
  assert.equal(context.values.personalization.responseStyle, 'direct');
  assert.equal(context.values.general.defaultIntent, 'ask');
  assert.equal(context.values.permissions, undefined);
  assert.equal(context.values.memory, undefined);
  assert.equal(context.values.updates, undefined);
  assert.match(context.receiptSha256, /^[a-f0-9]{64}$/);
});
