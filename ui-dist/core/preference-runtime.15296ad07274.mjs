import { normalizeExperience } from './experience-policy.72154f82984d.mjs';
import { normalizeLanguage } from './i18n.9f31bba2b172.mjs';

const STORAGE_KEY = 'nolane.ui.preferences.v2';
const LEGACY_STORAGE_KEY = 'nolane.ui.preferences.v1';
const THEMES = new Set(['system', 'nocturne', 'obsidian', 'graphite', 'aurora', 'snow', 'paper', 'dark', 'light']);
const ACCENTS = new Set(['violet', 'blue', 'cyan', 'rose', 'amber', 'emerald']);
const DENSITIES = new Set(['comfortable', 'compact']);
const MOTION = new Set(['system', 'full', 'reduced']);

function at(root, path, fallback) {
  const value = String(path).split('.').reduce((node, key) => node?.[key], root);
  return value === undefined || value === null ? fallback : value;
}
function numberInRange(value, fallback, min, max) { const number = Number(value); return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback; }
function normalizeTheme(value) { if (value === 'dark') return 'nocturne'; if (value === 'light') return 'snow'; return THEMES.has(value) ? value : 'nocturne'; }
function normalize(value = {}) {
  const theme = normalizeTheme(at(value, 'appearance.theme', value.theme ?? 'nocturne'));
  const accent = at(value, 'appearance.accent', value.accent ?? 'violet');
  const density = at(value, 'appearance.density', value.density ?? 'comfortable');
  const motion = at(value, 'appearance.motion', value.motion ?? 'system');
  const experience = normalizeExperience(at(value, 'experience.level', value.experience ?? 'everyday'));
  const language = normalizeLanguage(at(value, 'general.language', value.language ?? 'system'));
  return Object.freeze({
    theme,
    accent: ACCENTS.has(accent) ? accent : 'violet',
    density: DENSITIES.has(density) ? density : 'comfortable',
    motion: MOTION.has(motion) ? motion : 'system',
    experience,
    language,
    zoom: numberInRange(at(value, 'appearance.zoom', value.zoom ?? 100), 100, 75, 200),
    codeFontSize: numberInRange(at(value, 'appearance.codeFontSize', value.codeFontSize ?? 14), 14, 11, 24),
    highContrast: Boolean(at(value, 'accessibility.highContrast', value.highContrast ?? false)),
    alwaysShowFocus: Boolean(at(value, 'accessibility.alwaysShowFocus', value.alwaysShowFocus ?? false)),
    keyboardResizeStep: numberInRange(at(value, 'accessibility.keyboardResizeStep', value.keyboardResizeStep ?? 16), 16, 4, 64),
  });
}

export function readCachedPreferences(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(STORAGE_KEY) ?? storage?.getItem?.(LEGACY_STORAGE_KEY) ?? '{}';
    return normalize(JSON.parse(raw));
  } catch { try { storage?.removeItem?.(STORAGE_KEY); } catch {} return normalize(); }
}

export function applyPreferences(value = {}, root = globalThis.document?.documentElement, storage = globalThis.localStorage) {
  const preferences = normalize(value);
  if (root) {
    root.dataset.theme = preferences.theme;
    root.dataset.accent = preferences.accent;
    root.dataset.density = preferences.density;
    root.dataset.motion = preferences.motion;
    root.dataset.experienceLevel = preferences.experience;
    root.dataset.language = preferences.language;
    root.lang = preferences.language;
    root.dataset.highContrast = String(preferences.highContrast);
    root.dataset.alwaysShowFocus = String(preferences.alwaysShowFocus);
    root.style?.setProperty('--ui-zoom', String(preferences.zoom / 100));
    root.style?.setProperty('--code-font-size', `${preferences.codeFontSize}px`);
  }
  try { storage?.setItem?.(STORAGE_KEY, JSON.stringify(preferences)); } catch {}
  return preferences;
}

export { normalize as normalizePreferences };
