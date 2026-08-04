export function createTerminalHost({ maxVisible = 2 } = {}) {
  const sessions = new Map(); const visible = [];
  function normalize() { while (visible.length > maxVisible) visible.shift(); for (const [id, session] of sessions) sessions.set(id, Object.freeze({ ...session, visible: visible.includes(id), suspended: !visible.includes(id) })); }
  return Object.freeze({
    register(value) { if (!value?.id) throw new Error('Terminal session requires id'); const id = String(value.id); sessions.set(id, Object.freeze({ ...value, id, visible: false, suspended: true })); },
    show(id) { const key = String(id); if (!sessions.has(key)) throw new Error(`Unknown terminal: ${id}`); const index = visible.indexOf(key); if (index >= 0) visible.splice(index, 1); visible.push(key); normalize(); },
    hide(id) { const index = visible.indexOf(String(id)); if (index >= 0) visible.splice(index, 1); normalize(); },
    remove(id) { sessions.delete(String(id)); const index = visible.indexOf(String(id)); if (index >= 0) visible.splice(index, 1); normalize(); },
    snapshot() { return Object.freeze({ maxVisible, visible: Object.freeze([...visible]), sessions: Object.freeze([...sessions.values()]) }); },
  });
}
