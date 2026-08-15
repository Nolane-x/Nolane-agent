import { normalizeExperience } from './experience-policy.8c30dc615ac2.mjs';

export function createExperienceTransitionController({ api, viewStateBridge, documentRoot = () => globalThis.document } = {}) {
  if (!api?.patch) throw new TypeError('Experience transition controller requires an API client with patch()');
  if (!viewStateBridge?.capture || !viewStateBridge?.resolveDestination) throw new TypeError('Experience transition controller requires a view-state bridge');
  let pending = null;
  return Object.freeze({
    get pending() { return pending; },
    async transition({ fromExperience, toExperience, currentPath = '/' } = {}) {
      const from = normalizeExperience(fromExperience);
      const to = normalizeExperience(toExperience);
      if (pending) return pending;
      if (from === to) return Object.freeze({ ok: true, changed: false, experience: to, path: currentPath });
      viewStateBridge.capture(documentRoot(), { experience: from, path: currentPath });
      const destination = viewStateBridge.resolveDestination({ currentPath, targetExperience: to });
      pending = (async () => {
        try {
          const response = await api.patch('/api/personalization/preferences', { patch: { experience: { level: to } }, source: 'experience-switcher' });
          return Object.freeze({ ok: true, changed: true, experience: to, path: destination, preferences: response?.profile?.preferences ?? response?.result?.effective?.value ?? null });
        } catch (error) {
          return Object.freeze({ ok: false, changed: false, experience: from, path: currentPath, error: String(error?.message ?? error), status: error?.status ?? null });
        } finally { pending = null; }
      })();
      return pending;
    }
  });
}
