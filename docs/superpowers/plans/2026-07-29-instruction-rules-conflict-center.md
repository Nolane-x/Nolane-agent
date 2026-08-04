# Instruction Rules & Conflict Center 1.8.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a typed, trusted instruction-policy graph and a professional governance UI, then release it only after the complete matrix passes.

**Architecture:** Extend instruction discovery without breaking AgentLoop compatibility, add a policy resolver for typed scopes/imports/conflicts, expose it through authenticated API and a lazy Control Center, and add a fail-closed release verifier. All project guidance remains behind Workspace Trust.

**Tech Stack:** Node.js ESM, node:test, SQLite-backed existing services where persistence is needed, existing HTTP/router/UI/release infrastructure.

## Global Constraints

- Version target is 1.8.0.
- Do not infer typed conflicts from free-form Markdown.
- Deny path traversal, symlinks, import cycles, excessive depth, excessive bytes, and secret files.
- Never expose absolute local paths, environment, credentials, hidden reasoning, or system prompts.
- Keep existing instruction-discovery API compatible.
- Every claimed feature requires source and direct tests.
- Run the entire Full Release Matrix from gate 1 after committing a clean tree.

---

### Task 1: Typed discovery and safe imports

**Files:**
- Modify: `src/repository/instruction-discovery.mjs`
- Test: `tests/instruction-policy-service.test.mjs`

**Interfaces:**
- Produces enriched instruction records with `scope`, `languages`, `tasks`, `priority`, `rules`, `imports`, `valid`, and `issues`.

- [ ] Write failing tests for nested files, typed frontmatter, safe imports, traversal, cycles, symlinks, bounds, and invalid records.
- [ ] Run the focused test and confirm failure due to missing implementation.
- [ ] Implement bounded recursive discovery and typed parsing while preserving old fields.
- [ ] Run focused tests to green.
- [ ] Commit the independently testable reader changes.

### Task 2: Policy resolution graph

**Files:**
- Create: `src/repository/instruction-policy-service.mjs`
- Test: `tests/instruction-policy-service.test.mjs`

**Interfaces:**
- Produces `resolve({workspaceRoot, projectId, principalId, paths, language, taskType, includeWorkflows})` returning selected records, effective rules, conflicts, invalid records, precedence nodes/edges, omissions, and receipt.

- [ ] Add failing precedence, inheritance, conflict, and deterministic receipt tests.
- [ ] Implement selection and resolution with exact precedence tuples.
- [ ] Verify focused tests pass and legacy instruction tests remain green.
- [ ] Commit service changes.

### Task 3: Trust-aware runtime, API, and AgentLoop wiring

**Files:**
- Modify: `src/security/workspace-trust-gates.mjs`
- Modify: `src/app.mjs`
- Modify: `src/server/http-server.mjs`
- Modify: `src/server/routes.mjs`
- Test: `tests/instruction-policy-http-api.test.mjs`
- Test: `tests/instruction-policy-app-wiring.test.mjs`

**Interfaces:**
- Produces authenticated GET `/api/instruction-policy` and POST `/api/instruction-policy/refresh`.
- AgentLoop receives selected guidance plus compact effective-rule/conflict metadata.

- [ ] Write failing API, trust, and app-wiring tests.
- [ ] Implement trust-aware policy wrapper and server-side allowlisting.
- [ ] Wire policy resolution into app bootstrap and AgentLoop context.
- [ ] Run focused and AgentLoop regressions.
- [ ] Commit runtime/API changes.

### Task 4: Instruction Governance Center UI

**Files:**
- Create: `ui/instruction-governance-center.js`
- Create: `ui/instruction-governance-center.css`
- Modify: `ui/app.js`
- Modify: `ui/index.html`
- Test: `tests/instruction-governance-center-ui.test.mjs`

**Interfaces:**
- Produces a lazy-loaded, read-only Center with effective rules, precedence, conflicts, invalid records, sources, imports, filters, and refresh.

- [ ] Write failing UI semantics and lazy-loading tests.
- [ ] Implement the futuristic Center using existing registry patterns.
- [ ] Verify accessibility, reduced motion, and no sensitive fields.
- [ ] Run UI/performance regressions.
- [ ] Commit UI changes.

### Task 5: Release gate, audit, gaps, and 1.8.0 artifacts

**Files:**
- Create: `src/release/instruction-policy-verifier.mjs`
- Create: `scripts/verify-instruction-policy.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Modify: `scripts/generate-feature-audit.mjs`
- Modify: release identity, docs, tests, and manifests for 1.8.0.
- Test: `tests/instruction-policy-release-gate.test.mjs`
- Test: `tests/full-release-matrix.test.mjs`
- Test: `tests/feature-audit.test.mjs`

**Interfaces:**
- Adds required matrix gate `instruction-policy-governance`.
- Raises exactly the ten section-12 partial items to verified when direct evidence exists.
- Regenerates exhaustive Remaining Gaps Report for every non-verified item.

- [ ] Write failing release/audit tests.
- [ ] Implement verifier and matrix gate.
- [ ] Bump every public surface to 1.8.0 and regenerate audit/gaps/manifest.
- [ ] Run all Node tests and pre-release checks.
- [ ] Commit a clean release tree.
- [ ] Run the full release matrix from gate 1; on any failure, fix root cause and rerun the entire matrix.
- [ ] Independently verify report receipts, checksums, archive contents, source reconstruction, and Git cleanliness.
