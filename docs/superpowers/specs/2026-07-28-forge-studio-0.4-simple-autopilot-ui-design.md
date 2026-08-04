# Forge Studio 0.4 Simple Autopilot UI Design

## Decision

Forge Studio 0.4 replaces the engineering dashboard with an outcome-first, Obsidian-inspired command center. The default surface is a conversation and a live task narrative. Technical controls remain available in a lazy-loaded Advanced Drawer but never block normal use.

## Product promise

The user selects a workspace, describes an outcome, and watches Forge complete the work. Forge chooses providers, builds a plan, creates isolated worktrees, edits code, runs tests, reviews changes, and prepares a reversible result.

## Visual language

- Obsidian-inspired dark neutral canvas, layered graphite surfaces, subtle purple accent, compact typography, soft separators, command-palette interactions, collapsible sidebars and tabbed workspaces.
- No dense dashboard grid, uppercase dashboard headings, raw JSON, developer jargon, or visible MCP/provider/evidence controls in the default mode.
- Motion is restrained and functional: activity pulse, streaming text, progress transitions and panel reveals.
- Keyboard-first: `Ctrl+K` command palette, `Ctrl+L` focus prompt, `Ctrl+Shift+P` project switcher, `Esc` close overlays.

## Main surfaces

### Home

A compact left rail contains workspace switcher, new task, recents and settings. The center contains one large prompt composer and recent runs.

### Task

The task screen has three columns:

1. Collapsible navigation rail.
2. Conversation and activity narrative.
3. Contextual inspector that defaults to Live Preview and can switch to Changes, Tests and Files.

On narrow windows, the inspector becomes a bottom sheet.

### Review

The completion card explains what changed, what was verified, risk, token/cost usage and available actions: Open Preview, Review Changes, Continue, Roll Back.

## Autonomy profiles

- `guided`: ask before writes, commands, network and external effects.
- `workspace-autopilot`: one-time workspace grant; automatically allow contained file edits, dependency installation, test/build commands, local preview and reversible Git operations.
- `sandbox-autopilot`: automatically allow all actions inside an isolated container/worktree with network policy and budget limits.

Irreversible or external actions remain hard stops: production deploy, publishing, deleting outside the worktree, credential export, purchases, messaging third parties and destructive database operations. Autopilot is not implemented by disabling safety checks; it is implemented by policy classification and scoped pre-authorization.

## User-visible activity model

Technical events are projected into a stable activity schema:

- understanding
- planning
- researching
- editing
- running
- testing
- reviewing
- waiting
- completed
- failed

Every activity exposes a human title, short explanation, target, elapsed time, latest heartbeat, token usage and optional files. Raw events remain accessible only in Advanced Drawer.

## Interaction model

- The user can send follow-up instructions while a run is active; they are queued and applied at the next safe checkpoint.
- The user can pause, resume, stop, retry, switch strategy or roll back.
- Questions appear as inline decision cards only when Forge cannot safely infer the answer.
- Long-running calls show model, elapsed time and whether a tool is active.
- Token usage is shown by phase and provider, not only as a global counter.

## BridgeMind and modern-agent capabilities retained

- Parallel isolated workers, task graph, worktrees and shared handoffs.
- Agent status, follow-up prompts and takeover.
- Built-in editor, terminal and preview behind the inspector.
- Persistent task history and session recovery.
- Provider auto-routing, MCP, memory, web research, evidence, receipts and resource governor remain backend capabilities.

## Data flow

1. `POST /api/runs` creates a run from workspace, objective and autonomy profile.
2. The orchestrator creates the mission and emits structured run/activity events.
3. `ActivityProjection` converts domain events into stable UI activities and persists snapshots.
4. SSE streams snapshots and deltas to the UI.
5. Follow-ups are queued through `POST /api/runs/:id/messages`.
6. Controls use `pause`, `resume`, `stop`, `retry` and `rollback` endpoints.
7. Review and preview data are fetched lazily.

## Performance rules

- Default route loads only shell, conversation and activity code.
- Monaco, xterm, diff viewer, graph, MCP and raw logs are dynamic modules.
- Activity lists are virtualized and bounded.
- SSE events are coalesced to at most ten UI updates per second.
- Provider output is summarized into append-only activity items rather than rendering full transcripts.
- No polling when SSE is healthy.

## Acceptance criteria

- A first-time user can select a folder and start a coding task without learning ForgeOS terminology.
- No raw JSON appears in default mode.
- At least 80 percent of current visible controls move out of the default surface.
- The UI always identifies the active phase, target, elapsed time, latest progress and token usage.
- Workspace Autopilot can finish ordinary repository tasks without repeated approvals while preserving hard stops.
- Follow-up instructions can be sent during a run.
- Advanced Drawer exposes terminal, editor, Git, MCP, memory, evidence and provider diagnostics on demand.
- Existing ForgeOS and Forge Studio tests remain green.
