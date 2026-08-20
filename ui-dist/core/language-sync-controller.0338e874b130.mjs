function waitForRenderedFrame() {
  const requestFrame = globalThis.requestAnimationFrame?.bind(globalThis);
  if (typeof requestFrame !== 'function') return Promise.resolve();
  return new Promise((resolve) => requestFrame(() => requestFrame(resolve)));
}

export function createLanguageSyncController({ preferenceDocument, apply, rerender, reconcile, invalidate, getRenderIntent, settle = waitForRenderedFrame, captureViewState, restoreViewState } = {}) {
  if (typeof preferenceDocument !== 'function' || typeof apply !== 'function') throw new TypeError('Language sync requires preference readers and writers');
  if (typeof rerender !== 'function' || typeof reconcile !== 'function' || typeof invalidate !== 'function') throw new TypeError('Language sync requires render and cache lifecycle callbacks');

  const preserveViewState = async (operation) => {
    const snapshot = typeof captureViewState === 'function' ? captureViewState() : null;
    const rendered = await operation();
    if (rendered === false) return false;
    await settle();
    if (snapshot && typeof restoreViewState === 'function') restoreViewState(snapshot);
    return true;
  };

  let previewIntent = null;
  const renderOptions = (options) => {
    const intent = options?.intent ?? previewIntent ?? getRenderIntent?.();
    return intent == null ? options : { ...options, intent };
  };

  return Object.freeze({
    async preview(language, path, options) {
      const current = preferenceDocument();
      const effective = apply({ ...current, general: { ...(current.general ?? {}), language } });
      const rerenderOptions = renderOptions(options);
      previewIntent = rerenderOptions?.intent ?? null;
      await preserveViewState(async () => {
        invalidate({ keepCurrent: true });
        return rerender(path, rerenderOptions);
      });
      return effective;
    },
    async commit(path, options) {
      const rerenderOptions = renderOptions(options);
      try {
        const effective = await reconcile();
        await preserveViewState(async () => {
          invalidate();
          return rerender(path, rerenderOptions);
        });
        return effective;
      } finally {
        previewIntent = null;
      }
    },
  });
}
