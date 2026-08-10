function normalizePath(value) {
  const raw = String(value || '/').trim();
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return path.length > 1 ? path.replace(/\/+$/, '') : '/';
}

function matchPattern(pattern, path) {
  if (pattern instanceof RegExp) return pattern.test(path);
  return normalizePath(pattern) === path;
}

export function createRouter({ initialPath = '/' } = {}) {
  const routes = [];
  const cache = new Map();
  const history = [normalizePath(initialPath)];
  let index = 0;
  let notFound = null;
  let current = null;

  function register(definition) {
    if (!definition?.id || !definition?.pattern || typeof definition.load !== 'function') throw new TypeError('Route requires id, pattern and load');
    if (routes.some((route) => route.id === definition.id)) throw new Error(`Duplicate route id: ${definition.id}`);
    routes.push(Object.freeze({ ...definition }));
    return api;
  }

  function setNotFound(definition) {
    if (!definition?.id || typeof definition.load !== 'function') throw new TypeError('Not-found route requires id and load');
    notFound = Object.freeze({ ...definition });
    return api;
  }

  function routeCacheKey(route, path) {
    if (typeof route.cacheKey === 'function') return `${route.id}:${route.cacheKey(path)}`;
    return route.cache === 'path' ? `${route.id}:${path}` : route.id;
  }

  async function loadRoute(route, path) {
    const key = routeCacheKey(route, path);
    if (!cache.has(key)) cache.set(key, Promise.resolve().then(() => route.load({ path, route })));
    return cache.get(key);
  }

  async function resolve(path) {
    const normalized = normalizePath(path);
    const route = routes.find((candidate) => matchPattern(candidate.pattern, normalized)) ?? notFound;
    if (!route) throw new Error(`No route matched ${normalized} and no not-found route is registered`);
    const view = await loadRoute(route, normalized);
    current = Object.freeze({ path: normalized, route, view, title: route.title ?? route.id });
    return current;
  }

  async function navigate(path, { replace = false } = {}) {
    const normalized = normalizePath(path);
    if (replace) history[index] = normalized;
    else if (history[index] !== normalized) {
      history.splice(index + 1);
      history.push(normalized);
      index = history.length - 1;
    }
    return resolve(normalized);
  }

  async function back() {
    if (index > 0) index -= 1;
    return resolve(history[index]);
  }

  async function forward() {
    if (index < history.length - 1) index += 1;
    return resolve(history[index]);
  }

  function invalidate({ keepCurrent = false } = {}) {
    if (!keepCurrent || !current) cache.clear();
    else {
      const currentKey = routeCacheKey(current.route, current.path);
      for (const key of cache.keys()) {
        if (key !== currentKey) cache.delete(key);
      }
    }
    return api;
  }

  const api = Object.freeze({ register, setNotFound, navigate, back, forward, invalidate, current: () => current, routes: () => Object.freeze([...routes]) });
  return api;
}
