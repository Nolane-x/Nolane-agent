const PRESETS = new Set(['ask', 'plan', 'build', 'verify']);
export function buildAutonomyView({ preset = 'ask', budgets = {}, spawning = {}, recovery = {} } = {}) {
  if (!PRESETS.has(preset)) throw new Error(`Unknown autonomy preset: ${preset}`);
  return Object.freeze({ preset, budgets: Object.freeze({ ...budgets }), spawning: Object.freeze({ maxAgents: Math.max(0, Number(spawning.maxAgents) || 0) }), recovery: Object.freeze({ ...recovery }), requiresApprovalForIrreversible: true, autoPromotionAllowed: false });
}
export function renderAutonomyView(value) { return `<section><h1>Autonomy</h1><p>Preset: ${value.preset} · irreversible actions require approval</p></section>`; }
