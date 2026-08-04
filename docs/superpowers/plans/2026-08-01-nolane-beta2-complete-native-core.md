# Nolane Agent 5.0.0-beta.2 Complete Native Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an evidence-driven clean-room parity system that inventories the complete NolaneNative core, creates one canonical acceptance ledger, implements missing Nolane-native behavior, and verifies every accepted contract through production paths.

**Architecture:** A deterministic upstream inventory generator classifies every NolaneNative source path into core behavioral contracts or explicit non-core exclusions. A Nolane-owned core contract catalog maps contracts to production entrypoints and tests. A master ledger deduplicates legacy 1,150, Nolane V5 198, generated core contracts, release gates, and external certifications. Existing Nolane modules are reused when they satisfy contracts; missing behavior is implemented in focused native modules and exposed through the shared runtime.

**Tech Stack:** Node.js 22+, ESM, Electron 43, SQLite-backed stores, Node test runner, JSON/JSONL ledgers, Ed25519/SHA-256 evidence, existing Nolane HTTP/Electron/TUI runtime, GitHub Actions Windows release pipeline.

## Global Constraints

- Never copy, rename, embed, or claim ownership of NolaneNative/Nous Research source code.
- Use upstream source only to derive public behavior contracts, schemas, command inventories, and test intent.
- Production packages must contain no executable NolaneNative source or archive.
- A file-existence check is never sufficient evidence for a capability.
- Every verified contract requires a production entrypoint, direct test, negative test, and fresh SHA-256 evidence.
- External integrations remain external gates until exercised with real credentials or independent runtime evidence.
- Preserve MIT attribution and immutable historical provenance.
- Do not weaken the 160-static-import microkernel budget.
- Do not claim complete parity or superiority while any core contract remains open.
- Every implementation task follows RED → GREEN → regression → commit.

---

### Task 1: Truth reset and NolaneNative inventory generator

**Files:**
- Create: `src/native-core/nolane-native-domain-classifier.mjs`
- Create: `src/native-core/nolane_native-inventory-schema.mjs`
- Create: `scripts/generate-nolane-native-core-inventory.mjs`
- Create: `tests/nolane-native-core-inventory.test.mjs`
- Create: `requirements/nolane-native-core-classification-rules.json`
- Create: `docs/NOLANE-NATIVE-CORE-AUDIT.md`

**Interfaces:**
- Produces: `generateNolaneNativeCoreInventory({ upstreamRoot, historicalLedgerPath, outputPath }): Promise<NolaneNativeCoreInventory>`.
- Inventory fields: `schemaVersion`, `sourceSnapshot`, `domains`, `contracts`, `entries`, `unmappedCorePaths`, `excludedPaths`, `receiptSha256`.

- [ ] Write failing tests for deterministic classification, no unmapped source modules, explicit exclusion reasons, path normalization, and source snapshot hashing.
- [ ] Run `node --test tests/nolane-native-core-inventory.test.mjs` and verify RED.
- [ ] Implement schema validation, domain rules, deterministic file hashing, and inventory generation.
- [ ] Generate the audit report from the extracted upstream snapshot and historical ledger.
- [ ] Run tests twice and assert byte-identical inventory output.
- [ ] Commit `feat(native-core): inventory complete upstream behavior surface`.

### Task 2: Master Acceptance Ledger

**Files:**
- Create: `src/requirements/master-ledger.mjs`
- Create: `scripts/generate-master-acceptance-ledger.mjs`
- Create: `tests/master-acceptance-ledger.test.mjs`
- Create: `requirements/master-acceptance-ledger.json`
- Create: `docs/MASTER-ACCEPTANCE-LEDGER.md`

**Interfaces:**
- Produces: `generateMasterLedger({ legacyAudit, nolaneV5, nolane_nativeInventory, releaseMatrix }): MasterAcceptanceLedger`.
- Canonical statuses: `verified`, `external_gate`, `implemented_not_wired`, `not_implemented`, `unmapped`.

- [ ] Write failing tests for deterministic deduplication, alias retention, status precedence, evidence freshness, and no double-counting.
- [ ] Implement canonical-key normalization and explicit crosswalk rules.
- [ ] Reject verified status without source, test, production entrypoint, and fresh hashes.
- [ ] Generate summary counts by domain and source ledger.
- [ ] Run ledger tests and evidence-quality checks.
- [ ] Commit `feat(requirements): add canonical master acceptance ledger`.

### Task 3: Nolane Native Core Contract Catalog

**Files:**
- Create: `src/native-core/core-contract-catalog.mjs`
- Create: `src/native-core/core-conformance-verifier.mjs`
- Create: `tests/native-core-contract-catalog.test.mjs`
- Create: `requirements/nolane-native-core-contracts.json`

**Interfaces:**
- Produces: `verifyCoreContracts({ rootDirectory, catalog }): Promise<CoreConformanceReceipt>`.
- Every contract defines `id`, `domain`, `behavior`, `entrypoints`, `tests`, `productionWiring`, `negativeTests`, `externalGate`.

- [ ] Write failing tests that reject file-only evidence, missing production wiring, stale hashes, and duplicate contract IDs.
- [ ] Map existing Nolane services to generated behavioral contracts.
- [ ] Emit open contracts for unmapped behavior instead of auto-verifying them.
- [ ] Run catalog verification and snapshot the first parity baseline.
- [ ] Commit `feat(native-core): add behavior-level conformance catalog`.

### Task 4: Shared agent runtime kernel completion

**Files:**
- Create: `src/native-core/turn-state-machine.mjs`
- Create: `src/native-core/runtime-receipt-ledger.mjs`
- Create: `src/native-core/cancellation-tree.mjs`
- Create: `tests/native-core-runtime-kernel.test.mjs`
- Modify: `src/nolane-native/agent-loop.mjs`
- Modify: `src/nolane-native/runtime-service.mjs`

**Interfaces:**
- Produces bounded states `created`, `planning`, `model`, `tool`, `verifying`, `completed`, `cancelled`, `failed`.
- Produces immutable receipt events with monotonic sequence numbers and SHA-256 chain.

- [ ] Write failing tests for valid transitions, invalid transition rejection, cancellation propagation, retry budgets, tool-loop ceilings, and crash recovery.
- [ ] Implement the state machine, cancellation tree, and receipt chain.
- [ ] Wire the shared kernel into the production agent loop without adding static imports to `src/app.mjs`.
- [ ] Run old agent/runtime tests plus the new conformance suite.
- [ ] Commit `feat(native-core): complete shared turn lifecycle kernel`.

### Task 5: Context and provider fabric completion

**Files:**
- Create: `src/native-core/prompt-tier-assembler.mjs`
- Create: `src/native-core/provider-fallback-fabric.mjs`
- Create: `tests/native-core-context-provider.test.mjs`
- Modify: `src/agent/context-builder.mjs`
- Modify: `src/nolane-native/provider-registry.mjs`

**Interfaces:**
- Prompt tiers: `stable`, `workspace`, `turn` with explicit cache boundaries and lineage hashes.
- Provider fallback returns typed attempts, rate-limit classification, credential reference IDs, usage, and final selection.

- [ ] Write failing tests for tier ordering, cache boundary stability, injection quarantine, secret removal, token budget, provider aliases, fallback, rate-limit rotation, and usage accounting.
- [ ] Implement deterministic prompt assembly and provider fallback policy.
- [ ] Wire existing provider adapters through the fabric.
- [ ] Run provider, context, security, and production-route tests.
- [ ] Commit `feat(native-core): complete context and provider fabric`.

### Task 6: Tool and execution fabric completion

**Files:**
- Create: `src/native-core/tool-execution-fabric.mjs`
- Create: `src/native-core/execution-backend-registry.mjs`
- Create: `tests/native-core-tool-execution.test.mjs`
- Modify: `src/nolane-native/tool-registry.mjs`
- Modify: `src/execution/tool-broker.mjs`

**Interfaces:**
- Backends: local process, PTY, container, SSH contract, Windows job contract.
- Result envelope: `status`, `stdout`, `stderr`, `exitCode`, `durationMs`, `resourceReceipt`, `approvalReceipt`, `errorClass`.

- [ ] Write failing tests for schema discovery, policy overlays, timeout, cancellation, process cleanup, approval, result normalization, and unavailable-backend errors.
- [ ] Implement backend registry and bounded execution envelope.
- [ ] Wire existing local, PTY, container, and platform drivers.
- [ ] Run execution, sandbox, terminal, and security regression tests.
- [ ] Commit `feat(native-core): unify tool and execution backends`.

### Task 7: Session, memory, and learning completion

**Files:**
- Create: `src/native-core/session-memory-learning-fabric.mjs`
- Create: `tests/native-core-state-learning.test.mjs`
- Modify: `src/nolane-native/session-store.mjs`
- Modify: `src/nolane-native/cross-session-memory.mjs`
- Modify: `src/nolane-native/skill-registry.mjs`

**Interfaces:**
- Supports restart persistence, lineage, search, profile scope, TTL, bounded consolidation, skill grading, pruning, versioning, and rollback.

- [ ] Write failing tests for restart, concurrent version conflicts, lineage, FTS/search behavior, profile isolation, bounded memory, verified-only learning, skill rollback, and self-report rejection.
- [ ] Implement orchestration facade over existing state, memory, and skill services.
- [ ] Wire into the shared runtime and Control Plane snapshot.
- [ ] Run persistence and learning regression tests.
- [ ] Commit `feat(native-core): complete persistent learning fabric`.

### Task 8: Plugin, MCP, scheduler, and multi-agent completion

**Files:**
- Create: `src/native-core/extension-automation-fabric.mjs`
- Create: `tests/native-core-extension-automation.test.mjs`
- Modify: `src/nolane-native/plugin-host.mjs`
- Modify: `src/nolane-native/durable-scheduler.mjs`
- Modify: `src/nolane-native/subagent-manager.mjs`

**Interfaces:**
- Plugin capabilities: tools, hooks, providers, commands.
- MCP transports: stdio and streamable HTTP.
- Worker lifecycle: lease, heartbeat, claim TTL, retry fingerprint, verifier, synthesizer, stale recovery.

- [ ] Write failing tests for signed manifests, transparency logs, hot disable, MCP reconnect/filtering, durable schedules, worker leases, duplicate prevention, and stale recovery.
- [ ] Implement a common extension/automation facade over existing services.
- [ ] Wire through runtime and HTTP APIs with bounded JSON inputs.
- [ ] Run plugin, MCP, automation, collaboration, and subagent tests.
- [ ] Commit `feat(native-core): complete extensions and durable automation`.

### Task 9: Gateway, ACP/API, media, and product-surface completion

**Files:**
- Create: `src/native-core/gateway-api-surface.mjs`
- Create: `tests/native-core-gateway-api.test.mjs`
- Modify: `src/nolane-native/gateway-registry.mjs`
- Modify: `src/server/routes.mjs`
- Modify: `desktop/main.cjs`

**Interfaces:**
- Unified gateway event schema, authorization, pairing, delivery queue, idempotency, attachments, session routing.
- ACP/OpenAI-compatible streaming adapters consume the same runtime events.

- [ ] Write failing tests for gateway registration, auth, pairing, retries, duplicate delivery, attachments, streaming order, approvals, diffs, terminal events, and media credential redaction.
- [ ] Implement the unified gateway/API surface and adapters.
- [ ] Verify Electron, HTTP, and TUI consume the same runtime snapshot and receipts.
- [ ] Run gateway, server, Electron, media, and TUI tests.
- [ ] Commit `feat(native-core): unify gateways APIs and product surfaces`.

### Task 10: Security, observability, backup, and recovery completion

**Files:**
- Create: `src/native-core/operations-security-fabric.mjs`
- Create: `tests/native-core-operations-security.test.mjs`
- Modify: `src/security/audit-hash-chain.mjs`
- Modify: `src/runtime/local-device-doctor.mjs`

**Interfaces:**
- Produces health, cost, usage, trace, redaction, egress, provenance, backup, restore, and tamper receipts.

- [ ] Write failing tests for secret scopes, egress allowlists, redaction, symlink escape, dependency provenance, backup/restore, tamper detection, and recovery after partial writes.
- [ ] Implement the operations/security facade using existing hardened services.
- [ ] Wire diagnostics into Control Plane and release evidence.
- [ ] Run security/adversarial and recovery regression tests.
- [ ] Commit `feat(native-core): complete security and operations fabric`.

### Task 11: Beta.2 acceptance and release matrix

**Files:**
- Create: `src/release/nolane-native-core-inventory-verifier.mjs`
- Create: `src/release/master-ledger-verifier.mjs`
- Create: `src/release/native-core-parity-verifier.mjs`
- Create: `tests/nolane-beta2-release-gates.test.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Modify: `scripts/generate-nolane-program.mjs`

**Interfaces:**
- New release gates: inventory, master ledger, contract catalog, runtime kernel, context/provider, tool/execution, state/learning, extension/automation, gateway/API, security/operations.

- [ ] Write failing tests for the new gate list and claim lock.
- [ ] Add gates without weakening any beta.1 gate.
- [ ] Ensure open/external contracts remain visible in release docs.
- [ ] Run targeted release-gate tests.
- [ ] Commit `test(release): add native core parity gates`.

### Task 12: Version, documentation, full verification, and packaging

**Files:**
- Modify: `package.json`, version surfaces, and active release docs.
- Create: `docs/RELEASE-5.0.0-beta.2.md`
- Create: `docs/LIMITATIONS-5.0.0-beta.2.md`
- Create: `docs/NOLANE-AGENT-5.0.0-BETA.2-STATUS.md`
- Create: `docs/NATIVE-CORE-PARITY-5.0.0-beta.2.md`

**Interfaces:**
- Release bundle includes inventory, master ledger, core catalog, parity report, source, portable Electron, GitHub release platform, VSIX, matrix, evidence, checksums, and change-set.

- [ ] Update all canonical version surfaces to `5.0.0-beta.2`.
- [ ] Regenerate ledgers, reports, UI build, manifests, and evidence hashes in freeze order.
- [ ] Run full Node suite, runtime smoke, eval non-claim, VSIX, Go, Python SDK, ForgeOS validation, and full release matrix.
- [ ] Build clean-room source and Windows portable artifacts without executable NolaneNative source.
- [ ] Verify archive integrity and all delivery checksums.
- [ ] Commit `release: prepare Nolane Agent 5.0.0-beta.2`.
