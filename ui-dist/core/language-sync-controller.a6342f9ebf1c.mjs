function waitForRenderedFrame() {
  const requestFrame = globalThis.requestAnimationFrame?.bind(globalThis);
  if (typeof requestFrame !== 'function') return Promise.resolve();
  return new Promise((resolve) => requestFrame(() => requestFrame(resolve)));
}

export function createLanguageSyncController({ preferenceDocument, apply, rerender, reconcile, invalidate, settle = waitForRenderedFrame, captureViewState, restoreViewState } = {}) {
  if (typeof preferenceDocument !== 'function' || typeof apply !== 'function') throw new TypeError('Language sync requires preference readers and writers');
  if (typeof rerender !== 'function' || typeof reconcile !== 'function' || typeof invalidate !== 'function') throw new TypeError('Language sync requires render and cache lifecycle callbacks');

  const preserveViewState = async (operation) => {
    const snapshot = typeof captureViewState === 'function' ? captureViewState() : null;
    await operation();
    await settle();
    if (snapshot && typeof restoreViewState === 'function') restoreViewState(snapshot);
  };

  return Object.freeze({
    async preview(language, path) {
      const current = preferenceDocument();
      const effective = apply({ ...current, general: { ...(current.general ?? {}), language } });
      await preserveViewState(async () => {
        invalidate({ keepCurrent: true });
        await rerender(path);
      });
      return effective;
    },
    async commit(path) {
      const effective = await reconcile();
      await preserveViewState(async () => {
        invalidate();
        await rerender(path);
      });
      return effective;
    },
  });
}
