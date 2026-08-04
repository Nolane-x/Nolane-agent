import { SettingsService } from '../settings/settings-service.mjs';
import { PersonalizationProfileService } from '../personalization/personalization-profile-service.mjs';
import { OnboardingService } from '../onboarding/onboarding-service.mjs';
import { SessionRestoreService } from '../session/session-restore-service.mjs';
import { PreUpdateSnapshotService } from '../update/pre-update-snapshot.mjs';
import { UpdatePreparationService } from '../update/update-preparation-service.mjs';
import { ExecutionStoryService } from '../activity/execution-story-service.mjs';
import { TimeTravelService } from '../time-travel/time-travel-service.mjs';

/**
 * Compose the Checkpoint 14 trust-and-adoption services behind one bounded
 * application-root dependency. Existing SettingsService remains the source of
 * truth; the returned profile is only a governed projection over that service.
 */
export function createTrustAdoptionFoundation({
  dataDir,
  store,
  currentVersion,
  settingsDefaults,
  settingsLockedKeys,
  getProject,
  onboardingDisabled = false,
  postUpdateExistingInstallation = false,
} = {}) {
  if (!dataDir) throw new TypeError('dataDir is required');
  if (!store) throw new TypeError('store is required');
  if (!currentVersion) throw new TypeError('currentVersion is required');
  if (!settingsDefaults || typeof settingsDefaults !== 'object') throw new TypeError('settingsDefaults are required');
  if (typeof getProject !== 'function') throw new TypeError('getProject must be a function');

  const settingsService = new SettingsService({
    dataDir,
    getProject,
    defaults: settingsDefaults,
    lockedKeys: settingsLockedKeys,
  });
  const personalizationProfile = new PersonalizationProfileService({ settingsService, dataDir });
  const onboardingService = new OnboardingService({
    dataDir,
    settingsService,
    personalizationProfile,
    store,
    disabled: onboardingDisabled,
    postUpdateExistingInstallation,
  });
  const sessionRestore = new SessionRestoreService({ dataDir });
  const preUpdateSnapshot = new PreUpdateSnapshotService({ dataDir, store });
  const updatePreparation = new UpdatePreparationService({
    currentVersion,
    store,
    snapshotService: preUpdateSnapshot,
    dataDir,
  });

  return Object.freeze({
    settingsService,
    personalizationProfile,
    onboardingService,
    sessionRestore,
    preUpdateSnapshot,
    updatePreparation,
  });
}


export function createExecutionStoryFoundation({ store, activityProjection, clock } = {}) {
  return new ExecutionStoryService({ store, activityProjection, clock });
}


export function createTimeTravelFoundation({ dataDir, store, executionStory, clock } = {}) {
  return new TimeTravelService({ dataDir, store, executionStory, clock });
}
