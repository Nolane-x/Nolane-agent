# Nolane Agent 5.0.0-beta.2 Complete Native Core Design

## Goal

Replace the beta.1 packaging-only Nolane runtime purity claim with a complete, evidence-driven clean-room parity program that inventories every NolaneNative behavioral surface, maps it to a Nolane-native production entrypoint, implements missing core behavior, and exposes one canonical acceptance ledger for legacy, Nolane V5, and upstream behavioral requirements.

## Source basis

The design uses three source classes:

1. The immutable NolaneNative archive and 8,548-entry historical transformation ledger retained as provenance evidence.
2. The extracted upstream NolaneNative source snapshot under the audit workspace, used only to derive public behavior contracts, command/tool inventories, schemas, test intent, and product surfaces.
3. The existing Nolane beta.1 source and its 1,150 legacy requirements, 198 Nolane V5 requirements, 104-gate release matrix, and 527 production modules.

Upstream source is never copied, renamed, or embedded in Nolane packages. Behavioral contracts are independently expressed in Nolane terminology and implemented behind Nolane-owned interfaces.

## Truth model

Beta.1 established packaging retirement, not complete core parity. Beta.2 therefore separates four claims:

- `archive_absent`: no NolaneNative archive or executable NolaneNative source is packaged;
- `behavior_inventory_complete`: every upstream core surface has a canonical Nolane contract or an explicit non-core exclusion;
- `native_implementation_verified`: the contract has a production entrypoint, direct tests, negative tests, and fresh evidence;
- `external_certification_pending`: behavior exists but requires a real provider, Windows host, messaging credential, browser, or independent evaluator.

No aggregate parity claim is allowed while any core contract is `unmapped`, `not_implemented`, `implemented_not_wired`, or `verified_without_production_path`.

## Architecture

### 1. Master acceptance ledger

`requirements/master-acceptance-ledger.json` is the canonical crosswalk for:

- 1,150 legacy requirements;
- 198 Nolane V5 requirements;
- generated NolaneNative behavioral contracts;
- full release gates and external certifications.

Each canonical requirement stores source aliases rather than duplicating requirements. The generator performs deterministic deduplication, validates evidence hashes, and rejects status inflation.

### 2. NolaneNative behavioral inventory

`scripts/generate-nolane-native-core-inventory.mjs` scans the extracted upstream snapshot and historical ledger. It classifies public/core surfaces into twenty domains:

agent kernel, prompt/context, providers, tools, execution, repository, browser/computer use, sessions, memory, learning, skills, plugins, MCP, scheduler, multi-agent, gateway/integrations, ACP/API, media, observability/operations, and product surfaces.

The scanner emits file-level provenance and higher-level contracts. Documentation translations, branding assets, contributor metadata, generated bundles, fixtures, and optional skill payloads are classified as non-core with explicit reasons.

### 3. Nolane native core catalog

`src/native-core/core-contract-catalog.mjs` defines stable contract IDs and maps each contract to one or more Nolane production entrypoints. A contract is not complete merely because a file exists. The verifier imports or inspects the entrypoint, runs its conformance test, checks production wiring, and records the exact source/test hashes.

### 4. Shared runtime kernel

All product surfaces consume the same Nolane runtime through typed event and command interfaces. The shared kernel owns turn lifecycle, tool dispatch, cancellation, retries, provider fallback, session persistence, memory, scheduling, and recovery. Electron, HTTP, TUI, ACP, and gateways may adapt transport but cannot fork behavior.

### 5. Clean-room implementation waves

Missing behavior is implemented by independent Nolane modules, following TDD and explicit contracts. Existing verified Nolane modules are reused where they already satisfy the behavior. New modules are added only for genuine gaps.

## Core domains and acceptance requirements

### Agent kernel

Must support bounded turn state, streaming event order, cancellation, retry classification, tool-loop budgets, goal completion contracts, crash recovery, and immutable receipts.

### Prompt and context

Must support stable/context/volatile prompt tiers, repository instructions, explicit references, token budgets, compression lineage, cache boundaries, secret filtering, and prompt-injection quarantine.

### Provider fabric

Must support typed adapters, provider/model aliases, credential references, fallback chains, rate-limit rotation, auxiliary models, usage/cost accounting, local/OpenAI-compatible endpoints, and provider conformance tests.

### Tool and execution fabric

Must support tool discovery, schemas, toolsets, policy overlays, timeout/cancellation, local process execution, PTY, containers, SSH/remote execution contracts, Windows job isolation, result normalization, approvals, and process cleanup.

### Repository and browser

Must support safe file operations, search, patch transactions, checkpoints, rollback, diff preview, browser navigation/snapshot/action/download, approval, and deterministic journey receipts.

### Sessions, memory, and learning

Must persist across restart, support lineage and search, isolate profiles, bound memory growth, consolidate verified experiences, grade/prune/rollback skills, and reject self-reported learning evidence.

### Plugins, MCP, scheduling, and multi-agent

Must support signed manifests, tool/hook/provider/command extensions, transparency logs, MCP stdio/HTTP lifecycle, sampling and filtering, durable schedules, worker leases, heartbeats, blackboards, worktrees, verifiers, synthesizers, duplicate-work prevention, and stale-worker recovery.

### Gateways, ACP/API, media, and product surfaces

Must support unified gateway events, authorization, pairing, delivery queues, idempotency, attachments, session routing, ACP JSON-RPC, approvals, diffs, terminal events, OpenAI-compatible streaming, media/voice providers, and a shared runtime across Electron, web, and TUI.

### Observability and security

Must support usage/cost accounting, traces, diagnostics, health checks, recovery, secret scopes, egress policy, redaction, symlink/path safety, dependency provenance, backup/restore, and tamper-evident receipts.

## Error handling

- Unknown or unmapped upstream surfaces fail inventory certification.
- Ambiguous category assignments are emitted as review-required, not guessed complete.
- Missing evidence hashes fail ledger generation.
- Provider, gateway, and external integration contracts remain external gates until real credentials and receipts exist.
- Runtime errors are typed, bounded, serializable, and included in receipts without leaking secrets.
- Cancellation propagates through provider, tool, process, browser, and subagent boundaries.

## Testing strategy

Each contract requires:

1. unit test;
2. contract/conformance test;
3. production-path wiring test;
4. negative or adversarial test;
5. persistence/restart test where stateful;
6. resource-bound test where applicable;
7. clean-room package scan;
8. external receipt when the contract depends on a real platform or credential.

The full release matrix gains separate gates for inventory completeness, master-ledger integrity, core-catalog conformance, runtime kernel, context/provider fabric, tool/execution fabric, state/learning fabric, extension/automation fabric, gateway/API surfaces, and security/observability.

## Version and release policy

Beta.2 may claim:

- NolaneNative executable/package retirement;
- complete inventory coverage when the generated report has no unmapped core paths;
- verified Nolane-native behavior only for contracts with fresh production evidence.

Beta.2 may not claim complete parity, competitor superiority, or autonomous self-improvement unless the corresponding ledgers and real-world certifications are fully green.

## Delivery

The release bundle includes:

- source ZIP without NolaneNative executable source;
- Master Acceptance Ledger and deduplication report;
- NolaneNative Core Inventory and classification report;
- Nolane Native Core Parity report;
- full release matrix Markdown/JSON;
- portable Electron and GitHub NSIS release platform;
- evidence bundle, checksums, change-set, limitations, and external-gate runbooks.
