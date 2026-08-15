import { t } from '../../core/i18n.8f2824bdb961.mjs';
export function buildReleaseView({ version = 'unknown', signed = false, integrityVerified = false, cleanRoomVerified = false, rollbackAvailable = false } = {}) {
  const blockers = [];
  if (!signed) blockers.push('signature');
  if (!integrityVerified) blockers.push('integrity');
  if (!cleanRoomVerified) blockers.push('clean-room');
  return Object.freeze({ version: String(version), signed: Boolean(signed), integrityVerified: Boolean(integrityVerified), cleanRoomVerified: Boolean(cleanRoomVerified), rollbackAvailable: Boolean(rollbackAvailable), blockers: Object.freeze(blockers), canPromote: blockers.length === 0 });
}
export function renderReleaseView(value, { language = 'en' } = {}) { return `<section><h1>${t('control.domain.release', language)}</h1><p>${value.version} · ${value.canPromote ? t('control.readyToPromote', language) : `${t('control.blocked', language)}: ${value.blockers.join(', ')}`}</p></section>`; }
