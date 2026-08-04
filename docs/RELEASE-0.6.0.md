# Forge Studio 0.6.0 release notes

## Goal OS

- Durable goals with success criteria, budgets, assumptions, schedules and plan history.
- Goal-to-mission execution and recovery across restarts.
- Automatic replanning from sourced discoveries with immutable revision history.
- Live Mission Graph for agents, tasks, dependencies, blockers, discoveries and plan patches.
- Goal scheduler for interval and repository-change triggers without overlapping runs.

## Browser Agent

- Governed Playwright CLI integration with headed and persistent sessions.
- One-click pinned Playwright/Chromium installation with staging and atomic activation.
- Bounded snapshots, targeted find, screenshots and session monitoring.
- Explicit browser write grants through `/permissions`.

## Plugin Platform

- Local and remote GitHub/Git marketplaces.
- Exact-commit, immutable, content-addressed cache.
- Claude-compatible skills, agents, commands, MCP and LSP metadata.
- Per-project MCP/LSP capability review.
- Executable hooks remain quarantined.

## Command and configuration surface

- `/goal`, `/plan`, `/status`, `/resume`, `/rewind`, `/compact`, `/agents`, `/plugins`, `/browser`, `/model`, `/budget`, `/permissions`, `/settings`, `/doctor` and `/help`.
- Layered user/project/local settings with provenance and protected security keys.

## Performance

- Goal OS and advanced styles load lazily.
- Eager UI remains below the 100 KB product budget.
- Repository index, browser runtime, Monaco/xterm, MCP schemas and plugin capabilities remain on-demand.

## Compatibility and limits

This release is local-first and Windows-packaged. Cloud sandbox, IDE extension, enterprise control plane, full remote MCP OAuth, production plugin signing, physical multi-OS package verification and independent superiority benchmarks remain outside the verified 0.6.0 scope.
