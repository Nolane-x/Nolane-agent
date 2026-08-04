# Command Execution Security & Human Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build structured command governance, multi-shell contracts, managed servers, anti-fatigue approval bundles, SQL/upload/secret guards, and release evidence for Forge Studio 2.11.0.

**Architecture:** Add focused security services that validate structured executable/argv requests before ToolBroker or TerminalService spawns a process. Keep execution shell-free by default, expose explicit shell adapters only at the interactive PTY boundary, and bind every allow/ask/deny outcome to an immutable receipt.

**Tech Stack:** Node.js 22 ESM, `node:child_process`, existing Forge canonical JSON, SecretScanner, CapabilityGrantLedger, native PTY JSON-RPC host, Node test runner.

## Global Constraints

- No new registry dependency.
- Non-interactive execution must keep `shell: false`.
- Never write plaintext secrets to receipts, previews, logs, or approval bundles.
- Critical capabilities are never approval-bundled.
- Windows-specific support is exact source + contract testing, not Windows production certification.
- Full Release Matrix must run from gate 1 on a clean committed tree.

---

### Task 1: Shell codecs, argument validation, and risk classification

**Files:**
- Create: `src/security/shell-command-codec.mjs`
- Create: `src/security/command-risk-classifier.mjs`
- Test: `tests/shell-command-codec.test.mjs`
- Test: `tests/command-risk-classifier.test.mjs`

**Interfaces:**
- Produces: `ShellCommandCodec.validateArgv(input)`, `ShellCommandCodec.prepareInteractive(input)`, `ShellCommandCodec.preview(input)`
- Produces: `CommandRiskClassifier.classify(input)` returning `{ categories, requiredCapabilities, evidence }`

- [ ] Write failing tests for Bash, PowerShell, CMD, WSL mappings; NUL/newline/length filters; display quoting; and all dangerous command categories.
- [ ] Run tests and confirm module-not-found failures.
- [ ] Implement minimal codecs and token-based classifiers.
- [ ] Run focused tests and confirm pass.
- [ ] Commit `feat: add structured shell and command risk policies`.

### Task 2: SQL, sensitive upload, secret-safe command governance, and approval bundling

**Files:**
- Create: `src/security/approval-bundle-service.mjs`
- Create: `src/security/command-execution-governance-service.mjs`
- Modify: `src/security/action-guardrail-pipeline.mjs`
- Test: `tests/approval-bundle-service.test.mjs`
- Test: `tests/command-execution-governance-service.test.mjs`

**Interfaces:**
- Consumes: shell validation and risk classifications from Task 1.
- Produces: `CommandExecutionGovernanceService.authorize(input, context)` returning immutable allow receipt or throwing with deny/ask receipt.
- Produces: `ApprovalBundleService.record(input)` returning bounded, canonical bundles.

- [ ] Write failing tests for dangerous SQL, secret-bearing chat fields, protected uploads, capability checks, redacted receipts, idempotent decisions, and non-critical approval grouping.
- [ ] Verify tests fail for missing services.
- [ ] Implement minimal governance and approval services.
- [ ] Extend action guardrails with `file.upload`, `shell.run`, and `system.admin` mappings.
- [ ] Run focused tests and confirm pass.
- [ ] Commit `feat: govern command security and approval bundles`.

### Task 3: Governed ToolBroker execution and PID-managed servers

**Files:**
- Modify: `src/execution/tool-broker.mjs`
- Modify: `src/security/autonomy-policy.mjs`
- Modify: `src/agent/agent-loop.mjs`
- Test: `tests/tool-broker-command-governance.test.mjs`
- Test: `tests/managed-process-registry.test.mjs`
- Test: `tests/autonomy-policy.test.mjs`

**Interfaces:**
- `ToolBroker` constructor accepts `commandGovernance` and `managedProcessClock`.
- Adds tools `process.startManaged`, `process.stopManaged`, `process.listManaged`.
- `process.run` calls command governance and rejects server-class commands.

- [ ] Write failing tests proving deny-before-spawn, redacted receipt linkage, real PID registration, process-tree stop, broker-close cleanup, duplicate server ID denial, and unmanaged dev-server rejection.
- [ ] Verify RED.
- [ ] Implement minimal managed-process map and governed execution.
- [ ] Add tool schemas and autonomy policy entries.
- [ ] Run focused tests and confirm pass.
- [ ] Commit `feat: add governed managed process tools`.

### Task 4: PTY shell registry and terminal command governance

**Files:**
- Modify: `src/terminal/terminal-service.mjs`
- Modify: `src/terminal/terminal-manager.mjs`
- Modify: `src/app.mjs`
- Test: `tests/terminal-shell-governance.test.mjs`
- Test: `tests/terminal-service.test.mjs`
- Test: `tests/terminal-manager.test.mjs`

**Interfaces:**
- `TerminalService` accepts `shellCodec` and validates shell kind/executable/argv.
- `TerminalManager` accepts `commandGovernance` and links allow receipt to created sessions.

- [ ] Write failing tests for Bash, PowerShell, CMD, WSL PTY mappings, PID presence, input/resize/snapshot/exit, governance denial, and sandbox rollback.
- [ ] Verify RED.
- [ ] Implement shell codec integration and governance receipt propagation.
- [ ] Run focused tests and confirm pass.
- [ ] Commit `feat: enforce terminal shell governance`.

### Task 5: Audit, release gate, version 2.11.0, and artifacts

**Files:**
- Create: `scripts/verify-command-execution-governance.mjs`
- Create: `tests/command-execution-governance-release-gate.test.mjs`
- Modify: `scripts/audit-feature-checklist.mjs`
- Modify: `scripts/full-release-matrix.mjs`
- Modify version-bearing files and release docs to 2.11.0.

**Interfaces:**
- Verifier emits `release/matrix-2.11.0/command-execution-governance.json`.
- Audit moves exactly the twenty scoped items to `verified_source_test`.

- [ ] Write failing release-gate test requiring all source/tests, ToolBroker/Terminal wiring, audit movement, inherited non-claims, and matrix inclusion.
- [ ] Verify RED.
- [ ] Implement verifier, audit evidence/rules, documentation, and matrix gate.
- [ ] Run focused release tests.
- [ ] Run all Node tests, syntax, SDK/native tests, and Full Release Matrix from gate 1.
- [ ] Build and export source, Windows Electron, update payload, VSIX, evidence, change-set, checksums, reports, and workspace manifest.
