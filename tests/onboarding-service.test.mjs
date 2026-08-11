import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { SettingsService } from '../src/settings/settings-service.mjs';
import { PersonalizationProfileService } from '../src/personalization/personalization-profile-service.mjs';
import { OnboardingService } from '../src/onboarding/onboarding-service.mjs';

async function fixture(t, { existing = false, disabled = false, postUpdate = false } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-onboarding-')); t.after(() => rm(root, { recursive: true, force: true }));
  let tick = 0; const clock = () => `2026-08-03T16:00:${String(tick++).padStart(2, '0')}.000Z`;
  const settings = new SettingsService({
    dataDir: path.join(root, 'data'), getProject: () => null,
    defaults: {
      experience: { level: 'everyday' }, general: { language: 'system', defaultIntent: 'ask', notifications: true },
      personalization: { explanationDepth: 'balanced', responseStyle: 'direct', askBeforeAmbiguousChanges: true, showReasoningSummary: true, preferredDocumentationLanguage: 'system' },
      appearance: { theme: 'system', accent: 'violet', density: 'comfortable', motion: 'system', codeFontSize: 14, zoom: 100 },
      accessibility: { highContrast: false, alwaysShowFocus: false, screenReaderAnnouncements: true, keyboardResizeStep: 16 },
      memory: { enabled: true, retentionDays: 365 }, context: { strategy: 'auto', maxUtilizationPercent: 80 },
      notifications: { desktop: true, taskCompletion: true, approvals: true, errors: true, sound: 'important', quietHours: false },
      data: { telemetry: false, historyRetentionDays: 365, autoBackup: true }, updates: { channel: 'beta', autoDownload: false, includeModelCatalog: true }
    }
  });
  const profile = new PersonalizationProfileService({ settingsService: settings, dataDir: path.join(root, 'data'), clock });
  const store = { listProjects: () => existing ? [{ id: 'p1' }] : [], listMissions: () => [], listMessages: () => [], listGoals: () => [] };
  const service = new OnboardingService({ dataDir: path.join(root, 'data'), settingsService: settings, personalizationProfile: profile, store, disabled, postUpdateExistingInstallation: postUpdate, clock });
  return { root, settings, profile, service };
}

test('fresh installations require onboarding and persist bounded progress', async (t) => {
  const { root, service } = await fixture(t);
  assert.equal((await service.status()).required, true);
  const progress = await service.saveProgress({ currentStep: 2, answers: { language: 'vi', primaryUse: 'software' } });
  assert.equal(progress.state.currentStep, 2);
  const reopened = JSON.parse(await readFile(path.join(root, 'data', 'onboarding', 'state.json'), 'utf8'));
  assert.equal(reopened.completed, false);
  assert.equal(reopened.draft.primaryUse, 'software');
  assert.equal(reopened.schemaVersion, 1);
});

test('existing installations are inferred and never see first-run setup after an update', async (t) => {
  const { service } = await fixture(t, { existing: true });
  const status = await service.status();
  assert.equal(status.required, false);
  assert.equal(status.inferredExistingUser, true);
  assert.equal(status.state.source, 'upgraded-installation');
});

test('post-update launch never reopens first-run onboarding even when the prior installation had no mature records', async (t) => {
  const { service } = await fixture(t, { postUpdate: true });
  const status = await service.status();
  assert.equal(status.required, false);
  assert.equal(status.inferredExistingUser, true);
  assert.equal(status.state.source, 'post-update-existing-installation');
});

test('guided completion writes existing enums through Personalization without authority escalation', async (t) => {
  const { settings, service } = await fixture(t);
  const result = await service.complete({
    answers: {
      language: 'vi', primaryUse: 'software', explanationDepth: 'detailed', responseStyle: 'reviewer', askBeforeAmbiguousChanges: true,
      experience: 'studio', defaultIntent: 'build', theme: 'obsidian', accent: 'cyan', density: 'compact', motion: 'reduced',
      memoryMode: 'approved', notifications: { desktop: true, taskCompletion: true, approvals: true, errors: true }, telemetry: false
    }
  });
  assert.equal(result.state.completed, true);
  const user = await settings.layer('user');
  assert.equal(user.experience.level, 'studio');
  assert.equal(user.personalization.responseStyle, 'reviewer');
  assert.equal(user.appearance.accent, 'cyan');
  assert.equal(user.permissions, undefined);
  assert.equal(user.autopilot, undefined);
});

test('recommended advanced setup remains a presentation preference and does not grant permissions', async (t) => {
  const { settings, service } = await fixture(t);
  const result = await service.recommended({ primaryUse: 'advanced' });
  assert.equal(result.profile.preferences.experience.level, 'expert');
  const user = await settings.layer('user');
  assert.equal(user.general.defaultIntent, 'plan');
  assert.equal(user.permissions, undefined);
  assert.equal(user.autopilot, undefined);
});

test('managed policy skips onboarding without modifying user preferences', async (t) => {
  const { settings, service } = await fixture(t, { disabled: true });
  const status = await service.status();
  assert.equal(status.required, false);
  assert.equal(status.state.source, 'managed-policy');
  assert.deepEqual(await settings.layer('user'), {});
});

test('skip is idempotent and never overwrites an existing completion source', async (t) => {
  const { service } = await fixture(t);
  const first = await service.complete({ answers: { primaryUse: 'software' }, source: 'guided' });
  const second = await service.skip();

  assert.equal(first.state.source, 'guided');
  assert.equal(second.alreadyCompleted, true);
  assert.equal(second.skipped, false);
  assert.equal(second.state.source, 'guided');
});

test('skip preserves an explicitly selected interface language without applying other onboarding defaults', async (t) => {
  const { settings, service } = await fixture(t);
  const result = await service.skip({ answers: { language: 'vi' } });

  assert.equal(result.skipped, true);
  const user = await settings.layer('user');
  assert.equal(user.general.language, 'vi');
  assert.equal(user.experience, undefined);
});
