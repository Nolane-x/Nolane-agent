# Live Language Synchronization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep onboarding, Settings, the application shell, and cached route views on one effective interface language immediately after a language change.

**Architecture:** Continue using `cachedPreferences` and `normalizeLanguage()` as the effective locale source. During preview, preserve the current onboarding or Settings controller while expiring every other cached route; after commit, expire the full cache. Permit the non-secret `security.redactSecrets` policy field through the existing Settings API without weakening credential rejection.

**Tech Stack:** Browser-native ES modules, Node.js built-in test runner, existing Nolane UI preference and router modules.

## Global Constraints

- Do not change backend settings or onboarding payload formats.
- Do not broaden credential acceptance beyond the existing `security.redactSecrets` policy field.
- Do not introduce a second locale-resolution policy.
- Do not add dependencies or refactor unrelated UI code.
- Preserve live preview state while the user remains in onboarding or Settings.

---

### Task 1: Invalidate language-sensitive route caches

**Files:**
- Modify: `ui-v3/core/router.mjs`
- Test: `tests/ui-v3-router.test.mjs`

**Interfaces:**
- Consumes: the existing `createRouter()` route cache.
- Produces: `router.invalidate({ keepCurrent })` which can preserve the active route while clearing other cached views, or clear the full cache by default.

- [ ] **Step 1: Write the failing router-cache test**

```js
test('router invalidation reloads a cached route view', async () => {
  let loads = 0;
  const router = createRouter();
  router.register({ id: 'home', pattern: '/', load: async () => ({ language: ++loads }) });
  assert.equal((await router.navigate('/')).view.language, 1);
  assert.equal((await router.navigate('/')).view.language, 1);
  router.invalidate();
  assert.equal((await router.navigate('/')).view.language, 2);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/ui-v3-router.test.mjs`

Expected: FAIL because `router.invalidate` is not defined.

- [ ] **Step 3: Add the minimal router API**

```js
function invalidate() { cache.clear(); return api; }
const api = Object.freeze({ register, setNotFound, navigate, back, forward, invalidate, current: () => current, routes: () => Object.freeze([...routes]) });
```

- [ ] **Step 4: Run the focused router test and verify GREEN**

Run: `node --test tests/ui-v3-router.test.mjs`

Expected: all router tests pass.

### Task 2: Resolve onboarding System language through the shared i18n policy

**Files:**
- Modify: `ui-v3/views/onboarding/onboarding-view.mjs`
- Test: `tests/onboarding-ui.test.mjs`

**Interfaces:**
- Consumes: `normalizeLanguage(value)` from `ui-v3/core/i18n.mjs`.
- Produces: onboarding copy rendered in the effective browser language for `system`.

- [ ] **Step 1: Write failing English and System-language tests**

```js
test('onboarding resolves English and System language through the shared locale policy', () => {
  const english = renderOnboardingView({ status: 'ready', required: true, step: 0, answers: { language: 'en' } });
  assert.match(english, /Set up Nolane/);
  assert.doesNotMatch(english, /Thiết lập Nolane/);

  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { language: 'vi-VN' } });
  try {
    const system = renderOnboardingView({ status: 'ready', required: true, step: 0, answers: { language: 'system' } });
    assert.match(system, /Thiết lập Nolane/);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor);
    else delete globalThis.navigator;
  }
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/onboarding-ui.test.mjs`

Expected: the System-language assertion exposes the direct `a.language === 'vi'` branch instead of shared normalization when the test supplies a Vietnamese system locale.

- [ ] **Step 3: Use the shared locale resolver**

```js
import { normalizeLanguage } from '../../core/i18n.mjs';
const vi = normalizeLanguage(a.language) === 'vi';
```

- [ ] **Step 4: Run onboarding tests and verify GREEN**

Run: `node --test tests/onboarding-ui.test.mjs`

Expected: all onboarding UI tests pass.

### Task 3: Synchronize shell previews and saved route views

**Files:**
- Create: `ui-v3/core/language-sync-controller.mjs`
- Modify: `ui-v3/app.mjs`
- Test: `tests/language-sync-controller.test.mjs`

**Interfaces:**
- Consumes: preference-document, apply, rerender, reconcile, and invalidate callbacks supplied by `ui-v3/app.mjs`.
- Produces: `createLanguageSyncController()` with `preview(language, path)` and `commit(path)` methods.

- [ ] **Step 1: Add a failing behavioral controller test**

```js
test('language sync previews the shell immediately and reloads cached views after commit', async () => {
  let effective = { language: 'en' };
  let html = '';
  const root = { dataset: {}, style: { setProperty() {} } };
  const router = createRouter();
  router.register({ id: 'home', pattern: '/', load: async () => {
    const captured = effective.language;
    return { render: () => `<p>${captured}</p>` };
  } });
  const rerender = async (path) => {
    const state = await router.navigate(path);
    html = renderAppShell({ language: effective.language, content: state.view.render() });
  };
  await rerender('/');
  const controller = createLanguageSyncController({
    preferenceDocument: () => ({ general: { language: effective.language } }),
    apply: (value) => (effective = applyPreferences(value, root, null)),
    rerender,
    reconcile: async () => effective,
    invalidate: () => router.invalidate(),
  });
  await controller.preview('vi', '/');
  assert.match(html, /Cuộc trò chuyện mới/);
  assert.match(html, /<p>en<\/p>/);
  await controller.commit('/');
  assert.match(html, /<p>vi<\/p>/);
});
```

- [ ] **Step 2: Run the regression test and verify RED**

Run: `node --test tests/onboarding-ui.test.mjs tests/ui-v3-router.test.mjs`

Expected: FAIL because `createLanguageSyncController` does not exist.

- [ ] **Step 3: Implement the minimal event wiring**

Implement `createLanguageSyncController()` as a focused coordinator. `preview()` merges `general.language`, applies effective preferences, invalidates all routes except the current draft-bearing view, and rerenders. `commit()` reconciles persisted preferences, invalidates the full cache, and rerenders. Wire onboarding language choices and Settings `general.language` previews to `preview()`. Wire successful Settings save/reset to `commit()`, and invalidate once when onboarding completes.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test tests/language-sync-controller.test.mjs tests/onboarding-ui.test.mjs tests/ui-v3-router.test.mjs tests/ui-v3-resizable-shell.test.mjs`

Expected: all focused tests pass.

- [ ] **Step 5: Build and run project UI verification**

Run: `npm run build:ui-v3 && npm run verify:ui-v3-release`

Expected: exit code 0 with no UI-v3 failures.

- [ ] **Step 6: Verify the running source portal**

Reload the source portal, select English/System in onboarding, then select Vietnamese in Settings and save. Confirm the shell, current view, and revisited Home route all use the same language.

### Task 4: Remove the Settings save false-positive

**Files:**
- Modify: `src/settings/settings-service.mjs`
- Test: `tests/settings-service.test.mjs`

- [ ] **Step 1: Reproduce the failure with `security.redactSecrets` in a Settings update**
- [ ] **Step 2: Allow only that non-secret policy key through the secret-name guard**
- [ ] **Step 3: Verify `security.redactSecrets` persists while an actual `apiKey` remains rejected**

### Task 5: Remove hard-coded English from the default Vietnamese Home surface

**Files:**
- Modify: `ui-v3/core/i18n.mjs`
- Modify: `ui-v3/shell/app-shell.mjs`
- Modify: `ui-v3/views/home/home-view.mjs`
- Test: `tests/ui-v3-resizable-shell.test.mjs`
- Test: `tests/ui-v3-home.test.mjs`

- [ ] **Step 1: Reproduce the residual English route, sidebar, project, provider, objective, and intent labels**
- [ ] **Step 2: Route those labels through the effective English/Vietnamese locale**
- [ ] **Step 3: Verify a persisted Vietnamese reload renders the whole default Home surface consistently**
