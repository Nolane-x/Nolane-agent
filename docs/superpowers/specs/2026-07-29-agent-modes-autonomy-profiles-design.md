# Agent Modes & Autonomy Profiles 2.0.0 Design

## Goal

Turn Forge Studio's user-facing modes into enforceable runtime policy rather than prompt labels. Every mode must deterministically constrain tools, writes, network, approvals, model routing, token/task budgets, child agents, background execution, verification, and commit behavior.

## Architecture

`AgentModeRegistry` owns immutable built-in mode definitions. `AgentModeService` resolves a requested mode into a bounded run policy and validates overrides so callers can only narrow permissions. `RunCoordinator` stores the resolved policy in mission metadata and propagates it to every planned task. `AutonomyGuardedBroker` and `AutonomyPolicy` enforce the policy at the action boundary. The HTTP API and lazy-loaded Agent Modes Center expose allowlisted summaries and mode selection without leaking prompts, command templates, or credentials.

## Built-in modes

The release contains exactly these 20 modes:

- `ask`
- `read-only`
- `plan`
- `edit-approved`
- `auto-edit`
- `review`
- `debug`
- `test-writer`
- `refactor`
- `migration`
- `architecture`
- `project-create`
- `ci-repair`
- `issue-resolution`
- `background`
- `learn-codebase`
- `explain`
- `fast`
- `deep`
- `offline`

## Policy model

Each definition includes:

- `autonomyProfile`
- `readOnly`
- `writesAllowed`
- `approvalPolicy`
- `networkPolicy`
- `localOnly`
- `backgroundAllowed`
- `commitPolicy`
- `allowChildAgents`
- `requiredCapabilities`
- `toolGroups`
- `deniedToolGroups`
- `taskKinds`
- `routingMode`
- `maxTurns`
- `maxTasks`
- `budgetTokens`
- `contextBudget`
- `verificationDepth`

Overrides may lower budgets, remove tools/capabilities, disable children/background/network/commit, or move to stricter approval. Overrides may never broaden the built-in definition.

## Enforcement

- Read-only and plan modes deny all filesystem writes, patches, deletes, mutating Git operations, and non-read-only commands.
- Edit-approved uses guided autonomy and asks for every state change.
- Auto-edit and specialist edit modes only allow reversible worktree changes.
- Offline mode selects local providers only and denies network.
- Background mode requires a trusted workspace and may not publish/deploy/send messages.
- Review/architecture/learn/explain modes remain read-only.
- Every task receives a frozen `modePolicy` and `modeId`.
- The broker emits the mode id and decision category into receipts.

## UI

The Agent Modes Center is lazy-loaded and shows mode cards, tool/capability boundaries, budget/routing settings, approval/network/commit policy, and a run composer. The UI submits only `modeId` and narrowing overrides; the server performs canonical resolution.

## Verification

Tests cover all 20 definitions, override narrowing, read/write enforcement, offline routing, background trust, task propagation, authenticated API, UI lazy loading, release verifier, source packaging, and audit item-level evidence. Full Release Matrix adds a required `agent-modes-governance` gate.
