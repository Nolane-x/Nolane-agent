import { t } from '../../core/i18n.73ff364941c3.mjs';
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
export function renderRuntimeView(value, { language = 'en' } = {}) { return `<section><h1>${t('control.domain.runtime', language)}</h1><p>${value.active ? t('control.runtimeActive', language) : t('control.runtimeSuspended', language)} · ${value.browserSessions.length} ${t('control.browserSessions', language)}</p></section>`; }
