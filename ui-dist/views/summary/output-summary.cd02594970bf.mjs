const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[character]);
const rows = (items, empty, render) => items?.length ? items.map(render).join('') : `<p class="summary-empty">${esc(empty)}</p>`;
function formatDuration(value) { const ms = Number(value ?? 0); if (!Number.isFinite(ms) || ms <= 0) return ''; if (ms < 1000) return `${Math.round(ms)} ms`; if (ms < 60_000) return `${Math.round(ms / 100) / 10} s`; return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`; }

export function renderOutputSummary(state = {}) {
  const value = state.value ?? state;
  const unavailable = value.availability ?? {};
  return `<section class="output-summary" role="dialog" aria-modal="false" aria-labelledby="output-summary-title" data-summary-open="${Boolean(state.open)}"${state.open ? '' : ' hidden'}><header><div><p class="eyebrow">Current session</p><h2 id="output-summary-title">Activity summary</h2></div><div class="summary-header-actions"><button type="button" data-summary-action="refresh" aria-label="Refresh summary">↻</button><button type="button" data-summary-action="close" aria-label="Close summary">×</button></div></header><div class="summary-scroll"${state.status === 'loading' ? ' aria-busy="true"' : ''}>${state.error ? `<p class="summary-error" role="alert">${esc(state.error)}</p>` : ''}<section><div class="summary-heading"><h3>Outputs</h3><button type="button" data-summary-action="add-output" aria-label="Open outputs">＋</button></div>${rows(value.outputs, unavailable.outputs === false ? 'Output tracking is unavailable.' : 'No outputs yet.', (item) => `<button class="summary-row" data-output-id="${esc(item.id)}" title="${esc(item.path)}"><span class="summary-icon" aria-hidden="true">◉</span><span><strong>${esc(item.label ?? item.path)}</strong><small>${esc(item.path)}</small></span></button>`)}</section><section><div class="summary-heading"><h3>Background processes</h3><span class="summary-count">${value.processes?.length ?? 0}</span></div>${rows(value.processes, unavailable.processes === false ? 'Process tracking is unavailable.' : 'No background processes.', (item) => `<div class="summary-row" data-process-id="${esc(item.id)}"><span class="summary-icon" aria-hidden="true">▣</span><span><strong>${esc(item.label ?? item.command ?? item.id)}</strong><small>${esc(item.state ?? '')}${item.durationMs ? ` · ${esc(formatDuration(item.durationMs))}` : ''}${item.cwd ? ` · ${esc(item.cwd)}` : ''}</small></span>${item.stoppable ? `<button type="button" data-stop-process="${esc(item.id)}" aria-label="Stop ${esc(item.label ?? item.id)}">Stop</button>` : ''}</div>`)}</section>${value.terminals?.length ? `<section><div class="summary-heading"><h3>Terminal sessions</h3><span class="summary-count">${value.terminals.length}</span></div>${rows(value.terminals, 'No terminal sessions.', (item) => `<button class="summary-row" data-terminal-id="${esc(item.id)}"><span class="summary-icon" aria-hidden="true">›_</span><span><strong>${esc(item.label ?? item.shell ?? item.id)}</strong><small>${esc(item.state ?? '')}${item.cwd ? ` · ${esc(item.cwd)}` : ''}</small></span></button>`)}</section>` : ''}<section><div class="summary-heading"><h3>Sources</h3><button type="button" data-summary-action="manage-sources" aria-label="Manage sources">＋</button></div>${rows(value.sources, unavailable.sources === false ? 'Source health is unavailable.' : 'No connected sources.', (item) => `<button class="summary-row" data-source-id="${esc(item.id)}"><span class="summary-icon" aria-hidden="true">⌘</span><span><strong>${esc(item.label ?? item.id)}</strong><small>${esc(item.state ?? '')}${Number.isFinite(item.tools) ? ` · ${item.tools} tools` : ''}</small></span></button>`)}</section></div><footer><span role="status" aria-live="polite">${esc(state.status === 'loading' ? 'Refreshing…' : state.status === 'error' ? 'Summary unavailable' : `Updated ${value.generatedAt ?? 'now'}`)}</span><button type="button" data-summary-action="manage-sources">View all sources</button></footer></section>`;
}

export function createOutputSummaryController({ api, pollMs = 5000, setIntervalImpl = setInterval, clearIntervalImpl = clearInterval, documentImpl = globalThis.document, onChange = null } = {}) {
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
      try { state = { ...state, status: 'ready', value: await api.get('/api/ui/summary'), error: null }; }
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
