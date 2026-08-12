export function createEditorHost({ loader, maxModels = 4, onLoad = () => {} } = {}) {
  if (typeof loader !== 'function') throw new Error('Editor host requires loader');
  const models = new Map(); let runtimePromise = null; let activePath = null;
  async function ensureRuntime() { if (!runtimePromise) runtimePromise = Promise.resolve().then(loader).then((runtime) => { onLoad(runtime); return runtime; }); return runtimePromise; }
  return Object.freeze({
    async open({ path, content = '', language = 'plaintext' } = {}) { const value = String(path ?? '').trim(); if (!value) throw new Error('Editor model requires path'); await ensureRuntime(); if (!models.has(value) && models.size >= maxModels) models.delete(models.keys().next().value); models.set(value, Object.freeze({ path: value, content: String(content), language: String(language), dirty: false })); activePath = value; return models.get(value); },
    update(path, content) { const model = models.get(String(path)); if (!model) throw new Error(`Unknown editor model: ${path}`); models.set(String(path), Object.freeze({ ...model, content: String(content), dirty: true })); },
    close(path) { models.delete(String(path)); if (activePath === path) activePath = [...models.keys()].at(-1) ?? null; },
    snapshot() { return Object.freeze({ loaded: Boolean(runtimePromise), activePath, models: Object.freeze([...models.values()]), maxModels }); },
  });
}
