const TYPES = /^[a-z][a-z0-9-]*$/;

export function createArtifactRegistry() {
  const definitions = new Map();
  return Object.freeze({
    register(definition) {
      const kind = String(definition?.kind ?? '').trim();
      if (!TYPES.test(kind)) throw new Error('Artifact definition requires a valid kind');
      if (!String(definition?.label ?? '').trim()) throw new Error('Artifact definition requires a label');
      if (typeof definition?.loadRenderer !== 'function') throw new Error('Artifact definition requires loadRenderer');
      if (definitions.has(kind)) throw new Error(`Duplicate artifact kind: ${kind}`);
      const value = Object.freeze({ kind, label: String(definition.label), priority: Number.isFinite(definition.priority) ? definition.priority : 100, loadRenderer: definition.loadRenderer });
      definitions.set(kind, value);
      return value;
    },
    get(kind) { return definitions.get(String(kind)) ?? null; },
    list() { return Object.freeze([...definitions.values()].sort((a, b) => a.priority - b.priority || a.kind.localeCompare(b.kind))); },
  });
}

export function createArtifactDockController({ missionId, registry } = {}) {
  if (!missionId) throw new Error('Artifact controller requires missionId');
  if (!registry?.get || !registry?.list) throw new Error('Artifact controller requires registry');
  let artifacts = [];
  let activeKind = null;
  let activeRenderer = null;
  let destroyed = false;
  const modules = new Map();

  function availableDefinitions() {
    const kinds = new Set(artifacts.map((item) => item.type));
    return registry.list().filter((definition) => kinds.has(definition.kind));
  }
  function assertAlive() { if (destroyed) throw new Error('Artifact controller is destroyed'); }
  function open(kind) {
    assertAlive();
    const definition = availableDefinitions().find((item) => item.kind === kind);
    if (!definition) throw new Error(`Artifact kind is unavailable: ${kind}`);
    return (async () => {
      if (activeRenderer && activeKind !== kind) await activeRenderer.destroy?.();
      if (!modules.has(kind)) modules.set(kind, Promise.resolve().then(() => definition.loadRenderer()));
      const module = await modules.get(kind);
      if (typeof module?.createRenderer !== 'function') throw new Error(`Artifact renderer module is invalid: ${kind}`);
      if (activeKind !== kind || !activeRenderer) activeRenderer = module.createRenderer({ missionId, kind });
      activeKind = kind;
      const value = artifacts.find((item) => item.type === kind);
      await activeRenderer.render?.(value);
      return value;
    })();
  }
  return Object.freeze({
    setArtifacts(items = []) {
      assertAlive();
      artifacts = Object.freeze(items.filter((item) => item?.id && registry.get(item.type)).map((item) => Object.freeze({ ...item, id: String(item.id), type: String(item.type) })));
      if (activeKind && !artifacts.some((item) => item.type === activeKind)) { activeRenderer?.destroy?.(); activeRenderer = null; activeKind = null; }
    },
    open,
    async suspend() { if (!destroyed) await activeRenderer?.suspend?.(); },
    async destroy() { if (destroyed) return; await activeRenderer?.destroy?.(); activeRenderer = null; activeKind = null; destroyed = true; },
    snapshot() { return Object.freeze({ missionId: String(missionId), activeKind, destroyed, tabs: Object.freeze(availableDefinitions().map(({ kind, label }) => Object.freeze({ kind, label }))), artifacts, loadedKinds: Object.freeze([...modules.keys()]) }); },
  });
}
