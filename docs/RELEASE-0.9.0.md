# Forge Studio 0.9.0 release notes

Date: 2026-07-28

## Agent operating plane

Forge Studio 0.9.0 introduces a common operating plane shared by the model loop, desktop app, HTTP API, VS Code extension, CLI, SDKs, worktrees, enterprise services, and cloud workers. The operating plane exposes only task-authorized capabilities and records content-addressed receipts for sensitive operations.

### Governed extensibility

- Lifecycle hook engine with deny-first decisions, bounded context injection, tool filtering, argument rewriting, process containment, timeout, and output caps.
- Project-defined custom-agent profiles with schema validation.
- Scoped subagent execution with parent/child permission intersection, isolated context, dependency scheduling, exclusive-tool leases, cancellation, budgets, and signed handoffs.
- ForgeOS 0.6.1 routing, universal lanes, skill intake, context isolation, review scope, harness plans, capability matrices, and remote-sandbox contracts remain integrated.

### Durable execution and recovery

- Append-only JSONL event ledger with hash-chain verification and tamper detection.
- Checkpoint, rewind, fork, and deterministic lineage replay without deleting prior evidence.
- Persistent SQLite capability grants supporting one-time, session, expiring, and durable scopes with principal-bound grant/amend/revoke APIs.
- Task contracts with measurable completion criteria, allowed/denied files and commands, network policy, autonomy, budgets, deadline, risk, and stop conditions.
- Verification orchestrator binds test evidence, required artifacts, task criteria, commit, and diff to completion.

### Stronger code and repository intelligence

- LSP JSON-RPC client and language-server registry for symbols, definitions, references, diagnostics, and call hierarchy.
- Symbol-aware read, replace, insert-before, and insert-after operations.
- Advanced search for imports, TODO/FIXME/HACK, compiler output, Git history, modification time, working-tree diff, logs, and combined filters.
- Typed Git gateway with HEAD binding, dirty-tree protection, secret scanning, stage/commit, merge, rebase, cherry-pick, revert, reset, abort, and GitHub/GitLab/Bitbucket request adapters.
- Dependency-ordered worktree integration with explicit approval, branch cleanliness checks, rebase-before-merge, fast-forward merge, and verification after each merge.

### Tools, clients, and verification

- Interactive and non-interactive CLI.
- TypeScript and Python SDKs with HTTPS/loopback policy, timeout, pagination, tenant headers, and token-safe errors.
- Test engine for Node.js, pytest, Go, and Rust with related-file, module, package, integration, and full-suite modes.
- Vault KV v2 and remote secret-manager adapters; fetched secrets are issued as one-use in-memory leases and never returned in public views.
- PNG visual comparison with bounded dimensions, diff artifacts, hashes, and receipts.
- Artifact/dependency scanner for executable signatures, suspicious shell/download patterns, content denylist, registry transport, SRI, and install-script risk.

## Full release matrix

`npm run release:matrix` is the required release entry point. It runs all required gates, continues after individual failures, redacts logs, writes a receipt for every gate, and exits non-zero unless every required gate passes. Release archives are generated from a release-scoped project manifest so packaging never dirties the source commit.

## Claims boundary

Authenticode, Apple notarization, live multi-tenant cloud conformance, external OIDC/SCIM interoperability, marketplace acceptance, native runtime evidence on every supported OS, and an independent comparative benchmark remain external gates. They are represented in release metadata but are not reported as satisfied without their actual evidence.
