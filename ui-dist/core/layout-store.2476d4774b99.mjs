const KEY = 'nolane.ui.layout.v1';
const DEFAULTS = Object.freeze({ sidebarWidth: 288, dockWidth: 420, bottomHeight: 280, sidebarCollapsed: false, dockCollapsed: false, bottomCollapsed: true });
const LIMITS = Object.freeze({ sidebarWidth: [220, 520], dockWidth: [280, 720], bottomHeight: [160, 640] });
export function clampLayoutValue(key, value) { const range = LIMITS[key]; if (!range) return value; return Math.max(range[0], Math.min(range[1], Math.round(Number(value) || DEFAULTS[key]))); }
function normalize(input = {}) { const next = { ...DEFAULTS }; for (const [key, value] of Object.entries(input)) { if (key in LIMITS) next[key] = clampLayoutValue(key, value); else if (key in DEFAULTS) next[key] = Boolean(value); } return Object.freeze(next); }
export function createLayoutStore(storage = globalThis.localStorage) {
  let state = DEFAULTS;
  try { state = normalize(JSON.parse(storage?.getItem?.(KEY) ?? '{}')); } catch { try { storage?.removeItem?.(KEY); } catch {} }
  const save = () => { try { storage?.setItem?.(KEY, JSON.stringify(state)); } catch {} };
  return Object.freeze({ snapshot: () => state, update(patch = {}) { state = normalize({ ...state, ...patch }); save(); return state; }, reset() { state = DEFAULTS; try { storage?.removeItem?.(KEY); } catch {} return state; }, apply(root = document.documentElement) { root?.style?.setProperty('--sidebar-width', `${state.sidebarWidth}px`); root?.style?.setProperty('--artifact-dock-width', `${state.dockWidth}px`); root?.style?.setProperty('--bottom-panel-height', `${state.bottomHeight}px`); if (root?.dataset) root.dataset.sidebarCollapsed = String(state.sidebarCollapsed); return state; } });
}
