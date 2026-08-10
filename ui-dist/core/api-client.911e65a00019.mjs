function currentToken() {
  try { return new URL(globalThis.location?.href ?? 'http://localhost/').searchParams.get('token'); }
  catch { return null; }
}
function withToken(path, token) {
  if (!token) return path;
  const url = new URL(path, 'http://nolane.local');
  if (!url.searchParams.has('token')) url.searchParams.set('token', token);
  return `${url.pathname}${url.search}${url.hash}`;
}
export function createApiClient({ fetchImpl = globalThis.fetch, baseUrl = '', token = currentToken() } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch implementation is required');
  const request = async (method, path, body) => {
    const headers = { accept: 'application/json' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;
    const response = await fetchImpl(`${baseUrl}${withToken(path, token)}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(payload?.error ?? payload?.message ?? `HTTP ${response.status}`), { status: response.status, payload });
    return payload;
  };
  return Object.freeze({ get: (path) => request('GET', path), put: (path, body) => request('PUT', path, body), post: (path, body) => request('POST', path, body), patch: (path, body) => request('PATCH', path, body), delete: (path) => request('DELETE', path) });
}
