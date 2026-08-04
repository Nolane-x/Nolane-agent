# Nolane Agent 5.0.0-alpha.5 Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every remaining Nolane Agent 5.0 requirement that can be implemented and independently verified in a local Linux clean-room, while preserving explicit open status for Windows/provider/external attestations.

**Architecture:** Extend the existing `src/small-model` and `src/nolane-native` boundaries instead of creating a parallel runtime. New capabilities use typed, immutable receipts, no hidden chain-of-thought, no `eval`, no shell interpolation, no direct NolaneNative imports, and authenticated bounded HTTP surfaces only where data is JSON-safe. Release truth remains requirement-ledger driven with exact source/test hashes.

**Tech Stack:** Node.js 22 ESM, built-in `node:test`, built-in `vm`, `worker_threads`, `fs`, `fetch`, deterministic JSON receipts, existing Electron/UI-v3 build, existing release matrix and clean-room packaging.

## Global Constraints

- Product identity is **Nolane Agent**; ForgeStudio is allowed only in historical migration material.
- The legacy external reference remains evidence-only and must not be imported or executed by production Nolane paths.
- No production code without a failing test first.
- No hidden chain-of-thought storage or model self-reported verification.
- Do not add npm runtime dependencies.
- Preserve the adaptive microkernel static-import budget.
- Windows 8 GB baselines, provider-real dogfooding, and independent visual attestation remain open unless run in the required environment.
- Every newly verified requirement needs exact entrypoint, exact test, SHA-256 freshness, and release-matrix replay.

---

### Task 1: Scientific small-model benchmark harness

**Files:**
- Create: `src/small-model/scientific-benchmark-harness.mjs`
- Create: `tests/small-model-scientific-benchmark.test.mjs`

**Interfaces:**
- Produces: `ScientificBenchmarkHarness.runSameFlopAblation()`, `gateQuantizationStability()`, `benchmarkOodTransfer()`, and `benchmarkSameQualityCost()`.

- [ ] Write failing tests requiring independent held-out cohorts, matched FLOP/parameter budgets, multi-seed statistics, quantization regression thresholds, OOD repository separation, total-system cost accounting, and non-claim receipts.
- [ ] Run the focused test and confirm RED because the module does not exist.
- [ ] Implement deterministic statistical receipts and explicit rejection of unmatched or contaminated cohorts.
- [ ] Run focused tests and confirm GREEN.

### Task 2: AST/codemod and SMT/Datalog adapters

**Files:**
- Create: `src/small-model/ast-codemod-engine.mjs`
- Create: `src/small-model/constraint-adapters.mjs`
- Modify: `src/small-model/symbolic-solver-compiler.mjs`
- Create: `tests/small-model-symbolic-alpha5.test.mjs`

**Interfaces:**
- Produces: bounded JavaScript import/export/identifier codemods, finite-domain SMT checks, stratified Datalog evaluation, proof receipts, and compiler adapter registration.

- [ ] Write failing tests for syntax-aware JavaScript codemods that do not alter strings/comments, reject ambiguous scopes, and preserve parse validity.
- [ ] Write failing tests for finite-domain equality/inequality constraints and positive stratified Datalog rules with bounded fixpoint iteration.
- [ ] Run tests and confirm RED.
- [ ] Implement token-aware codemods without external parsers, deterministic finite-domain solving, and safe Datalog evaluation.
- [ ] Integrate adapters into `SymbolicSolverCompiler` and run focused tests GREEN.

### Task 3: Specialist lazy loading, mmap-equivalent backing, and multi-agent distillation

**Files:**
- Modify: `src/small-model/specialist-model-fabric.mjs`
- Create: `src/small-model/multi-agent-policy-distiller.mjs`
- Create: `tests/small-model-specialist-alpha5.test.mjs`

**Interfaces:**
- Produces: `registerArtifact()`, `lazyLoad()`, `unload()`, `pressureUnload()`, artifact hash verification, read-only mapped buffers, and verified multi-agent-to-single-policy distillation.

- [ ] Write failing tests for lazy file-backed loading, hash mismatch refusal, one-generative-resident policy, pressure unload, read-only buffer copies, heterogeneous teacher evidence, disagreement preservation, held-out promotion, and rollback.
- [ ] Confirm RED.
- [ ] Implement minimal safe behavior with no model execution claims.
- [ ] Confirm GREEN.

### Task 4: Learned adaptation policy and latent memory experts

**Files:**
- Modify: `src/small-model/plasticity-plane.mjs`
- Create: `src/small-model/adaptation-policy-learner.mjs`
- Create: `src/small-model/latent-memory-router.mjs`
- Create: `tests/small-model-plasticity-alpha5.test.mjs`

**Interfaces:**
- Produces: verified contextual-bandit adaptation policy, shadow/canary promotion, abstention, expert routing, capacity/forgetting gates, and rollback receipts.

- [ ] Write failing tests for learning only from verified outcomes, held-out policy evaluation, bounded exploration, shadow promotion, negative-transfer rollback, latent expert domain routing, expert capacity limits, and abstention.
- [ ] Confirm RED.
- [ ] Implement deterministic policy and routing logic.
- [ ] Confirm GREEN.

### Task 5: Nolane-native capability replacement pack

**Files:**
- Create: `src/nolane-native/web-browser-tools.mjs`
- Create: `src/nolane-native/code-notebook-tools.mjs`
- Create: `src/nolane-native/cross-session-memory.mjs`
- Create: `src/nolane-native/terminal-ui.mjs`
- Create: `src/nolane-native/media-provider-registry.mjs`
- Create: `src/nolane-native/audio-provider-registry.mjs`
- Create: `src/nolane-native/capability-pack.mjs`
- Modify: `src/nolane-native/index.mjs`
- Create: `tests/nolane-native-capability-pack.test.mjs`

**Interfaces:**
- Produces: governed HTTP fetch/extraction, browser-driver facade, worker-isolated JS notebook cells, persistent cross-session memory with provenance/invalidation, ANSI-free TUI state rendering, media/audio provider contracts, and a single capability-pack facade.

- [ ] Write failing tests for network protocol/host allowlists, byte/time limits, untrusted content labels, notebook timeout/output limits/no host globals, memory persistence/TTL/conflict, deterministic TUI, provider capability negotiation, and no NolaneNative import.
- [ ] Confirm RED.
- [ ] Implement capabilities using built-ins and injected drivers/providers.
- [ ] Confirm GREEN.

### Task 6: Brand migration and UI quality gates

**Files:**
- Create: `src/branding/brand-migration-auditor.mjs`
- Create: `scripts/audit-current-branding.mjs`
- Create: `scripts/audit-ui-quality-alpha5.mjs`
- Create: `tests/brand-migration-alpha5.test.mjs`
- Create: `tests/ui-quality-alpha5.test.mjs`
- Modify: current onboarding/examples/screenshot metadata as identified by the audit.

**Interfaces:**
- Produces: current-surface brand audit, keyboard/focus/live-region/reduced-motion static certification, responsive CSS breakpoint certification, and machine-labelled performance-baseline schema without fabricating measurements.

- [ ] Write failing tests for current docs/UI/examples containing forbidden active ForgeStudio identity, missing Nolane screenshot metadata, inaccessible controls, missing reduced motion, and missing required breakpoints.
- [ ] Confirm RED.
- [ ] Implement auditors and repair current surfaces only; preserve historical documents via explicit allowlist.
- [ ] Confirm GREEN while leaving Windows/visual-runtime claims open.

### Task 7: Production composition and bounded HTTP/control-plane surfaces

**Files:**
- Modify: `src/small-model/foundation-service.mjs`
- Modify: `src/app.mjs`
- Modify: server routes identified by existing alpha.4 wiring
- Modify: `ui-v3/control-plane/labs/*`
- Create: `tests/alpha5-production-wiring.test.mjs`

**Interfaces:**
- Produces: lazy-created alpha.5 services, authenticated JSON-safe benchmark/solver/plasticity/native capability endpoints, and explicit non-claims.

- [ ] Write failing tests for authenticated endpoints, bounded payloads, no function/filesystem injection over HTTP, lazy service construction, Control Plane snapshots, and unchanged microkernel import budget.
- [ ] Confirm RED.
- [ ] Implement minimal production wiring.
- [ ] Confirm GREEN.

### Task 8: Acceptance ledger, documentation, and release matrix

**Files:**
- Modify: `scripts/generate-nolane-program.mjs`
- Modify: `scripts/full-release-matrix.mjs`
- Modify: `requirements/nolane-requirement-definitions.mjs` only if wording needs exact proof conditions
- Create/Modify: alpha.5 release docs and evidence scripts.

**Interfaces:**
- Produces: updated requirement registry, exact remaining-gap report, alpha.5 gate groups, release notes, limitations, verification report, and full matrix.

- [ ] Add exact evidence mappings only for requirements proven by Tasks 1–7.
- [ ] Keep Windows 8 GB, provider-real dogfood, visual runtime budgets, and Nolane runtime purity open.
- [ ] Run evidence freshness/quality and remaining-gap tests.
- [ ] Update version surfaces to `5.0.0-alpha.5` and regenerate manifests.
- [ ] Run focused cohort, full Node suite, runtime/SDK/ForgeOS lanes, and full release matrix.
- [ ] Build source, Windows, update, VSIX, change-set, evidence, checksums, and clean-room artifacts.
