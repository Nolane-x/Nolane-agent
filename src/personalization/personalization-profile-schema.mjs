import { createHash } from 'node:crypto';

export const PERSONALIZATION_PROFILE_SCHEMA = 'nolane.personalization-profile.v1';
export const PERSONALIZATION_PROFILE_VERSION = 1;

export const PERSONALIZATION_SETTING_PATHS = Object.freeze([
  'experience.level',
  'general.language',
  'general.defaultIntent',
  'general.notifications',
  'personalization.explanationDepth',
  'personalization.responseStyle',
  'personalization.askBeforeAmbiguousChanges',
  'personalization.showReasoningSummary',
  'personalization.preferredDocumentationLanguage',
  'appearance.theme',
  'appearance.accent',
  'appearance.density',
  'appearance.motion',
  'appearance.codeFontSize',
  'appearance.zoom',
  'accessibility.highContrast',
  'accessibility.alwaysShowFocus',
  'accessibility.screenReaderAnnouncements',
  'accessibility.keyboardResizeStep',
  'memory.enabled',
  'memory.retentionDays',
  'context.strategy',
  'context.maxUtilizationPercent',
  'notifications.desktop',
  'notifications.taskCompletion',
  'notifications.approvals',
  'notifications.errors',
  'notifications.sound',
  'notifications.quietHours',
  'data.telemetry',
  'data.historyRetentionDays',
  'data.autoBackup',
  'updates.channel',
  'updates.autoDownload',
  'updates.includeModelCatalog'
]);

export const PERSONALIZATION_RUNTIME_PATHS = Object.freeze([
  'experience.level',
  'general.language',
  'general.defaultIntent',
  'personalization.explanationDepth',
  'personalization.responseStyle',
  'personalization.askBeforeAmbiguousChanges',
  'personalization.showReasoningSummary',
  'personalization.preferredDocumentationLanguage',
  'accessibility.screenReaderAnnouncements'
]);

const PROFILE_KEYS = new Set(['schema', 'profileId', 'version', 'preferences', 'provenance', 'extensions', 'createdAt', 'updatedAt', 'receiptSha256']);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

export function profileReceipt(value) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

export function assertPersonalizationProfile(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Object.assign(new TypeError('Personalization profile must be an object'), { statusCode: 400, code: 'personalization_profile_invalid' });
  if (value.schema !== PERSONALIZATION_PROFILE_SCHEMA) throw Object.assign(new TypeError(`Unsupported personalization profile schema: ${value.schema ?? '<missing>'}`), { statusCode: 400, code: 'personalization_profile_schema_unsupported' });
  if (Number(value.version) !== PERSONALIZATION_PROFILE_VERSION) throw Object.assign(new TypeError(`Unsupported personalization profile version: ${value.version ?? '<missing>'}`), { statusCode: 400, code: 'personalization_profile_version_unsupported' });
  if (!value.preferences || typeof value.preferences !== 'object' || Array.isArray(value.preferences)) throw Object.assign(new TypeError('Personalization profile preferences must be an object'), { statusCode: 400, code: 'personalization_profile_preferences_invalid' });
  return value;
}

export function profileExtensions(value) {
  const unknownTopLevel = Object.fromEntries(Object.entries(value ?? {}).filter(([key]) => !PROFILE_KEYS.has(key)));
  return Object.freeze({
    declared: value?.extensions && typeof value.extensions === 'object' && !Array.isArray(value.extensions) ? structuredClone(value.extensions) : {},
    unknownTopLevel: structuredClone(unknownTopLevel)
  });
}
