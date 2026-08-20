import path from 'node:path';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);

function localRuntimeUrl(value) {
  const url = new URL(String(value ?? ''));
  if (url.protocol !== 'http:' || !LOOPBACK_HOSTS.has(url.hostname)) throw new TypeError('Source browser bootstrap requires a loopback HTTP runtime');
  return url;
}

function localRoute(value) {
  const route = new URL(String(value ?? '/'), 'http://nolane.local');
  if (route.origin !== 'http://nolane.local') throw new TypeError('Source browser route must be local');
  return route;
}

export function authenticatedSourceUiUrl({ runtimeUrl, token, route = '/' } = {}) {
  const runtime = localRuntimeUrl(runtimeUrl);
  const credential = String(token ?? '').trim();
  if (!credential) throw new TypeError('Source browser bootstrap token is required');
  const destination = localRoute(route);
  destination.searchParams.set('token', credential);
  return `${runtime.origin}/#${destination.pathname}${destination.search}`;
}

export function sourceBrowserDataDirectory({ temporaryRoot, environment = process.env } = {}) {
  const configured = String(environment?.NOLANE_AGENT_DATA_DIR ?? '').trim();
  if (configured) return configured;
  const root = String(temporaryRoot ?? '').trim();
  if (!root) throw new TypeError('Source browser temporary root is required when no data directory is configured');
  return path.join(root, 'data');
}
