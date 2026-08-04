# Forge Studio 0.4.1 Provider Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure provider onboarding, API-key providers, official CLI authentication, and run preflight so Forge never starts without a usable model.

**Architecture:** Persist secret-free provider definitions in SQLite, resolve keys from the OS vault at request time, and expose one ProviderConnectionService to app wiring and HTTP routes. Official CLI OAuth remains inside the CLI; Codex uses its documented app-server account RPCs.

**Tech Stack:** Node.js 22 ESM, node:sqlite, loopback HTTP API, Windows Credential Manager helper, Codex app-server JSONL RPC, vanilla HTML/CSS/JS.

## Global Constraints

- Never store plaintext API keys in SQLite, logs, events, provider public views, or UI state.
- Never read or reuse OAuth tokens owned by Codex, Claude, Gemini, or Antigravity.
- Do not start a mission when no provider is ready.
- Custom remote endpoints require HTTPS; HTTP is allowed only for localhost.
- All new production behavior is implemented test-first.

---

### Task 1: Persist Provider Definitions

**Files:**
- Modify: `src/storage/studio-store.mjs`
- Test: `tests/provider-connections.test.mjs`

**Interfaces:**
- Produces: `upsertProvider({id, kind, config})`, `getProviderConfig(id)`, `listProviderConfigs()`, `deleteProviderConfig(id)`.

- [ ] Write a failing test proving provider definitions persist without secret-valued fields.
- [ ] Run `node --test tests/provider-connections.test.mjs` and confirm the missing-method failure.
- [ ] Implement the four store methods with `publicMetadata` sanitization.
- [ ] Re-run the test and commit.

### Task 2: Direct API Providers

**Files:**
- Create: `src/providers/openai-responses.mjs`
- Create: `src/providers/anthropic-messages.mjs`
- Create: `src/providers/gemini-generate-content.mjs`
- Test: `tests/direct-api-providers.test.mjs`

**Interfaces:**
- Each class implements `publicView()`, `detect()`, and `complete({messages, tools, signal})`.

- [ ] Write failing normalization and secret-redaction tests for all three providers.
- [ ] Verify failures.
- [ ] Implement request construction, timeout/cancellation, tool-call normalization, usage extraction, and server-side secret resolution.
- [ ] Run tests and commit.

### Task 3: Registry and Codex Authentication

**Files:**
- Modify: `src/providers/provider-registry.mjs`
- Modify: `src/providers/codex-app-server.mjs`
- Test: `tests/provider-registry.test.mjs`
- Test: `tests/codex-app-server.test.mjs`

**Interfaces:**
- Produces: `ProviderRegistry.upsert`, `remove`, `setDetection`, fault-tolerant `detectAll`; Codex `loginStart`, `loginCancel`, `logout`.

- [ ] Add failing tests for dynamic providers, detection state, and account login RPCs.
- [ ] Verify failures.
- [ ] Implement the minimal methods without exposing credentials.
- [ ] Run tests and commit.

### Task 4: Provider Connection Service

**Files:**
- Create: `src/providers/provider-connection-service.mjs`
- Create: `src/providers/cli-auth-adapter.mjs`
- Test: `tests/provider-connections.test.mjs`

**Interfaces:**
- Produces: `load()`, `list()`, `configureApi()`, `deleteApi()`, `test()`, `startLogin()`, `cancelLogin()`, `logout()`, `readiness()`.

- [ ] Write failing tests for vault storage, reload, CLI status, Codex login, and readiness.
- [ ] Verify failures.
- [ ] Implement fixed-command CLI auth adapters and provider factory logic.
- [ ] Run tests and commit.

### Task 5: Router Readiness

**Files:**
- Modify: `src/providers/adaptive-router.mjs`
- Modify: `src/orchestration/run-coordinator.mjs`
- Test: `tests/adaptive-router.test.mjs`
- Test: `tests/run-coordinator.test.mjs`

**Interfaces:**
- Consumes provider detection fields `available`, `authenticated`, and `healthy`.
- Produces a preflight error with code `provider_setup_required` before mission creation.

- [ ] Write failing tests for unauthenticated provider exclusion and no-mission preflight.
- [ ] Verify failures.
- [ ] Implement eligibility and preflight.
- [ ] Run tests and commit.

### Task 6: HTTP Provider API

**Files:**
- Modify: `src/server/routes.mjs`
- Modify: `src/server/http-server.mjs`
- Modify: `src/app.mjs`
- Test: `tests/http-ui.test.mjs`
- Test: `tests/simple-agent-api.test.mjs`

**Interfaces:**
- Adds `/api/provider-connections`, `/configure`, `/test`, `/login`, `/login/cancel`, `/logout`, and `/readiness`.

- [ ] Write failing route and 409 preflight tests.
- [ ] Verify failures.
- [ ] Wire ProviderConnectionService and structured errors.
- [ ] Run tests and commit.

### Task 7: Connection Center UI

**Files:**
- Modify: `ui/index.html`
- Modify: `ui/app.js`
- Modify: `ui/style.css`
- Test: `tests/simple-ui.test.mjs`
- Test: `tests/simple-ui-runtime.test.mjs`
- Test: `tests/ui-accessibility.test.mjs`

**Interfaces:**
- Adds the `provider-dialog`, provider cards, connection forms, auth polling, and automatic opening on `provider_setup_required`.

- [ ] Write failing UI structure/runtime/accessibility tests.
- [ ] Verify failures.
- [ ] Implement the Obsidian-style connection center and task preflight UX.
- [ ] Run tests and commit.

### Task 8: Version, Documentation, Packaging, and Full Verification

**Files:**
- Modify: `package.json`
- Modify: `src/version.mjs`
- Modify: `README.md`
- Modify: `docs/USER-GUIDE.md`
- Create: `docs/RELEASE-0.4.1.md`
- Modify: `project-manifest.json`

**Interfaces:**
- Produces version `0.4.1` release artifacts and checksums.

- [ ] Update version and user documentation.
- [ ] Run `npm test`, ForgeOS tests, Go tests/vet, source smoke, portable smoke, hash checks, ZIP integrity, and PE checks.
- [ ] Build source, Windows portable, update payload, binaries, manifests, and SHA-256 list.
- [ ] Commit the verified release.
