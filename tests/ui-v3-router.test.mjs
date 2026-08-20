import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouter } from '../ui-v3/core/router.mjs';

test('router lazy-loads each route once and supports history navigation', async () => {
  const loaded = [];
  const router = createRouter({ initialPath: '/' });
  router.register({ id: 'home', pattern: '/', title: 'Home', load: async () => { loaded.push('home'); return { id: 'home-view' }; } });
  router.register({ id: 'missions', pattern: '/missions', title: 'Missions', load: async () => { loaded.push('missions'); return { id: 'missions-view' }; } });
  assert.equal((await router.navigate('/')).route.id, 'home');
  assert.equal((await router.navigate('/missions')).route.id, 'missions');
  assert.equal((await router.navigate('/missions')).route.id, 'missions');
  assert.deepEqual(loaded, ['home', 'missions']);
  assert.equal((await router.back()).route.id, 'home');
});

test('router uses an explicit not-found route without executing unknown loaders', async () => {
  const router = createRouter({ initialPath: '/' });
  router.register({ id: 'home', pattern: '/', title: 'Home', load: async () => ({ id: 'home-view' }) });
  router.setNotFound({ id: 'not-found', title: 'Not Found', load: async () => ({ id: 'not-found-view' }) });
  const state = await router.navigate('/missing');
  assert.equal(state.route.id, 'not-found');
  assert.equal(state.path, '/missing');
});

test('router can opt into path-scoped view caching for dynamic surfaces', async () => {
  const loaded = [];
  const router = createRouter({ initialPath: '/' });
  router.register({ id: 'control', pattern: /^\/control\/.+$/, cache: 'path', load: async ({ path }) => { loaded.push(path); return { path }; } });
  assert.equal((await router.navigate('/control/overview')).view.path, '/control/overview');
  assert.equal((await router.navigate('/control/runtime')).view.path, '/control/runtime');
  assert.equal((await router.navigate('/control/overview')).view.path, '/control/overview');
  assert.deepEqual(loaded, ['/control/overview', '/control/runtime']);
});

test('router invalidation reloads a cached route view', async () => {
  let loads = 0;
  const router = createRouter({ initialPath: '/' });
  router.register({ id: 'home', pattern: '/', load: async () => ({ revision: ++loads }) });
  assert.equal((await router.navigate('/')).view.revision, 1);
  assert.equal((await router.navigate('/')).view.revision, 1);
  router.invalidate();
  assert.equal((await router.navigate('/')).view.revision, 2);
});

test('router invalidation can preserve the current route while expiring other cached views', async () => {
  let homeLoads = 0;
  let settingsLoads = 0;
  const router = createRouter({ initialPath: '/' });
  router.register({ id: 'home', pattern: '/', load: async () => ({ revision: ++homeLoads }) });
  router.register({ id: 'settings', pattern: '/settings', load: async () => ({ revision: ++settingsLoads }) });

  assert.equal((await router.navigate('/')).view.revision, 1);
  assert.equal((await router.navigate('/settings')).view.revision, 1);
  router.invalidate({ keepCurrent: true });

  assert.equal((await router.navigate('/settings')).view.revision, 1);
  assert.equal((await router.navigate('/')).view.revision, 2);
});

test('router keeps the newest completed navigation current when an earlier lazy route resolves late', async () => {
  let releaseHome;
  const homeStarted = new Promise((resolve) => { releaseHome = resolve; });
  const router = createRouter({ initialPath: '/' });
  router.register({ id: 'home', pattern: '/', load: async () => {
    await homeStarted;
    return { id: 'home-view' };
  } });
  router.register({ id: 'settings', pattern: '/settings', load: async () => ({ id: 'settings-view' }) });

  const homeNavigation = router.navigate('/');
  await new Promise((resolve) => setImmediate(resolve));
  const settings = await router.navigate('/settings');
  assert.equal(settings.path, '/settings');
  assert.equal(router.current().path, '/settings');

  releaseHome();
  await homeNavigation;
  assert.equal(router.current().path, '/settings');
});
