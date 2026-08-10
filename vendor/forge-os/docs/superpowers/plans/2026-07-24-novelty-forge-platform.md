# Novelty Forge Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable provider-neutral creativity-to-production plugin with MCP, ChatGPT widget, A2A, thirty Agent Skills, quality gates, evidence collection, and local verification.

**Architecture:** A dependency-free Node.js Forge Core owns project state and stage gates. Thin protocol adapters expose the same operations over MCP and A2A, while a static widget renders structured tool output. Agent Skills contain the reasoning workflow; deterministic code validates and persists its outputs.

**Tech Stack:** Node.js 22 ESM, built-in `node:http`, built-in `node:test`, JSON/Markdown Agent Skills, HTML/CSS/JavaScript widget.

## Global Constraints

- No runtime dependency on a particular model provider.
- No material requirement may be guessed when user intent is absent.
- Every stage transition requires a recorded gate result.
- All external input is untrusted and size-bounded.
- No defect-free guarantee; verification reports measured evidence and residual risk.
- The runnable core must require no third-party npm package.

---

### Task 1: Domain contracts and stage machine
**Files:** Create `src/core/stages.mjs`, `src/core/contracts.mjs`; Test `tests/stages.test.mjs`, `tests/contracts.test.mjs`.
**Interfaces:** Produces `STAGES`, `nextStage(stage)`, `assertTransition(from,to)`, `validateIntent`, `validateIdea`, `validateArtifact`.
- [ ] Write tests for legal/illegal transitions and bounded validated payloads.
- [ ] Run tests and verify failure before implementation.
- [ ] Implement minimal contracts and stage functions.
- [ ] Run tests and commit.

### Task 2: Atomic project store
**Files:** Create `src/core/project-store.mjs`; Test `tests/project-store.test.mjs`.
**Interfaces:** Produces `ProjectStore.create/read/update/list/exportBundle`.
- [ ] Test atomic persistence, missing projects, invalid IDs, and traversal attempts.
- [ ] Verify failure, implement, rerun, and commit.

### Task 3: Idea scoring and semantic fingerprints
**Files:** Create `src/core/scoring.mjs`; Test `tests/scoring.test.mjs`.
**Interfaces:** Produces `fingerprintIdea`, `scoreIdea`, `clusterIdeas`, `rankIdeas`.
- [ ] Test mechanism-aware fingerprints, deterministic scoring, and duplicate clustering.
- [ ] Verify failure, implement, rerun, and commit.

### Task 4: Evidence gates
**Files:** Create `src/core/gates.mjs`; Test `tests/gates.test.mjs`.
**Interfaces:** Produces `runGate(project, stage)` and `GATE_RULES`.
- [ ] Test pass/fail/blocked results for every workflow stage.
- [ ] Verify failure, implement, rerun, and commit.

### Task 5: Orchestrator
**Files:** Create `src/core/orchestrator.mjs`; Test `tests/orchestrator.test.mjs`.
**Interfaces:** Produces `ForgeOrchestrator` methods used by all protocols.
- [ ] Test the full happy path, rejected transitions, selection, evidence, and export.
- [ ] Verify failure, implement, rerun, and commit.

### Task 6: Thirty skills and skill linter
**Files:** Create `skills/*/SKILL.md`, `src/skills/catalog.mjs`, `scripts/validate-skills.mjs`; Test `tests/skills.test.mjs`.
**Interfaces:** Produces `loadSkillCatalog`, `getSkill`, and linter CLI.
- [ ] Test count, unique names, valid frontmatter, required contracts, and root routing coverage.
- [ ] Verify failure, generate thirty focused skills, rerun, and commit.

### Task 7: MCP protocol server
**Files:** Create `src/server/mcp.mjs`; Test `tests/mcp.test.mjs`.
**Interfaces:** Produces `handleMcpRpc(request, context)` supporting initialize, tools, resources, prompts, and ping.
- [ ] Test MCP initialization, discovery, tool calls, errors, and widget resource reads.
- [ ] Verify failure, implement, rerun, and commit.

### Task 8: A2A adapter
**Files:** Create `src/server/a2a.mjs`; Test `tests/a2a.test.mjs`.
**Interfaces:** Produces `agentCard(baseUrl)` and `handleA2aRpc`.
- [ ] Test Agent Card and `message/send` task artifacts.
- [ ] Verify failure, implement, rerun, and commit.

### Task 9: Interactive dashboard
**Files:** Create `src/ui/dashboard.mjs`; Test `tests/dashboard.test.mjs`.
**Interfaces:** Produces `renderDashboardHtml(state)` with ChatGPT host bridge and standalone fallback.
- [ ] Test security escaping, stage rendering, idea cards, evidence, and tool buttons.
- [ ] Verify failure, implement, rerun, and commit.

### Task 10: HTTP composition root
**Files:** Create `src/server/http-server.mjs`; Test `tests/http-server.test.mjs`.
**Interfaces:** Produces `createHttpServer(options)` and routes `/mcp`, `/a2a`, `/dashboard`, `/health`, Agent Card.
- [ ] Test route status, content types, payload limits, and CORS.
- [ ] Verify failure, implement, rerun, and commit.

### Task 11: Platform adapters
**Files:** Create `.claude-plugin/plugin.json`, `.mcp.json`, `commands/*.md`, `agents/*.md`, `adapters/*`, `scripts/validate-adapters.mjs`; Test `tests/adapters.test.mjs`.
**Interfaces:** Produces installable Claude plugin metadata and generic setup manifests.
- [ ] Test JSON validity and required platform files.
- [ ] Verify failure, implement adapters, rerun, and commit.

### Task 12: Behavioral eval corpus
**Files:** Create `evals/cases/*.json`, `evals/README.md`, `scripts/run-behavioral-evals.mjs`; Test `tests/evals.test.mjs`.
**Interfaces:** Produces provider-neutral JSONL evaluator input and report schema.
- [ ] Test case schema, domain coverage, baseline/skill pair structure, and scoring fields.
- [ ] Verify failure, implement corpus and runner, rerun, and commit.

### Task 13: Security and randomized invariants
**Files:** Create `tests/security.test.mjs`, `tests/property.test.mjs`.
**Interfaces:** Exercises all public core and protocol boundaries.
- [ ] Add traversal, oversized payload, prototype pollution, invalid transition, HTML injection, and randomized malformed-input tests.
- [ ] Run and fix only production defects exposed by these tests.
- [ ] Commit.

### Task 14: Documentation and deployment
**Files:** Create `README.md`, `docs/architecture.md`, `docs/chatgpt-install.md`, `docs/platform-support.md`, `Dockerfile`, `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`.
**Interfaces:** Documents local run, HTTPS tunnel, ChatGPT Developer Mode, Claude plugin install, MCP/A2A integration, and release limitations.
- [ ] Write exact commands and expected endpoints.
- [ ] Run link/path validation and commit.

### Task 15: End-to-end verification and evidence
**Files:** Create `scripts/smoke-mcp.mjs`, `project-manifest.json`, generated `evidence/dashboard.png`, `evidence/verification-report.json`.
**Interfaces:** Produces downloadable repository evidence.
- [ ] Run full tests and coverage.
- [ ] Start server and run MCP/A2A smoke tests.
- [ ] Capture dashboard screenshot with headless Chromium.
- [ ] Validate skills and adapters.
- [ ] Record commands, pass counts, coverage, residual risks, and artifact hashes.
- [ ] Commit final verified state.
