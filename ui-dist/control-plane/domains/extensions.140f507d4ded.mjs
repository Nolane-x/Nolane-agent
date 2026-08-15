import { t } from '../../core/i18n.9088a926d7a1.mjs';
const freeze = (items) => Object.freeze(items.map((item) => Object.freeze({ ...item })));
export function buildExtensionsView({ providers = [], models = [], skills = [], plugins = [] } = {}) {
  return Object.freeze({ providers: freeze(providers.map((item) => ({ ...item, connected: item.connected === true }))), models: freeze(models), skills: freeze(skills), plugins: freeze(plugins.map((item) => ({ ...item, canActivate: item.signed === true && item.quarantined !== true && item.capabilitiesReviewed === true }))) });
}
export function renderExtensionsView(value, { language = 'en' } = {}) { return `<section><h1>${t('control.domain.extensions', language)}</h1><p>${value.providers.length} ${t('control.providers', language)} · ${value.plugins.length} ${t('control.plugins', language)}</p></section>`; }
