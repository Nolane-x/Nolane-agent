# Sovereign Agent Kernel — Core Evolution Study

Date: 2026-08-03  
Target: Nolane Agent 5.0.0-beta.6, forensic recovery checkpoint 12

## Executive finding

The main weakness was not an absence of advanced subsystems. Nolane already contained model routing, context orchestration, memory, skills, lifecycle hooks, MCP, worktrees, sandboxing, independent review, evidence ledgers, and multi-agent coordination. The weakness was architectural: these capabilities could be reached through several partially independent orchestration paths. That makes the product appear broad but less deep because there is no single authority that owns thread continuity, context compilation, parallel execution, privilege, review, and resumption.

Checkpoint 12 introduces a **Sovereign Agent Kernel** as that authority. It does not replace the mature subsystems. It composes them behind a durable, receipt-backed execution protocol.

## Public product patterns studied

### Cursor

Official Cursor material documents reviewable plan mode; agent-side repository search; reusable Agent Skills; interactive and headless CLI operation; local checkpoints; diff review; and asynchronous background agents that run in isolated remote environments and work on separate branches. These patterns show that a dominant coding agent needs a continuum from interactive planning to unattended execution, while preserving review and recovery surfaces.

Sources:

- https://cursor.com/docs/agent/plan-mode
- https://cursor.com/docs/skills
- https://cursor.com/docs/cli/headless
- https://cursor.com/docs/cloud-agent
- https://docs.cursor.com/en/agent/review
- https://docs.cursor.com/en/agent/chat/checkpoints

### Claude Code

Official Claude Code material documents custom subagents with separate prompts, tools, permission modes, lifecycle hooks, skills and persistent memory. Hooks provide deterministic intervention at lifecycle events; skills are loaded on demand; project and subagent memory survive conversations; and the Agent SDK exposes sessions, permissions, MCP, hooks, subagents and plugins as programmable primitives.

Sources:

- https://docs.anthropic.com/en/docs/claude-code/sub-agents
- https://docs.anthropic.com/en/docs/claude-code/hooks
- https://docs.anthropic.com/en/docs/claude-code/skills
- https://docs.anthropic.com/en/docs/claude-code/memory
- https://docs.anthropic.com/en/docs/claude-code/sdk

### OpenAI Codex

Official Codex material documents multiple agent threads grouped by project, parallel execution, built-in Git worktrees, review and commenting on diffs, skills, local/cloud handoff, and controlled execution environments. The worktree model is especially important: concurrent agents need independent repository state, not merely separate prompts.

Sources:

- https://openai.com/index/introducing-the-codex-app/
- https://developers.openai.com/codex/environments/git-worktrees
- https://developers.openai.com/codex

## Architectural diagnosis of the previous core

The previous source already had deep individual components, including:

- `src/agent/agent-loop.mjs`
- `src/agent/context-orchestration-kernel.mjs`
- `src/context/context-orchestration-service.mjs`
- `src/memory/memory-operating-system.mjs`
- `src/hooks/hook-engine.mjs`
- `src/skills/skill-registry.mjs`
- `src/mcp/mcp-tool-gateway.mjs`
- `src/execution/worktree-manager.mjs`
- `src/review/independent-review-service.mjs`
- `src/security/action-guardrail-pipeline.mjs`
- `src/sandbox/local-resource-sandbox-service.mjs`
- `src/native-core/mixture-of-agents-coordinator.mjs`

The depth problem came from four structural gaps:

1. **No single durable execution identity.** A mission, task, agent run, worktree and review could be correlated, but no one kernel owned a thread epoch and revision across all of them.
2. **Ephemeral orchestration artifacts.** Plans, compiled context and capability state could be reconstructed, but were not one restart-resumable kernel ledger.
3. **Review semantics were too mutation-centric.** Requiring a Git diff for every lane encourages false evidence from research and scouting lanes. Mutation review and outcome review must be distinct.
4. **Privileges were approvals, not leases.** A decision needs scope, expiry, use count, resource constraints and revocation as first-class state.

## Checkpoint 12 architecture

### 1. Durable thread and artifact ledger

`src/kernel/thread-ledger.mjs` stores:

- durable threads;
- append-only thread events;
- checkpoints;
- execution plans;
- context packets;
- execution receipts;
- capability leases.

Writers are fenced by both an optimistic revision and an epoch. Resuming a checkpoint creates a new epoch, preventing stale workers from appending to a resumed branch of execution. Kernel artifacts are signed, persisted in SQLite, hydrated at startup, and usable after process restart.

### 2. Context compiler

`src/kernel/context-compiler.mjs` compiles separate lanes for instructions, objective, repository evidence, external evidence, memory, transcript and tools. Selection uses path scope, trust, freshness, relevance, token budget, deduplication and spillover. Transcript compaction preserves decisions, failures, files and commands rather than pretending every prior token is equally useful.

The compiler fails closed when untrusted content exceeds its policy budget. Every packet declares omissions and receives a SHA-256 receipt.

### 3. Speculative execution fabric

`src/kernel/speculative-execution-fabric.mjs` converts work into a validated DAG with:

- explicit dependencies;
- adaptive concurrency;
- owned paths and symbols;
- path/symbol conflict detection;
- isolated worktree requests;
- repair loops;
- independent review before integration.

The production adapter in `src/app.mjs` turns every lane into a real Nolane child task, prepares the existing isolated workspace, and executes it through the existing `AgentLoop`. This preserves all mature AgentLoop facilities: governed instruction discovery, project memory, evidence context, lifecycle hooks, skills/plugins, MCP, dynamic tool discovery, browser/tool gateways, model routing and the tool broker.

### 4. Capability lease authority

`src/kernel/capability-lease-authority.mjs` represents privilege as a signed lease with:

- actor, thread and project binding;
- capability and resource binding;
- `once`, `thread` or `project` scope;
- risk level;
- expiry;
- maximum uses;
- path, host and command constraints;
- independent policy review;
- human decision state;
- revoke, expire and consume transitions.

This is deliberately narrower than a global “allow” toggle.

### 5. Independent reviewer boundary

`src/kernel/reviewer-boundary.mjs` separates two verification contracts:

- **Change review:** requires a real diff, passing test receipts and evidence.
- **Outcome review:** permits non-mutating scout/research lanes, but requires substantive output and evidence.

An executor cannot approve itself. The execution receipt records reviewer identity and whether every completed lane crossed the boundary. Silent, unreviewed merge is an explicit forbidden invariant.

### 6. Kernel API and live Control Plane

The authenticated API is exposed under `/api/sovereign-kernel`. It supports threads, timelines, context compilation, plans, execution, capability decisions, checkpoints, resumption, health and snapshots.

The Control Plane surface at `/control-plane/agent-kernel` renders live kernel telemetry: durable threads, plans, compiled context, leases, execution fabric and enforced architecture invariants. It is built from production UI modules, not a separate mockup.

## What was adopted, and what was deliberately changed

| Public pattern | Nolane adoption | Deliberate change |
|---|---|---|
| Cursor plan/review/checkpoint flow | Reviewable plans, diff review, durable checkpoints | Checkpoints also bind authority epoch and signed kernel artifacts |
| Cursor background agents | Parallel asynchronous lanes and handoff | Local-first execution through existing Nolane worktree/sandbox stack |
| Claude subagents | Specialized lane roles and separate execution contexts | Roles are part of one receipt-backed DAG with ownership conflict rules |
| Claude hooks and skills | Existing HookEngine, skill/plugin and MCP paths remain active inside each kernel lane | Kernel itself owns state transition and authority; an extension cannot bypass the kernel ledger |
| Claude memory | Existing project memory and evidence context feed the context compiler/AgentLoop | Memory is scored and budgeted; it is not automatically treated as trusted truth |
| Codex project threads | Durable project-bound threads | Revision and epoch fencing prevent stale concurrent writers |
| Codex worktrees | Isolated agent lanes | Ownership conflict graph blocks unsafe concurrent mutation before launch |
| Codex diff review | Independent change review | Non-mutating outcome review is a separate evidence contract |

## Hard invariants

Checkpoint 12 treats the following as implementation properties rather than marketing copy:

- no stale-epoch thread append;
- no revision-blind concurrent thread mutation;
- no persisted artifact without a valid SHA-256 receipt;
- no execution-plan loss across a process restart;
- no standing privilege without a scoped lease;
- no self-approval by an executor;
- no change approval without a real diff and test evidence;
- no research lane forced to fabricate a diff;
- no silent merge of an unreviewed completed lane;
- no untrusted-context overflow silently accepted.

## Verification scope

Checkpoint-specific tests cover thread fencing, checkpoint resumption, restart durability, context selection and fail-closed behavior, capability lease consumption, execution DAG conflicts, reviewer separation, authenticated HTTP routes and the production UI surface.

The screenshots in the delivery were generated from the actual production renderers and a snapshot obtained from a running Nolane API process. The browser environment blocked direct loopback navigation by policy, so the captured page used the production-rendered HTML and CSS with the live API snapshot injected. It is not a hand-designed mockup.

## Claims intentionally not made

- This document does not claim private implementation parity with Cursor, Claude Code or Codex.
- It does not claim that one checkpoint empirically outperforms those products.
- It does not claim completion of external Windows performance, accessibility or real-provider certification.
- Public product documentation supports design comparisons, not hidden implementation details.
