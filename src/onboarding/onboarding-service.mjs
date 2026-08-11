import { OnboardingStateStore } from './onboarding-state-store.mjs';
import { onboardingAnswersToSettings, recommendedOnboardingAnswers } from './onboarding-recommendations.mjs';

function hasKeys(value) { return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0; }

export class OnboardingService {
  constructor({ dataDir, settingsService, personalizationProfile, store = null, disabled = false, postUpdateExistingInstallation = false, clock = () => new Date().toISOString(), stateStore = null } = {}) {
    if (!settingsService?.layer) throw new TypeError('OnboardingService requires SettingsService');
    if (!personalizationProfile?.updatePreferences) throw new TypeError('OnboardingService requires PersonalizationProfileService');
    this.settingsService = settingsService;
    this.personalizationProfile = personalizationProfile;
    this.store = store;
    this.disabled = Boolean(disabled);
    this.postUpdateExistingInstallation = Boolean(postUpdateExistingInstallation);
    this.state = stateStore ?? new OnboardingStateStore({ dataDir, clock });
  }

  async #matureInstallation() {
    const userSettings = await this.settingsService.layer('user').catch(() => ({}));
    if (hasKeys(userSettings)) return true;
    if (!this.store) return false;
    return Boolean(
      this.store.listProjects?.().length ||
      this.store.listMissions?.({}).length ||
      this.store.listMessages?.({ limit: 1 }).length ||
      this.store.listGoals?.({}).length
    );
  }

  async status() {
    let state = await this.state.read();
    let inferredExistingUser = false;
    if (!state.completed && (this.disabled || this.postUpdateExistingInstallation || await this.#matureInstallation())) {
      inferredExistingUser = !this.disabled;
      const source = this.disabled ? 'managed-policy' : this.postUpdateExistingInstallation ? 'post-update-existing-installation' : 'upgraded-installation';
      state = await this.state.complete({ source, draft: state.draft });
    }
    return Object.freeze({
      schema: 'nolane.onboarding-status.v1',
      required: state.completed !== true,
      disabled: this.disabled,
      inferredExistingUser,
      state
    });
  }

  async saveProgress({ currentStep = 0, answers = {} } = {}) {
    const status = await this.status();
    if (!status.required) return status;
    const state = await this.state.progress({ currentStep, draft: answers });
    return Object.freeze({ schema: 'nolane.onboarding-progress.v1', required: true, state });
  }

  async complete({ answers = {}, source = 'guided' } = {}) {
    const status = await this.status();
    if (!status.required) return Object.freeze({ schema: 'nolane.onboarding-completion.v1', alreadyCompleted: true, state: status.state, profile: await this.personalizationProfile.exportProfile() });
    const patch = onboardingAnswersToSettings(answers);
    const update = await this.personalizationProfile.updatePreferences({ patch, source: source === 'recommended-defaults' ? 'onboarding-recommended' : 'onboarding' });
    const state = await this.state.complete({ source, draft: answers });
    return Object.freeze({ schema: 'nolane.onboarding-completion.v1', alreadyCompleted: false, state, profile: update.profile });
  }

  async recommended({ primaryUse = 'chat' } = {}) {
    const answers = recommendedOnboardingAnswers(primaryUse);
    return this.complete({ answers, source: 'recommended-defaults' });
  }

  async skip({ answers = {} } = {}) {
    const status = await this.status();
    if (!status.required) {
      return Object.freeze({
        schema: 'nolane.onboarding-completion.v1',
        skipped: status.state.source === 'skipped',
        alreadyCompleted: true,
        state: status.state,
        profile: await this.personalizationProfile.exportProfile()
      });
    }
    const language = ['system', 'en', 'vi'].includes(String(answers?.language ?? '')) ? String(answers.language) : null;
    const profile = language
      ? await this.personalizationProfile.updatePreferences({ patch: { general: { language }, personalization: { preferredDocumentationLanguage: language } }, source: 'onboarding-skip' }).then((result) => result.profile)
      : await this.personalizationProfile.exportProfile();
    const state = await this.state.complete({ source: 'skipped', draft: language ? { language } : {} });
    return Object.freeze({ schema: 'nolane.onboarding-completion.v1', skipped: true, alreadyCompleted: false, state, profile });
  }
}
