export function createRuntimeView({ poll = () => {}, browserSessions = [] } = {}) {
  let active = false; let ticks = 0;
  const sessions = new Map(browserSessions.map((item) => [String(item.id), { ...item, id: String(item.id), suspended: true }]));
  return Object.freeze({
    activate() { active = true; for (const item of sessions.values()) item.suspended = false; },
    suspend() { active = false; for (const item of sessions.values()) item.suspended = true; },
    tick() { if (!active) return false; poll(); ticks += 1; return true; },
    upsertBrowserSession(item) { if (!item?.id) throw new Error('Browser session requires id'); sessions.set(String(item.id), { ...item, id: String(item.id), suspended: !active }); },
    snapshot() { return Object.freeze({ active, ticks, browserSessions: Object.freeze([...sessions.values()].map((item) => Object.freeze({ ...item }))) }); },
  });
}
export function renderRuntimeView(value) { return `<section><h1>Runtime</h1><p>${value.active ? 'Active' : 'Suspended'} · ${value.browserSessions.length} browser sessions</p></section>`; }
