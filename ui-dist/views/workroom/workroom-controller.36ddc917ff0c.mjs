export function createWorkroomController({ projectId, missionId = null, loadEditor, loadTerminal } = {}) {
  if (!projectId) throw new Error('Workroom controller requires projectId');
  if (typeof loadEditor !== 'function' || typeof loadTerminal !== 'function') throw new Error('Workroom controller requires lazy loaders');
  const modules = new Map(); let destroyed = false; let activeFile = null; let activeTerminal = null;
  const assertAlive = () => { if (destroyed) throw new Error('Workroom controller is destroyed'); };
  const load = async (kind, loader) => { assertAlive(); if (!modules.has(kind)) modules.set(kind, Promise.resolve().then(loader)); return modules.get(kind); };
  return Object.freeze({
    async openFile(path) { assertAlive(); const value = String(path ?? '').trim(); if (!value) throw new Error('File path is required'); const editor = await load('editor', loadEditor); if (typeof editor?.open !== 'function') throw new Error('Editor runtime is invalid'); await editor.open(value); activeFile = value; },
    async openTerminal(id) { assertAlive(); const value = String(id ?? '').trim(); if (!value) throw new Error('Terminal id is required'); const terminal = await load('terminal', loadTerminal); if (typeof terminal?.open !== 'function') throw new Error('Terminal runtime is invalid'); await terminal.open(value); activeTerminal = value; },
    async suspend() { if (destroyed) return; for (const promise of modules.values()) (await promise)?.suspend?.(); },
    async destroy() { if (destroyed) return; for (const promise of modules.values()) (await promise)?.destroy?.(); modules.clear(); activeFile = null; activeTerminal = null; destroyed = true; },
    snapshot() { return Object.freeze({ projectId: String(projectId), missionId: missionId ? String(missionId) : null, loaded: Object.freeze([...modules.keys()]), activeFile, activeTerminal, destroyed }); },
  });
}
