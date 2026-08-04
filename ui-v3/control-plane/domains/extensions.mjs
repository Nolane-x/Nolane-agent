const freeze = (items) => Object.freeze(items.map((item) => Object.freeze({ ...item })));
export function buildExtensionsView({ providers = [], models = [], skills = [], plugins = [] } = {}) {
  return Object.freeze({ providers: freeze(providers.map((item) => ({ ...item, connected: item.connected === true }))), models: freeze(models), skills: freeze(skills), plugins: freeze(plugins.map((item) => ({ ...item, canActivate: item.signed === true && item.quarantined !== true && item.capabilitiesReviewed === true }))) });
}
export function renderExtensionsView(value) { return `<section><h1>Extensions</h1><p>${value.providers.length} providers · ${value.plugins.length} plugins</p></section>`; }
