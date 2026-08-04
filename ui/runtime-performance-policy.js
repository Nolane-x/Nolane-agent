const PROFILE_CLASSES = Object.freeze(['forge-profile-lite', 'forge-profile-balanced', 'forge-profile-performance']);
const RESOURCE_CLASSES = Object.freeze(['forge-resource-normal', 'forge-resource-pressure', 'forge-resource-brownout', 'forge-resource-emergency']);

function defaultReducedMotion() {
  return typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function defaultDeviceMemory() {
  const value = Number(globalThis.navigator?.deviceMemory);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function applyRuntimePerformancePolicy(runtime = {}, {
  root = globalThis.document?.documentElement ?? null,
  prefersReducedMotion = defaultReducedMotion(),
  deviceMemoryGiB = defaultDeviceMemory(),
} = {}) {
  const profile = String(runtime.profile?.resolved ?? runtime.profile?.requested ?? 'balanced').toLowerCase();
  const resourceState = String(runtime.resources?.state ?? 'normal').toLowerCase();
  const lowMemoryDevice = Number.isFinite(deviceMemoryGiB) && deviceMemoryGiB <= 8;
  const reducedEffects = Boolean(
    runtime.profile?.reducedEffects
    || profile === 'lite'
    || resourceState !== 'normal'
    || prefersReducedMotion
    || lowMemoryDevice
  );
  const suspendOptionalVisuals = reducedEffects || ['brownout', 'emergency'].includes(resourceState);
  const terminalFrameIntervalMs = reducedEffects ? 33 : 16;

  if (root?.classList) {
    root.classList.remove(...PROFILE_CLASSES, ...RESOURCE_CLASSES, 'forge-reduced-effects', 'forge-suspend-optional-visuals');
    root.classList.add(`forge-profile-${PROFILE_CLASSES.some((item) => item.endsWith(profile)) ? profile : 'balanced'}`);
    root.classList.add(`forge-resource-${RESOURCE_CLASSES.some((item) => item.endsWith(resourceState)) ? resourceState : 'normal'}`);
    if (reducedEffects) root.classList.add('forge-reduced-effects');
    if (suspendOptionalVisuals) root.classList.add('forge-suspend-optional-visuals');
    root.dataset.forgeProfile = profile;
    root.dataset.forgeResourceState = resourceState;
  }

  return Object.freeze({
    schema: 'nolane.agent.ui-performance-policy.v1',
    profile,
    resourceState,
    reducedEffects,
    suspendOptionalVisuals,
    terminalFrameIntervalMs,
    liveGraphAnimations: !reducedEffects,
    maxBrowserSessions: Number(runtime.resources?.policy?.maxBrowserSessions ?? 0),
    maxEditorModels: Number(runtime.resources?.policy?.maxEditorModels ?? 4),
  });
}
