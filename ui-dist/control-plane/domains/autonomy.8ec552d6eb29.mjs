import { t } from '../../core/i18n.c54715270e36.mjs';
const PRESETS = new Set(['ask', 'plan', 'build', 'verify']);
export function buildAutonomyView({ preset = 'ask', budgets = {}, spawning = {}, recovery = {} } = {}) {
  if (!PRESETS.has(preset)) throw new Error(`Unknown autonomy preset: ${preset}`);
  return Object.freeze({ preset, budgets: Object.freeze({ ...budgets }), spawning: Object.freeze({ maxAgents: Math.max(0, Number(spawning.maxAgents) || 0) }), recovery: Object.freeze({ ...recovery }), requiresApprovalForIrreversible: true, autoPromotionAllowed: false });
}
export function renderAutonomyView(value, { language = 'en' } = {}) { return `<section><h1>${t('control.domain.autonomy', language)}</h1><p>${t('control.preset', language)}: ${value.preset} · ${t('control.irreversibleApproval', language)}</p></section>`; }
