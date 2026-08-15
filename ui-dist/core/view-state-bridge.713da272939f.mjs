import { experienceRank, normalizeExperience } from './experience-policy.97d047c99bd0.mjs';

function keyFor(element) {
  return element?.dataset?.preserveKey || element?.dataset?.settingPath || element?.name || element?.id || null;
}

function safeControl(control, maxDraftChars) {
  if (!control || control.disabled || control.type === 'password' || control.type === 'file') return null;
  const key = keyFor(control);
  if (!key) return null;
  const value = typeof control.value === 'string' ? control.value.slice(0, maxDraftChars) : null;
  return { key, value, checked: typeof control.checked === 'boolean' ? control.checked : null, selection: control.selectionStart == null ? null : [control.selectionStart, control.selectionEnd] };
}

function scrollRegions(root) {
  const seen = new Set();
  return [...(root?.querySelectorAll?.('[data-scroll-key]') ?? [])].flatMap((element) => {
    const key = String(element?.dataset?.scrollKey ?? '');
    if (!key || key.length > 160 || seen.has(key)) return [];
    seen.add(key);
    return [{ key, top: Number(element.scrollTop) || 0, left: Number(element.scrollLeft) || 0 }];
  });
}

function minimumExperience(pathValue) {
  const path = String(pathValue || '/');
  if (path.startsWith('/control-plane')) return 'expert';
  if (path.startsWith('/workroom') || path.startsWith('/studio')) return 'studio';
  if (path.startsWith('/missions') || path.startsWith('/review') || path.startsWith('/projects') || path.startsWith('/skills')) return 'workspace';
  return 'everyday';
}

function fallbackPath(pathValue, target) {
  const path = String(pathValue || '/');
  if (experienceRank(target) >= experienceRank(minimumExperience(path))) return path;
  if (target === 'studio') return '/workroom';
  if (target === 'workspace') return path.startsWith('/missions') ? path : '/missions';
  return '/';
}

export function createViewStateBridge({ maxDraftChars = 100_000 } = {}) {
  const states = new Map();
  const lastRoute = new Map();
  return Object.freeze({
    capture(root = globalThis.document, { experience = 'everyday', path = '/' } = {}) {
      const level = normalizeExperience(experience);
      const controls = [...(root?.querySelectorAll?.('input, textarea, select') ?? [])].map((control) => safeControl(control, maxDraftChars)).filter(Boolean);
      const active = root?.activeElement;
      const state = {
        experience: level,
        path: String(path || '/'),
        controls,
        focusKey: keyFor(active),
        workspaceScrollTop: root?.querySelector?.('#workspace')?.scrollTop ?? 0,
        sidebarScrollTop: root?.querySelector?.('#session-groups')?.scrollTop ?? 0,
        scrollRegions: scrollRegions(root),
        summaryOpen: root?.querySelector?.('#output-summary-root')?.dataset?.open === 'true'
      };
      states.set(level, state);
      lastRoute.set(level, state.path);
      return structuredClone(state);
    },
    resolveDestination({ currentPath = '/', targetExperience = 'everyday' } = {}) {
      const target = normalizeExperience(targetExperience);
      const remembered = lastRoute.get(target);
      if (remembered && experienceRank(target) >= experienceRank(minimumExperience(remembered))) return remembered;
      return fallbackPath(currentPath, target);
    },
    restore(root = globalThis.document, { experience = 'everyday' } = {}) {
      const state = states.get(normalizeExperience(experience));
      if (!state || !root) return false;
      for (const item of state.controls) {
        const escaped = globalThis.CSS?.escape ? CSS.escape(item.key) : item.key.replace(/["\\]/g, '\\$&');
        const control = root.querySelector?.(`[data-preserve-key="${escaped}"], [data-setting-path="${escaped}"], [name="${escaped}"], #${escaped}`);
        if (!control) continue;
        if (item.value !== null && 'value' in control) control.value = item.value;
        if (item.checked !== null && 'checked' in control) control.checked = item.checked;
        if (item.selection && control.setSelectionRange) control.setSelectionRange(...item.selection);
      }
      const workspace = root.querySelector?.('#workspace'); if (workspace) workspace.scrollTop = state.workspaceScrollTop;
      const sidebar = root.querySelector?.('#session-groups'); if (sidebar) sidebar.scrollTop = state.sidebarScrollTop;
      const regions = [...(root.querySelectorAll?.('[data-scroll-key]') ?? [])];
      for (const saved of state.scrollRegions ?? []) {
        const region = regions.find((candidate) => candidate?.dataset?.scrollKey === saved.key);
        if (!region) continue;
        region.scrollTop = Number(saved.top) || 0;
        region.scrollLeft = Number(saved.left) || 0;
      }
      if (state.focusKey) {
        const escaped = globalThis.CSS?.escape ? CSS.escape(state.focusKey) : state.focusKey.replace(/["\\]/g, '\\$&');
        root.querySelector?.(`[data-preserve-key="${escaped}"], [data-setting-path="${escaped}"], [name="${escaped}"], #${escaped}`)?.focus?.({ preventScroll: true });
      }
      return true;
    },
    snapshot() { return Object.freeze({ routes: Object.fromEntries(lastRoute), states: Object.fromEntries([...states].map(([key, value]) => [key, structuredClone(value)])) }); }
  });
}
