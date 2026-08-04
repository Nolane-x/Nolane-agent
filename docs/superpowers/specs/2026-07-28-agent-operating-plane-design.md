# Forge Studio 0.9.0 Agent Operating Plane Design

Date: 2026-07-28
Status: approved by the user's blanket approval to choose and execute the strongest safe design

## Goal

Turn Forge Studio from a capable governed coding runtime into a reusable agent operating plane shared by desktop, IDE, CLI, SDK, local execution, and cloud workers. The release must improve real source-level capability and must not convert external infrastructure gates into false completion claims.

## Scope

This release implements seven independent but composable capabilities:

1. Reproducible VS Code source build.
2. Lifecycle hook and policy engine.
3. Custom agent profiles and scoped subagent orchestration.
4. Durable event ledger with checkpoint, rewind, fork, and replay.
5. Language Server Protocol intelligence gateway.
6. Typed Git mutation and hosted pull-request request builders.
7. Standalone CLI, TypeScript SDK, Python SDK, secret scanning, and image comparison.

Live Kubernetes conformance, Authenticode, Apple notarization, enterprise IdP conformance, and independent Codex/Claude Code benchmarking remain external gates.

## Architecture

### Operating-plane boundary

Every surface calls the same authenticated HTTP/runtime services. Desktop, VS Code, CLI, SDK, and cloud workers never receive raw shell, filesystem, Git, secret, or MCP access. They submit typed requests to Forge Studio, which applies task ownership, permissions, hooks, resource policy, redaction, receipts, and verification.

### Lifecycle hooks

Hooks are configured in layered JSON files and are invoked at stable lifecycle events: `SessionStart`, `SessionEnd`, `BeforeAgent`, `AfterAgent`, `BeforeModel`, `AfterModel`, `BeforeToolSelection`, `BeforeTool`, `AfterTool`, `PreCheckpoint`, `PostCheckpoint`, `PreCompress`, and `Notification`.

Each hook receives bounded JSON on stdin and must return JSON on stdout. A hook may add context, filter tools, rewrite safe arguments, deny an action, request retry, or emit audit metadata. Timeouts, output limits, executable allowlists, project containment, and fail-open/fail-closed behavior are explicit. Hooks cannot raise permissions or reveal secrets.

### Custom agents and subagents

Agent profiles live in `.forge/agents/*.md` with validated frontmatter. A profile declares purpose, model capability requirements, allowed tools, exclusive tools, MCP server IDs, skill IDs, maximum turns, budget, sandbox profile, and child-agent permission.

The orchestrator creates isolated child contexts, intersects all capabilities with the parent task, streams lifecycle events, enforces concurrency, and returns a signed handoff summary plus receipts. Parallel execution is allowed only for dependency-independent tasks.

### Event ledger and rewind

Sessions use an append-only hash-chained JSONL ledger. Checkpoints bind sequence number, repository state, task state, plan revision, context digest, and receipt digests. Rewind never deletes history: it creates a new branch cursor from a verified checkpoint. Fork creates a new session lineage. Replay verifies every hash before rebuilding state.

### LSP intelligence

A generic stdio Language Server Protocol client implements framing, initialization, cancellation, timeout, document synchronization, workspace symbols, definitions, references, document symbols, call hierarchy, and diagnostics. Language servers are configured per language and started without a shell. Results are normalized into bounded Forge schemas and fall back to the existing repository index when no server is available.

### Typed Git gateway

The gateway executes Git using argv only. It provides status, remote listing, diff, stage, commit, branch, merge, rebase, cherry-pick, revert, safe reset, conflict inspection, abort, and worktree operations. Destructive operations require explicit approval and checkpoint evidence. Secret scanning runs before stage and commit.

Hosted provider adapters build and optionally execute typed GitHub, GitLab, and Bitbucket pull-request requests. Tokens are resolved server-side from the credential vault and never returned to clients.

### CLI and SDKs

The CLI supports interactive and non-interactive operation, JSON output, run creation, run control, logs, review, checkpoint, rewind, profile listing, and diagnostics. The TypeScript and Python SDKs implement the same protocol with timeout, abort/cancellation, pagination, typed errors, and no secret logging.

### Visual comparison

Image comparison accepts two bounded local PNG/JPEG/WebP files, verifies paths and dimensions, computes pixel difference and structural summary using a managed optional image backend, emits a diff artifact, and records hashes. Missing backend is reported as an unavailable capability rather than silently passing.

## Security and error handling

- Deny overrides allow at every layer.
- Child agents receive the intersection of parent permissions and profile permissions.
- Hook output is schema-validated and cannot introduce unknown tools or broader paths.
- JSON-RPC/LSP frames, hook output, CLI input, and SDK responses have byte limits.
- Git mutations bind to expected HEAD and reject dirty user changes unless explicitly included.
- Secret scanner findings block stage, commit, upload, and terminal publication by default.
- Event-ledger corruption fails closed and identifies the first invalid sequence.
- External provider failures preserve retry classification and do not imply success.

## Testing

Each capability follows red-green-refactor. Tests use temporary repositories, fake hook executables, a fake stdio LSP server, fake HTTP provider endpoints, deterministic image fixtures, and clean worktrees. The release gate runs the complete Node suite, Go suites, VS Code source build, Python SDK tests, CLI smoke tests, source smoke tests, feature audit, and artifact hash verification.

## Release truthfulness

A feature is marked source-tested only when the exact item has direct implementation and a relevant automated test. Live cloud, signing, marketplace publication, native OS behavior, enterprise conformance, and independent benchmark claims remain external gates until evidence from those environments is attached.
