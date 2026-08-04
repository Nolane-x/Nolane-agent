# Forge Studio 4.0.0 Local Frontier Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all 59 remaining partial audit statuses, directly bundle NolaneNative 2.29.0, and publish a reproducible 4.0.0 release.

**Architecture:** Add four focused completion planes plus a direct NolaneNative distribution contract. Integrate lazily into existing control planes, preserve v3.5 APIs, and certify each plane with deterministic measurements and fail-closed release gates.

**Tech Stack:** Node.js ES modules, SQLite-backed existing stores, Git worktrees, deterministic ZIP packaging, built-in crypto, Electron/VS Code existing builders, Go/Python existing SDK checks.

## Global Constraints

- No cloud dependency is required for verified items.
- The six unavailable production dependencies are classified as external gates, never simulated as production.
- NolaneNative archive SHA-256 must equal `1ac5fcb20630d6556f6169cb836dda73298b2371f7c0a6ed23bcc5d6eaf41cd9`.
- Every new learned state consumes verified outcome receipts.
- Every graph edge and benchmark result has provenance and an immutable receipt.
- Existing 3.1–3.5 release guarantees remain mandatory.

---

### Task 1: Direct NolaneNative 2.29.0 distribution

**Files:**
- Modify: `src/release/release-artifacts.mjs`
- Modify: `src/nolane_native/nolane_native-release-verifier.mjs`
- Modify: `scripts/build-portable.mjs`
- Modify: `scripts/verify-source-reconstruction.mjs`
- Create: `tests/nolane_native-direct-bundling-4.0.test.mjs`
- Add: `vendor/nolane_native-agent/nolane_native-agent-main.zip`
- Add: `vendor/nolane_native-agent/NOLANE_NATIVE-PACK.json`

**Interfaces:**
- Produces: direct archive verification receipt and required nested release entries.

- [ ] Write failing tests that require NolaneNative bytes in source, Windows, update payload, and standalone pack.
- [ ] Run the test and confirm the old carry-forward/exclusion contract fails.
- [ ] Copy and verify the supplied 2.29.0 archive and metadata.
- [ ] Replace carry-forward packaging with direct, content-addressed inclusion.
- [ ] Run NolaneNative and packaging tests.
- [ ] Commit.

### Task 2: Context and semantic completion plane

**Files:**
- Create: `src/frontier-completion/harness-bpe-tokenizer.mjs`
- Create: `src/frontier-completion/context-cache-coherence.mjs`
- Create: `src/frontier-completion/semantic-index-runtime.mjs`
- Create: `tests/local-frontier-context-semantic.test.mjs`

**Interfaces:**
- Produces: `HarnessBpeTokenizer`, `ContextCacheCoherence`, `SemanticIndexRuntime`.

- [ ] Write failing tests for exact BPE accounting, full cache-key invalidation, bounded/cancellable batches, binary vector checksums, priority retrieval, pressure unload, quarantine, and RSS budgets.
- [ ] Run the test and confirm missing modules fail.
- [ ] Implement the minimal production modules.
- [ ] Run focused and existing semantic/context tests.
- [ ] Commit.

### Task 3: Polyglot evidence completion plane

**Files:**
- Create: `src/frontier-completion/polyglot-evidence-runtime.mjs`
- Create: `tests/local-frontier-polyglot-evidence.test.mjs`

**Interfaces:**
- Produces: build/test/type/call/runtime evidence graphs and attribution receipts.

- [ ] Write failing tests for build graph, coverage graph, ambiguous call/type edges, runtime trace/exception, request/event/state/database evidence, and file/network/process attribution.
- [ ] Run the test and confirm missing module failure.
- [ ] Implement provenance-bound graph merging.
- [ ] Run focused and existing repository truth tests.
- [ ] Commit.

### Task 4: Memory, resource, and collaboration completion plane

**Files:**
- Create: `src/frontier-completion/memory-resource-collaboration-runtime.mjs`
- Create: `tests/local-frontier-memory-resource-collaboration.test.mjs`

**Interfaces:**
- Produces: governed memory actions, user memory control, causal memory, resource budgets, browser reset reuse, graph ownership, coalition budget, and coordination metrics.

- [ ] Write failing tests for all 12 acceptance items.
- [ ] Run the test and confirm missing module failure.
- [ ] Implement fail-closed services with verified receipts.
- [ ] Run focused and existing memory/resource/collaboration tests.
- [ ] Commit.

### Task 5: Browser, security, and UI completion plane

**Files:**
- Create: `src/frontier-completion/product-security-experience-runtime.mjs`
- Create: `ui/local-frontier-work-surface.js`
- Create: `ui/local-frontier-work-surface.css`
- Create: `tests/local-frontier-product-security-experience.test.mjs`

**Interfaces:**
- Produces: visual evidence/oracles/playback, failure scenarios, work-surface model, virtualization and performance-budget receipts.

- [ ] Write failing tests for all 21 browser/security/UI acceptance items.
- [ ] Run the test and confirm missing modules fail.
- [ ] Implement deterministic artifact, injection, UI-state, accessibility, and performance contracts.
- [ ] Run focused and existing browser/security/UI tests.
- [ ] Commit.

### Task 6: Benchmark completion plane

**Files:**
- Create: `src/frontier-completion/reproducible-benchmark-pack.mjs`
- Create: `benchmark/frontier/public-suite.json`
- Create: `benchmark/frontier/private-suite.enc.json`
- Create: `benchmark/frontier/repositories/*.json`
- Create: `tests/local-frontier-benchmark-pack.test.mjs`

**Interfaces:**
- Produces: contamination-locked fixture manifests, public/private suite receipts, task-category coverage, and external competitor gate report.

- [ ] Write failing tests for unseen fixture locking, realistic task categories, public/private isolation, and frontier task coverage.
- [ ] Run the test and confirm missing module failure.
- [ ] Implement fixture and suite verification.
- [ ] Run focused and existing benchmark tests.
- [ ] Commit.

### Task 7: Lazy integration and audit promotion

**Files:**
- Create: `src/frontier-completion/local-frontier-completion-plane.mjs`
- Modify: `src/decision/decision-plane.mjs`
- Modify: `scripts/audit-feature-checklist.mjs`
- Create: `scripts/measure-local-frontier-completion.mjs`
- Create: `src/release/local-frontier-completion-verifier.mjs`
- Create: `scripts/verify-local-frontier-completion.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Create: `tests/local-frontier-completion-integration.test.mjs`
- Create: `tests/local-frontier-completion-release-gate.test.mjs`

**Interfaces:**
- Produces: lazy `localFrontierCompletion()` API, deterministic measurement, audit transitions, and new required gates.

- [ ] Write failing integration and release-gate tests.
- [ ] Implement lazy lifecycle and measurement.
- [ ] Promote 53 IDs and move 6 IDs to external gate.
- [ ] Verify `partial=0` and unchanged prior statuses.
- [ ] Commit.

### Task 8: 4.0.0 release identity and certification

**Files:**
- Modify: version-bearing files and release docs.
- Create: `docs/RELEASE-4.0.0.md`
- Create: `docs/LIMITATIONS-4.0.0.md`
- Create: `docs/FEATURE-COMPLETENESS-AUDIT-4.0.0.md`
- Create: `docs/REMAINING-GAPS-4.0.0.md`

**Interfaces:**
- Produces: 4.0.0 release artifacts, full matrix, integrity report, and export checksums.

- [ ] Update identity and preserve the full prior limitations corpus.
- [ ] Regenerate all inherited measurements and project manifest.
- [ ] Run full Node suite.
- [ ] Run full release matrix on the clean release commit.
- [ ] Package source, Windows, update, VSIX, NolaneNative, change-set, and evidence.
- [ ] Verify every public checksum and archive manifest independently.
- [ ] Commit and preserve the worktree.
