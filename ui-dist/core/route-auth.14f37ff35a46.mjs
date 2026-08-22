export function routeFromHash(value = globalThis.location?.hash ?? '') {
  const raw = String(value ?? '').replace(/^#/, '') || '/';
  try {
    const url = new URL(raw, 'http://nolane.local');
    url.searchParams.delete('token');
    return `${url.pathname}${url.search}`;
  } catch { return raw; }
}

export function scrubBootstrapToken({ locationObject = globalThis.location, historyObject = globalThis.history } = {}) {
  if (!locationObject?.href || typeof historyObject?.replaceState !== 'function') return false;
  const current = new URL(locationObject.href);
  const hashRoute = routeFromHash(current.hash);
  const hashToken = new URL(String(current.hash || '#/').replace(/^#/, ''), 'http://nolane.local').searchParams.has('token');
  const pageToken = current.searchParams.has('token');
  if (!hashToken && !pageToken) return false;
  current.searchParams.delete('token');
  current.hash = `#${hashRoute}`;
  historyObject.replaceState(historyObject.state, '', `${current.pathname}${current.search}${current.hash}`);
  return true;
}
