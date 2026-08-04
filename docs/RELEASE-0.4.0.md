# Forge Studio 0.4.0 release notes

## Simple Autopilot UI

Version 0.4 replaces the engineering dashboard with an Obsidian-inspired chat-first command center. The normal workflow is now project → objective → Autopilot → live progress → review.

## Added

- Persistent user/assistant conversations and recent runs.
- Outcome-first background run API.
- Human-readable ActivityProjection with phase, heartbeat, token and affected-file metadata.
- Follow-up messages at safe checkpoints.
- Pause, resume, stop and retry controls.
- Guided, Workspace Autopilot and Sandbox Autopilot profiles.
- Policy-enforced automatic approval for reversible worktree actions.
- Home, Task, Preview and Review surfaces.
- Concise completion summaries and managed-worktree rollback.
- Lazy Advanced Drawer for Monaco, ConPTY, Git, MCP, credentials and diagnostics.
- Accessibility and eager-asset performance gates.

## Changed

- Raw technical events are hidden from default UI.
- Provider, MCP, evidence, memory and repository-index controls no longer occupy the main screen.
- Long-running Autopilot starts asynchronously instead of holding a browser request open.
- Model/tool activity is represented as user-facing progress rather than JSON logs.

## Security

Autopilot is scoped pre-authorization, not a permission bypass. Production deployment, publishing, credential export, purchases, external messaging, destructive data operations and access outside the granted workspace remain hard stops.

## Known boundaries

- Windows binaries are cross-compiled and require physical Windows 11 validation.
- No Authenticode certificate or production update feed is included.
- No independent benchmark proves superiority over Claude Code or Codex.
