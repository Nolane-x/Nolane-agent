import { validateSettingsPatch } from '../settings/settings-catalog.mjs';
import {
  PERSONALIZATION_PROFILE_SCHEMA,
  PERSONALIZATION_PROFILE_VERSION,
  assertPersonalizationProfile,
  profileExtensions,
  profileReceipt
} from './personalization-profile-schema.mjs';
import {
  compilePersonalizationContext,
  flattenSettings,
  getAt,
  importPersonalizationPreferences,
  projectPersonalizationSettings
} from './personalization-settings-mapper.mjs';
import { PersonalizationMetadataStore } from './personalization-metadata-store.mjs';

function freeze(value) { return Object.freeze(structuredClone(value)); }

function changeList(current, patch) {
  const changes = [];
  for (const [path, value] of flattenSettings(patch)) {
    const previous = getAt(current, path);
    if (JSON.stringify(previous) !== JSON.stringify(value)) changes.push(Object.freeze({ path, previous: structuredClone(previous), next: structuredClone(value) }));
  }
  return Object.freeze(changes);
}

export class PersonalizationProfileService {
  constructor({ settingsService, dataDir, profileId = 'default', clock = () => new Date().toISOString(), metadataStore = null } = {}) {
    if (!settingsService?.effective || !settingsService?.update || !settingsService?.catalog) throw new TypeError('PersonalizationProfileService requires SettingsService');
    this.settingsService = settingsService;
    this.profileId = String(profileId || 'default');
    this.clock = clock;
    this.metadata = metadataStore ?? new PersonalizationMetadataStore({ dataDir, profileId: this.profileId, clock });
  }

  async exportProfile({ projectId = null } = {}) {
    const [effective, metadata] = await Promise.all([this.settingsService.effective(projectId), this.metadata.read()]);
    const preferences = projectPersonalizationSettings(effective.value);
    const provenance = {};
    for (const [path] of flattenSettings(preferences)) {
      provenance[path] = {
        winningLayer: effective.provenance[path] ?? 'defaults',
        source: metadata.fields?.[path]?.source ?? effective.provenance[path] ?? 'default',
        lastChangedAt: metadata.fields?.[path]?.lastChangedAt ?? null,
        revision: metadata.fields?.[path]?.revision ?? null
      };
    }
    const base = {
      schema: PERSONALIZATION_PROFILE_SCHEMA,
      profileId: this.profileId,
      version: PERSONALIZATION_PROFILE_VERSION,
      preferences,
      provenance,
      extensions: metadata.importedExtensions ?? {},
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt
    };
    return freeze({ ...base, receiptSha256: profileReceipt(base) });
  }

  async previewImport({ profile, projectId = null } = {}) {
    const input = assertPersonalizationProfile(profile);
    const mapped = importPersonalizationPreferences(input.preferences);
    const errors = validateSettingsPatch(mapped.patch, this.settingsService.catalog());
    const effective = await this.settingsService.effective(projectId);
    const changes = changeList(effective.value, mapped.patch);
    const extensions = { ...profileExtensions(input), unknownPreferences: mapped.unknown };
    const base = {
      schema: 'nolane.personalization-import-preview.v1',
      profileId: this.profileId,
      valid: errors.length === 0,
      acceptedPaths: mapped.accepted,
      changes,
      errors,
      extensions
    };
    return freeze({ ...base, receiptSha256: profileReceipt(base), patch: mapped.patch });
  }

  async applyImport({ profile, projectId = null, source = 'explicit-import' } = {}) {
    const preview = await this.previewImport({ profile, projectId });
    if (!preview.valid) throw Object.assign(new Error('Personalization profile import validation failed'), { statusCode: 400, code: 'personalization_import_invalid', details: preview.errors });
    const result = await this.settingsService.update({ layer: 'user', projectId: null, patch: preview.patch });
    await this.metadata.record({ paths: preview.acceptedPaths, source, receiptSha256: preview.receiptSha256, importedExtensions: preview.extensions });
    return freeze({
      schema: 'nolane.personalization-import-result.v1',
      applied: true,
      changedPaths: preview.changes.map(({ path }) => path),
      effective: result.effective,
      profile: await this.exportProfile({ projectId })
    });
  }

  async updatePreferences({ patch, source = 'explicit', projectId = null } = {}) {
    const mapped = importPersonalizationPreferences(patch ?? {});
    const unknownPaths = [...flattenSettings(mapped.unknown).keys()];
    if (unknownPaths.length) throw Object.assign(new Error(`Unsupported personalization settings: ${unknownPaths.join(', ')}`), { statusCode: 400, code: 'personalization_paths_unsupported', details: unknownPaths.map((path) => ({ path, code: 'unsupported-personalization-path' })) });
    const result = await this.settingsService.update({ layer: 'user', patch: mapped.patch });
    await this.metadata.record({ paths: mapped.accepted, source, receiptSha256: profileReceipt({ source, patch: mapped.patch, at: this.clock() }) });
    return freeze({ result, profile: await this.exportProfile({ projectId }) });
  }

  async compileContext({ projectId = null } = {}) {
    const effective = await this.settingsService.effective(projectId);
    const values = compilePersonalizationContext(effective.value);
    const base = { schema: 'nolane.personalization-context.v1', projectId, values };
    return freeze({ ...base, receiptSha256: profileReceipt(base) });
  }
}
