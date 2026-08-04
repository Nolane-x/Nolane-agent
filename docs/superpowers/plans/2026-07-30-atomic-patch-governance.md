# Atomic Patch & Change Budget Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bounded `fs.patchSet` all-or-rollback transaction with formatter scope, generated/comment/conflict guards, minimal diffs, and patch metrics.

**Architecture:** A focused transaction service performs projection and commit while ToolBroker supplies workspace containment and command allowlisting. All validation happens before writes; every post-write failure restores all originals.

**Tech Stack:** Node.js ESM, unified diff parser, child_process spawn with `shell:false`, node:test, existing ForgeOS canonical SHA-256 receipts.

## Global Constraints

- Version target: 2.10.0.
- Existing UTF-8 regular files only.
- Maximum 32 files and 20,000 changed lines per transaction.
- Formatter must be allowlisted and invoked once per touched file.
- No generated-code override or protected-comment bypass.

---

### Task 1: Transaction core

**Files:**
- Create: `src/execution/atomic-patch-transaction-service.mjs`
- Test: `tests/atomic-patch-transaction-service.test.mjs`

**Interfaces:**
- Produces: `AtomicPatchTransactionService.apply({ patches, maxFiles, maxChangedLines, formatter, conflictPolicy, dryRun })`.

- [ ] Write failing tests for multi-file dry-run/apply, metrics, rollback, budgets, generated files, protected comments, and conflict policies.
- [ ] Run the focused test and verify failure because the service is missing.
- [ ] Implement minimal validation, projection, all-or-rollback writes, formatting, minimal diffs, and immutable result.
- [ ] Run focused tests to green.

### Task 2: ToolBroker and operating-plane wiring

**Files:**
- Modify: `src/execution/tool-broker.mjs`
- Modify: `src/agent/agent-loop.mjs`
- Modify: `src/agent/run-activity-tracker.mjs`
- Modify: `src/orchestration/activity-projection.mjs`
- Modify: `src/security/autonomy-policy.mjs`
- Modify: `src/security/autonomy-guarded-broker.mjs`
- Modify: `src/app.mjs`
- Test: `tests/atomic-patch-tool-wiring.test.mjs`

**Interfaces:**
- Produces: bounded tool `fs.patchSet` with standard Forge receipt.

- [ ] Write failing ToolBroker/schema/policy/activity tests.
- [ ] Verify RED.
- [ ] Wire the service without adding raw shell or workspace inputs.
- [ ] Run focused tests to green.

### Task 3: Release audit and gate

**Files:**
- Modify: `scripts/audit-feature-checklist.mjs`
- Create: `src/release/atomic-patch-governance-verifier.mjs`
- Create: `scripts/verify-atomic-patch-governance.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Modify: `tests/full-release-matrix.test.mjs`
- Test: `tests/atomic-patch-governance-release-gate.test.mjs`
- Create/update 2.10.0 release identity, audit, remaining gaps, release notes, verification report, and limitations.

**Interfaces:**
- Produces: release receipt `atomic-patch-governance-2.10.0.json` and verifies checklist items 16.14, 16.22, 16.23, 16.26, 16.27, 16.29, 16.30, 17.13, 17.18, 17.20.

- [ ] Write failing release-gate tests.
- [ ] Verify RED against 2.9.0 audit/matrix.
- [ ] Add item-specific evidence and fail-closed verifier.
- [ ] Regenerate 2.10.0 audit and documentation.
- [ ] Run focused gates, complete Node suite, and full release matrix.
