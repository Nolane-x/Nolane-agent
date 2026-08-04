const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const CONTROL_ACTIONS = new Set(['pause', 'resume', 'stop', 'retry']);

function normalizedBaseUrl(value) {
  const url = new URL(String(value ?? ''));
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOOPBACK.has(url.hostname))) {
    throw new Error('Nolane Agent requires HTTPS except for loopback endpoints');
  }
  url.pathname = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
  url.search = '';
  url.hash = '';
  return url;
}

function boundedInteger(value, fallback, min, max, label) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new TypeError(`${label} must be between ${min} and ${max}`);
  return number;
}

function publicErrorDetail(payload, fallback) {
  if (payload && typeof payload === 'object') {
    const detail = payload.error ?? payload.message ?? payload.code;
    if (detail) return String(detail).slice(0, 500);
  }
  return String(fallback ?? '').slice(0, 500);
}

export class NolaneAgentRequestError extends Error {
  constructor(message, { status = null, code = null, responseSha256 = null } = {}) {
    super(message);
    this.name = 'NolaneAgentRequestError';
    this.status = status;
    this.code = code;
    this.responseSha256 = responseSha256;
  }
}

export class NolaneAgentClient {
  constructor({ baseUrl, token = '', organizationId = '', workspaceId = '', timeoutMs = 60_000, fetch = globalThis.fetch } = {}) {
    if (typeof fetch !== 'function') throw new TypeError('fetch is required');
    this.baseUrl = normalizedBaseUrl(baseUrl);
    this.token = String(token ?? '');
    this.organizationId = String(organizationId ?? '');
    this.workspaceId = String(workspaceId ?? '');
    this.timeoutMs = boundedInteger(timeoutMs, 60_000, 10, 3_600_000, 'timeoutMs');
    this.fetch = fetch;
  }

  async request(route, { method = 'GET', query = null, body = undefined, auth = true, signal = null, headers = {} } = {}) {
    const url = new URL(String(route).replace(/^\/+/, ''), this.baseUrl);
    if (query && typeof query === 'object') {
      for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
    if (auth && !this.token) throw new NolaneAgentRequestError('Nolane Agent token is not configured', { code: 'TOKEN_REQUIRED' });
    const controller = new AbortController();
    const abort = () => controller.abort(signal?.reason);
    if (signal?.aborted) abort(); else signal?.addEventListener?.('abort', abort, { once: true });
    const timer = setTimeout(() => controller.abort(new Error('request timeout')), this.timeoutMs);
    timer.unref?.();
    try {
      const response = await this.fetch(url, {
        method,
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...(auth ? { authorization: `Bearer ${this.token}` } : {}),
          ...(this.organizationId ? { 'x-nolane-organization': this.organizationId } : {}),
          ...(this.workspaceId ? { 'x-nolane-workspace': this.workspaceId } : {}),
          ...headers,
        },
        ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
      });
      const contentType = response.headers?.get?.('content-type') ?? '';
      let payload = null;
      if (response.status !== 204) {
        if (contentType.includes('json')) payload = await response.json();
        else payload = await response.text();
      }
      if (!response.ok) {
        const detail = publicErrorDetail(payload, response.statusText);
        throw new NolaneAgentRequestError(`Nolane Agent request failed (${response.status})${detail ? `: ${detail}` : ''}`, {
          status: response.status,
          code: payload && typeof payload === 'object' ? payload.code ?? payload.error ?? null : null,
        });
      }
      return payload;
    } catch (error) {
      if (error instanceof NolaneAgentRequestError) throw error;
      if (controller.signal.aborted) throw new NolaneAgentRequestError('Nolane Agent request timed out or was cancelled', { code: 'REQUEST_ABORTED' });
      throw new NolaneAgentRequestError(`Nolane Agent request failed: ${String(error?.message ?? error).slice(0, 500)}`, { code: 'NETWORK_ERROR' });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener?.('abort', abort);
    }
  }

  health() { return this.request('/health', { auth: false }); }
  listProjects() { return this.request('/api/projects'); }
  createRun(input) { return this.request('/api/agent/runs', { method: 'POST', body: input }); }
  listRuns(projectId, { limit = 30 } = {}) { return this.request('/api/agent/runs', { query: { projectId, limit: boundedInteger(limit, 30, 1, 100, 'limit') } }); }
  getRun(runId) { return this.request(`/api/agent/runs/${encodeURIComponent(String(runId))}`); }
  controlRun(runId, action) {
    const normalized = String(action);
    if (!CONTROL_ACTIONS.has(normalized)) throw new TypeError(`Unsupported run action: ${normalized}`);
    return this.request(`/api/agent/runs/${encodeURIComponent(String(runId))}/${normalized}`, { method: 'POST', body: {} });
  }
  sendMessage(runId, content) { return this.request(`/api/agent/runs/${encodeURIComponent(String(runId))}/messages`, { method: 'POST', body: { content: String(content) } }); }
  reviewRun(runId) { return this.request(`/api/agent/runs/${encodeURIComponent(String(runId))}/review`); }
  listActivities(runId) { return this.request(`/api/agent/runs/${encodeURIComponent(String(runId))}/activities`); }
  getCollaborationExperience() { return this.request('/api/collaboration-experience/snapshot'); }
  getSecurityCertification() { return this.request('/api/security-certification/snapshot'); }
  decideReviewItem(input = {}) { return this.request('/api/collaboration-experience/review/decisions', { method: 'POST', body: { itemId: String(input.itemId ?? ''), decision: String(input.decision ?? ''), receiptSha256: String(input.receiptSha256 ?? '') } }); }
  createPlaybackRewindPlan(checkpointId) { return this.request('/api/collaboration-experience/playback/rewind', { method: 'POST', body: { checkpointId: String(checkpointId ?? '') } }); }
  steerMission(input = {}) { return this.request('/api/collaboration-experience/steering', { method: 'POST', body: { missionId: String(input.missionId ?? ''), action: String(input.action ?? ''), expectedRevision: Number(input.expectedRevision ?? 0), capabilities: Array.isArray(input.capabilities) ? input.capabilities.map(String).slice(0, 100) : [], reason: String(input.reason ?? '').slice(0, 2_000), target: input.target == null ? null : String(input.target).slice(0, 2_000), evidenceReceiptSha256: String(input.evidenceReceiptSha256 ?? '') } }); }

  async paginate(route, { pageSize = 100, maxPages = 100, itemsKey = 'items', pageParam = 'page', limitParam = 'limit', query = {} } = {}) {
    const size = boundedInteger(pageSize, 100, 1, 1_000, 'pageSize');
    const pages = boundedInteger(maxPages, 100, 1, 10_000, 'maxPages');
    const items = [];
    let page = 1;
    for (let count = 0; count < pages; count += 1) {
      const payload = await this.request(route, { query: { ...query, [pageParam]: page, [limitParam]: size } });
      if (Array.isArray(payload)) { items.push(...payload); break; }
      if (!payload || !Array.isArray(payload[itemsKey])) throw new NolaneAgentRequestError(`Paginated response is missing ${itemsKey}`, { code: 'PAGINATION_SCHEMA' });
      items.push(...payload[itemsKey]);
      if (payload.nextPage === undefined || payload.nextPage === null || payload.nextPage === false) break;
      page = payload.nextPage;
      if (count === pages - 1) throw new NolaneAgentRequestError(`Pagination exceeded ${pages} pages`, { code: 'PAGINATION_LIMIT' });
    }
    return items;
  }
}
