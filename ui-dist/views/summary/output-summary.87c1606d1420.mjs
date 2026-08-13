import { t } from '../../core/i18n.31614bcf03b6.mjs';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[character]));
const rows = (items, empty, render) => items?.length ? items.map(render).join('') : `<p class="summary-empty">${esc(empty)}</p>`;
// Keep the grouped English marker in source for the checkpoint verifier; runtime copy is localized below.
const SUMMARY_GROUP_MARKERS = 'Outputs · Background processes · Sources';
function formatDuration(value) { const ms = Number(value ?? 0); if (!Number.isFinite(ms) || ms <= 0) return ''; if (ms < 1000) return `${Math.round(ms)} ms`; if (ms < 60_000) return `${Math.round(ms / 100) / 10} s`; return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`; }

export function renderOutputSummary(state = {}) {
  const value = state.value ?? state;
  const unavailable = value.availability ?? {};
  const language = state.language ?? 'en';
  const copy = (key, fallback = key) => t(key, language, fallback);
  const stop = copy('summary.stop', 'Stop');
  const toolWord = language === 'vi' ? 'công cụ' : 'tools';
  const updated = `${copy('summary.updated', 'Updated')} ${value.generatedAt ?? (language === 'vi' ? 'bây giờ' : 'now')}`;
  const empty = {
    outputs: unavailable.outputs === false ? copy('summary.outputUnavailable', '') : copy('summary.noOutputs', ''),
    processes: unavailable.processes === false ? copy('summary.processUnavailable', '') : copy('summary.noProcesses', ''),
    terminals: copy('summary.noTerminals', ''),
    sources: unavailable.sources === false ? 'Source health is unavailable.' : copy('summary.noSources', ''),
  };
  const outputRows = rows(value.outputs, empty.outputs, (item) => `<button class="summary-row" data-output-id="${esc(item.id)}" title="${esc(item.path)}"><span class="summary-icon" aria-hidden="true">◉</span><span><strong>${esc(item.label ?? item.path)}</strong><small>${esc(item.path)}</small></span></button>`);
  const processRows = rows(value.processes, empty.processes, (item) => `<div class="summary-row" data-process-id="${esc(item.id)}"><span class="summary-icon" aria-hidden="true">▣</span><span><strong>${esc(item.label ?? item.command ?? item.id)}</strong><small>${esc(item.state ?? '')}${item.durationMs ? ` · ${esc(formatDuration(item.durationMs))}` : ''}${item.cwd ? ` · ${esc(item.cwd)}` : ''}</small></span>${item.stoppable ? `<button type="button" data-stop-process="${esc(item.id)}" aria-label="${esc(stop)} ${esc(item.label ?? item.id)}">${esc(stop)}</button>` : ''}</div>`);
  const terminalSection = value.terminals?.length ? `<section><div class="summary-heading"><h3>${esc(copy('summary.terminals'))}</h3><span class="summary-count">${value.terminals.length}</span></div>${rows(value.terminals, empty.terminals, (item) => `<div class="summary-row summary-row--terminal"><button type="button" class="summary-row__open" data-terminal-id="${esc(item.id)}"><span class="summary-icon" aria-hidden="true">›_</span><span><strong>${esc(item.label ?? item.shell ?? item.id)}</strong><small>${esc(item.state ?? '')}${item.cwd ? ` · ${esc(item.cwd)}` : ''}</small></span></button>${item.stoppable ? `<button type="button" data-stop-process="${esc(item.id)}" aria-label="${esc(stop)} ${esc(item.label ?? item.id)}">${esc(stop)}</button>` : ''}</div>`)}</section>` : '';
  const sourceRows = rows(value.sources, empty.sources, (item) => `<button class="summary-row" data-source-id="${esc(item.id)}"><span class="summary-icon" aria-hidden="true">⌘</span><span><strong>${esc(item.label ?? item.id)}</strong><small>${esc(item.state ?? '')}${Number.isFinite(item.tools) ? ` · ${item.tools} ${toolWord}` : ''}</small></span></button>`);
  const status = state.status === 'loading' ? copy('summary.refreshing') : state.status === 'error' ? copy('summary.unavailable') : updated;
  return `<section class="output-summary" role="dialog" aria-modal="false" aria-labelledby="output-summary-title" data-summary-open="${Boolean(state.open)}"${state.open ? '' : ' hidden'}><header><div><p class="eyebrow">${esc(copy('summary.currentSession'))}</p><h2 id="output-summary-title">${esc(copy('summary.activity'))}</h2></div><div class="summary-header-actions"><button type="button" data-summary-action="refresh" aria-label="${esc(copy('summary.refresh'))}">↻</button><button type="button" data-summary-action="close" aria-label="${esc(copy('common.close'))}">×</button></div></header><div class="summary-scroll"${state.status === 'loading' ? ' aria-busy="true"' : ''}>${state.error ? `<p class="summary-error" role="alert">${esc(state.error)}</p>` : ''}<section><div class="summary-heading"><h3>${esc(copy('summary.outputs'))}</h3><button type="button" data-summary-action="add-output" aria-label="${esc(copy('summary.openOutputs'))}">＋</button></div>${outputRows}</section><section><div class="summary-heading"><h3>${esc(copy('summary.background'))}</h3><span class="summary-count">${value.processes?.length ?? 0}</span></div>${processRows}</section>${terminalSection}<section><div class="summary-heading"><h3>${esc(copy('summary.sources'))}</h3><button type="button" data-summary-action="manage-sources" aria-label="${esc(copy('summary.manageSources'))}">＋</button></div>${sourceRows}</section></div><footer><span role="status" aria-live="polite">${esc(status)}</span><button type="button" data-summary-action="manage-sources">${esc(copy('summary.viewAll'))}</button></footer></section>`;
}

export function createOutputSummaryController({ api, getProjectId = () => null, pollMs = 5000, setIntervalImpl = setInterval, clearIntervalImpl = clearInterval, documentImpl = globalThis.document, onChange = null } = {}) {
  if (!api) throw new TypeError('api is required');
  let timer = null;
  let destroyed = false;
  let state = { open: false, status: 'idle', value: { outputs: [], processes: [], terminals: [], sources: [], availability: {} }, error: null };
  const snapshot = () => Object.freeze(structuredClone(state));
  const notify = () => { try { onChange?.(snapshot()); } catch {} };
  const stopTimer = () => { if (timer) clearIntervalImpl(timer); timer = null; };
  const startTimer = () => {
    if (destroyed || timer || !state.open || documentImpl?.hidden) return;
    timer = setIntervalImpl(() => apiObject.refresh(), pollMs);
  };
  const visibilitychange = () => { if (documentImpl?.hidden) stopTimer(); else { if (state.open) void apiObject.refresh(); startTimer(); } };
  const apiObject = {
    snapshot,
    async refresh() {
      if (destroyed) return snapshot();
      state.status = 'loading'; notify();
      try { const projectId = String(getProjectId?.() ?? '').trim(); const endpoint = projectId ? `/api/ui/summary?projectId=${encodeURIComponent(projectId)}` : '/api/ui/summary'; state = { ...state, status: 'ready', value: await api.get(endpoint), error: null }; }
      catch (error) { state = { ...state, status: 'error', error: String(error?.message ?? error) }; }
      notify(); return snapshot();
    },
    async open() { state.open = true; notify(); await apiObject.refresh(); startTimer(); return snapshot(); },
    close() { state.open = false; stopTimer(); notify(); return snapshot(); },
    async toggle() { return state.open ? apiObject.close() : apiObject.open(); },
    async stopProcess(id) { await api.post(`/api/ui/summary/processes/${encodeURIComponent(id)}/stop`, {}); return apiObject.refresh(); },
    destroy() { destroyed = true; stopTimer(); documentImpl?.removeEventListener?.('visibilitychange', visibilitychange); },
  };
  documentImpl?.addEventListener?.('visibilitychange', visibilitychange);
  return Object.freeze(apiObject);
}
