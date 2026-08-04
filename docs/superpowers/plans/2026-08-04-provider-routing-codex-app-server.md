# Provider Routing and Codex App Server Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the home composer route all built-in provider selections to the correct provider and make Codex App Server thread creation work with the installed Codex CLI wire schema.

**Architecture:** Keep model-profile labels for display, but submit the registered provider ID for planner selection. Add a narrow compatibility resolver in the adaptive router for legacy `provider/model` keys. Normalize Codex sandbox policy once at the App Server adapter boundary so every thread/session path emits the current `read-only` enum.

**Tech Stack:** Node.js ESM, Node test runner, existing Nolane provider registry/router, UI v3 home composer.

## Global Constraints

- Preserve all unrelated dirty-worktree changes.
- Do not add providers, credentials, API wire formats, or no-project submission behavior.
- Keep credentials, raw provider output, and model responses out of diagnostics.
- Every production change must have a test that failed before the implementation.
- Missing optional CLIs remain unavailable; they must not be reported as passing.

---

### Task 1: Submit provider IDs from the home composer

**Files:**
- Modify: `ui-v3/views/home/home-view.mjs:45` model option construction.
- Test: `tests/ui-v3-home.test.mjs`.

**Interfaces:**
- Consumes: model profile records containing `key`, `providerId`, `modelId`, and `displayName`.
- Produces: explicit `<option>` values equal to registered provider IDs; `auto` remains `auto`.

- [ ] **Step 1: Write the failing test**

Add a test that renders the home composer with profiles for `codex`, `claude`,
`gemini`, `opencode`, and `codex-app-server`, each using a key such as
`codex/cli-selected`, and asserts the generated options contain
`value="codex"`, `value="claude"`, `value="gemini"`,
`value="opencode"`, and `value="codex-app-server"`, with no
`value="codex/cli-selected"`.

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
node --test tests/ui-v3-home.test.mjs
```

Expected: the new provider-option assertion fails because the current code
uses each profile's `key` as the option value.

- [ ] **Step 3: Implement the minimal mapping**

Change the home composer option value selection to prefer `item.providerId`,
then fall back to an existing ID/key only for profiles that lack a provider
ID. Keep the visible label unchanged.

- [ ] **Step 4: Run the focused test and verify it passes**

Run the same command and expect all tests in `tests/ui-v3-home.test.mjs` to
pass.

- [ ] **Step 5: Commit the focused change**

```powershell
git add ui-v3/views/home/home-view.mjs tests/ui-v3-home.test.mjs
git -c user.name="Codex" -c user.email="codex@local" commit -m "fix: submit provider ids from home composer"
```

### Task 2: Resolve legacy model-profile keys in the router

**Files:**
- Modify: `src/providers/adaptive-router.mjs:56-66`.
- Test: `tests/adaptive-router.test.mjs`.

**Interfaces:**
- Consumes: explicit `providerId` values passed to `AdaptiveProviderRouter.select`.
- Produces: the registered provider for either `codex` or a registered model
  key such as `codex/cli-selected`; unknown values still fail closed.

- [ ] **Step 1: Write the failing tests**

Add tests using the existing provider registry that assert
`router.select({ providerId: 'codex/cli-selected' })` returns the registered
`codex` provider and that `router.select({ providerId: 'missing/model' })`
throws an unknown-provider error.

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
node --test tests/adaptive-router.test.mjs
```

Expected: the legacy-key test fails with `Unknown provider:
codex/cli-selected` before the resolver exists.

- [ ] **Step 3: Implement the narrow resolver**

Before explicit provider lookup, accept an exact registered provider ID. If
the value contains `/`, inspect only the prefix before the first slash and
use it only when that prefix is registered. Pass all other values through to
the existing `registry.get` error path.

- [ ] **Step 4: Run the focused test and verify it passes**

Run the same command and expect all router tests to pass.

- [ ] **Step 5: Commit the focused change**

```powershell
git add src/providers/adaptive-router.mjs tests/adaptive-router.test.mjs
git -c user.name="Codex" -c user.email="codex@local" commit -m "fix: resolve legacy provider model keys"
```

### Task 3: Normalize Codex App Server sandbox policy

**Files:**
- Modify: `src/providers/codex-app-server.mjs:70-124`.
- Modify: `tests/fixtures/codex-app-server.mjs` to reject non-wire-compatible read-only values.
- Test: `tests/codex-app-server.test.mjs`.

**Interfaces:**
- Consumes: optional sandbox policies from `startThread` and `startTurn`,
  including legacy `{ type: 'readOnly' }`.
- Produces: Codex App Server JSON-RPC params with `{ type: 'read-only' }`
  for all read-only thread/session paths.

- [ ] **Step 1: Write the failing fixture assertion and test**

Make the fixture return a JSON-RPC error from `thread/start` unless the
sandbox type is `read-only`. Keep the existing test's explicit
`{ type: 'readOnly' }` input and add an assertion that `complete()` also
passes through the normalized policy.

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
node --test tests/codex-app-server.test.mjs
```

Expected: the fixture rejects the current camel-case sandbox value.

- [ ] **Step 3: Implement centralized normalization**

Add a small adapter-local normalizer that defaults missing policy to
`{ type: 'read-only' }` and maps only `readOnly` to `read-only`. Use it in
`startThread` and `startTurn`; use the hyphenated default in `openSession` and
`complete`.

- [ ] **Step 4: Run the focused test and verify it passes**

Run the same command and expect all Codex App Server tests to pass.

- [ ] **Step 5: Commit the focused change**

```powershell
git add src/providers/codex-app-server.mjs tests/codex-app-server.test.mjs tests/fixtures/codex-app-server.mjs
git -c user.name="Codex" -c user.email="codex@local" commit -m "fix: normalize codex app server sandbox policy"
```

### Task 4: Integrated verification and live smoke

**Files:**
- Inspect only: changed source and tests from Tasks 1–3.
- No new production files.

**Interfaces:**
- Consumes: the corrected composer, router, and App Server adapter.
- Produces: fresh test evidence and a bounded local provider smoke result.

- [ ] **Step 1: Run focused regression tests**

```powershell
node --test tests/ui-v3-home.test.mjs tests/adaptive-router.test.mjs tests/codex-app-server.test.mjs
```

- [ ] **Step 2: Run provider and HTTP routing suites**

```powershell
node --test tests/provider-registry.test.mjs tests/http-ui.test.mjs
```

- [ ] **Step 3: Run the full Node suite**

```powershell
npm test
```

- [ ] **Step 4: Smoke the installed Codex CLI and App Server**

Run the existing Codex CLI status and a read-only `codex exec` check. Then
start a real `CodexAppServerClient` and call `startThread` with the current
provider sandbox; record only success or the bounded error message. Do not
print tokens, account identifiers, or raw model output.

- [ ] **Step 5: Inspect the final diff and preserve unrelated changes**

```powershell
git diff --check
git status --short
```

Confirm only the requested source/tests/plan changes are staged or committed;
leave pre-existing UI and generated-asset changes untouched.
