# Forge Studio 0.6 Goal OS Design

## Objective

Turn Forge Studio from a single mission runner into a durable goal operating system. A goal persists across sessions, records assumptions and discoveries, can patch its plan without discarding completed work, exposes a command surface, uses a governed browser runtime, and imports community agent plugins through a quarantined compatibility layer.

## Architectural decision

Keep ForgeOS as the final authority. Goal OS is an orchestration layer above existing missions and tasks, not a second execution kernel. External components such as Playwright CLI, Claude-compatible plugins, Codex app-server, and MCP servers are adapters. They never bypass path policy, autonomy policy, receipts, evidence, or rollback.

## Components

### Goal Service

A goal stores objective, success criteria, status, budget, schedule, active mission, assumptions, facts, and revision number. Each plan revision and plan patch is immutable. Completed tasks are never silently rewritten.

### Adaptive Replanner

Findings are recorded with provenance, confidence, impact, and optional invalidated assumption IDs. A high-impact finding creates a proposed plan patch. Applying a patch may add tasks, update only unstarted tasks, or cancel obsolete unstarted tasks. Running and completed tasks remain historical evidence.

### Command Center

A typed slash-command registry handles `/goal`, `/plan`, `/status`, `/resume`, `/rewind`, `/compact`, `/agents`, `/plugins`, `/browser`, `/model`, `/budget`, `/permissions`, and `/doctor`. Commands produce structured results and emit events; unknown commands fail with suggestions.

### Browser Runtime

The default adapter targets the official `@playwright/cli`. It uses named sessions, persistent profiles, headed mode on request, bounded snapshots, screenshots, and explicit commands. All page content is untrusted. Download, upload, external navigation, and credential use remain policy-controlled.

### Plugin Compatibility

Forge reads Claude-compatible marketplace and plugin layouts: `.claude-plugin/marketplace.json`, `.claude-plugin/plugin.json`, `.mcp.json`, `commands/`, `agents/`, and `skills/`. Installation uses immutable cache directories. Plugin manifests are scanned before activation. Capabilities are deny-by-default and activation is project-scoped.

### Layered Settings

Settings merge in the order defaults < user < project < local. Security-sensitive fields cannot be weakened by project files. The effective configuration includes provenance for every value.

### Background Scheduler

Goals can be scheduled by interval or repository-change trigger. The scheduler is bounded, idempotent, and does not run overlapping executions for the same goal.

### Live Mission Graph

The UI receives a graph projection containing goal, mission, agents, tasks, current targets, discoveries, plan patches, token usage, elapsed time, and blockers. Technical receipts remain available only in the advanced drawer.

## Performance constraints

No browser or plugin runtime is loaded at startup. Marketplace catalogs are indexed incrementally. Browser snapshots and plugin schemas are stored as artifacts and only bounded summaries enter model context. Goal and graph queries use indexed SQLite tables. Background jobs are capped by the resource governor.

## Security constraints

Browser content, plugin files, hooks, MCP results, and imported commands are untrusted. No imported hook executes during install. Network access is host allowlisted. Secrets remain in Credential Manager. Plugins cannot expand permissions. Replanning cannot rewrite completed evidence or modify ForgeOS policy.

## Success criteria

- Durable goals survive restart.
- A finding can trigger and apply a bounded plan patch.
- Slash commands operate through one registry.
- Browser actions use a named governed Playwright CLI session.
- Claude-compatible plugin metadata can be scanned and activated without executing installer code.
- Layered settings show provenance and enforce locked security keys.
- Scheduled goals do not overlap.
- The live graph explains current agent work and recent replans.
- Existing Forge Studio and ForgeOS tests remain green.
