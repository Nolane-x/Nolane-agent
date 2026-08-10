# ForgeOS Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a runnable ForgeOS 0.1 repository that turns confirmed intent into a routed, evidence-gated product-development workflow across ChatGPT and other AI agents.

**Architecture:** A dependency-light Node.js ESM kernel stores typed projects and artifacts. A generated skill graph supplies 242 portable skills and machine-readable contracts. Protocol adapters expose identical operations through MCP and A2A, while Forge Studio renders structured state as a standalone page or MCP App.

**Tech Stack:** Node.js 22 ESM, built-in `node:test`, JSON Schema 2020-12 documents, HTML/CSS/JavaScript, shell validation, headless Chromium.

## Global Constraints

- License is MIT.
- Public claims must match implemented and verified behavior.
- Material user requirements cannot be guessed.
- Worker output cannot approve itself.
- Every stage transition requires evidence-backed gate output.
- No runtime model-provider dependency.
- External inputs are untrusted, bounded, and sanitized.
- Critical findings block release readiness unless explicitly accepted by the human owner.
- Skill content uses progressive disclosure and machine-readable contracts.
- The release contains 146 core skills and 96 domain skills.

---

### Task 1: Replace product identity and freeze public contracts

**Files:** Modify `package.json`; create `LICENSE`, `src/core/constants.mjs`, `schemas/*.schema.json`; test `tests/constants.test.mjs`, `tests/schemas.test.mjs`.

**Produces:** product metadata, workflow stages, assurance levels, artifact states, JSON schemas.

- [ ] Write failing tests for identity, MIT licensing, stage order, assurance levels, and schema presence.
- [ ] Run the focused tests and confirm expected failures.
- [ ] Implement constants and schemas.
- [ ] Run focused tests and commit.

### Task 2: Typed artifact graph and deterministic invalidation

**Files:** Create `src/core/artifacts.mjs`, `src/core/graph.mjs`; test `tests/artifacts.test.mjs`, `tests/graph.test.mjs`.

**Produces:** `createArtifact`, `verifyArtifact`, `supersedeArtifact`, `buildArtifactGraph`, `invalidateDownstream`.

- [ ] Write tests for hashing, provenance, supersession, cycle rejection, and downstream invalidation.
- [ ] Verify red, implement minimal behavior, verify green, commit.

### Task 3: Risk-aware skill router

**Files:** Create `src/router/router.mjs`, `src/router/utility.mjs`; test `tests/router.test.mjs`.

**Produces:** `eligibleSkills`, `scoreSkill`, `routeSkills`, `recordSkillUtility`.

- [ ] Test preconditions, domain and assurance matching, deterministic tie breaks, conflict penalties, context cost, and quarantine.
- [ ] Verify red, implement, verify green, commit.

### Task 4: Generate 242 portable skills

**Files:** Create `config/skill-definitions.mjs`, `scripts/generate-skills.mjs`, `skills/**/SKILL.md`, `skills/**/contract.json`, `src/skills/catalog.mjs`; modify `scripts/validate-skills.mjs`; test `tests/skills.test.mjs`.

**Produces:** 146 core skills, 96 domain skills, catalog and validator.

- [ ] Test exact counts, uniqueness, pack coverage, Agent Skills frontmatter, contract schema, graph connectivity, gates, handoffs, and token policy.
- [ ] Verify red.
- [ ] Implement data-driven generation with skill-specific intent, procedure, gate, output, and failure modes.
- [ ] Generate committed skill folders, validate, test, commit.

### Task 5: Upgrade project store and orchestrator

**Files:** Modify `src/core/project-store.mjs`, `src/core/orchestrator.mjs`, `src/core/gates.mjs`, `src/core/stages.mjs`; test `tests/project-store.test.mjs`, `tests/orchestrator.test.mjs`, `tests/gates.test.mjs`.

**Produces:** projects containing artifacts, decisions, skills, routes, findings, risks, evidence, and gate history.

- [ ] Add failing tests for new project shape, route selection, human confirmations, finding closure, and release readiness.
- [ ] Verify red, implement, verify green, commit.

### Task 6: MCP server and MCP Apps resource

**Files:** Create `src/server/mcp.mjs`, `src/server/tool-registry.mjs`, `src/ui/forge-studio.mjs`; test `tests/mcp.test.mjs`, `tests/dashboard.test.mjs`.

**Produces:** deterministic MCP tool list, tool calls, prompts, resources, structured content, and Forge Studio HTML.

- [ ] Test initialize, tools/list, tools/call, resources/list/read, prompts/list/get, ping, invalid params, unknown methods, annotations, output schemas, escaping, and accessibility.
- [ ] Verify red, implement, verify green, commit.

### Task 7: A2A 1.0 bridge and HTTP composition root

**Files:** Create `src/server/a2a.mjs`, `src/server/http-server.mjs`; test `tests/a2a.test.mjs`, `tests/http-server.test.mjs`.

**Produces:** Agent Card, JSON-RPC message/task handling, `/mcp`, `/a2a`, `/dashboard`, `/health`, and discovery routes.

- [ ] Test content types, payload bounds, CORS policy, agent discovery, task lifecycle, and errors.
- [ ] Verify red, implement, verify green, commit.

### Task 8: Platform adapters and compatibility TCK

**Files:** Create `.claude-plugin/`, `.mcp.json`, `adapters/*`, `commands/*`, `agents/*`, `tck/*`, `scripts/validate-adapters.mjs`; test `tests/adapters.test.mjs`, `tests/tck.test.mjs`.

**Produces:** adapter manifests and a compatibility contract for ChatGPT, Codex, Claude Code, Cursor, OpenCode, Gemini CLI, Copilot CLI, Cline, Roo Code, Windsurf, Continue, NolaneNative, OpenClaw, Pi, and generic MCP/A2A clients.

- [ ] Test required files, JSON validity, command correctness, endpoint consistency, and capability declarations.
- [ ] Verify red, implement, verify green, commit.

### Task 9: Forge Lab behavioral evaluation corpus

**Files:** Create `evals/cases/*.json`, `evals/rubrics/*.json`, `scripts/run-behavioral-evals.mjs`, `evals/README.md`; test `tests/evals.test.mjs`.

**Produces:** paired baseline/ForgeOS cases across twelve domains and a deterministic report schema.

- [ ] Test domain coverage, explicit success criteria, adversarial cases, skill utility fields, and report output.
- [ ] Verify red, implement, verify green, commit.

### Task 10: Security and property verification

**Files:** Create or modify `tests/security.test.mjs`, `tests/property.test.mjs`, `src/core/security.mjs`.

**Produces:** safe key validation, secret detection, bounded JSON parsing, confirmation policy, and randomized invariant checks.

- [ ] Add traversal, prototype pollution, oversized payload, HTML injection, secret leakage, invalid transition, and irreversible action tests.
- [ ] Verify failures expose missing behavior, implement fixes, verify green, commit.

### Task 11: Public documentation and internationalization

**Files:** Create `README.md`, localized `README.*.md`, `docs/*.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `GOVERNANCE.md`, `CHANGELOG.md`, `.github/*`, `assets/*.svg`.

**Produces:** accurate public positioning, quickstart, architecture, protocols, support matrix, contribution model, security policy, translations, and visual assets.

- [ ] Write path/link tests and translation index validation.
- [ ] Verify red, write documentation grounded in implemented behavior, verify green, commit.

### Task 12: Visual smoke test and release evidence

**Files:** Create `scripts/smoke.mjs`, `scripts/capture-dashboard.sh`, `evidence/*`, `project-manifest.json`.

**Produces:** dashboard screenshot, verification report, file hashes, residual risk list, and export manifest.

- [ ] Run full tests, coverage, skill validation, adapter validation, smoke protocols, and browser capture.
- [ ] Record exact command results and hashes.
- [ ] Create the release archive, update manifest statuses, rerun verification, commit.
