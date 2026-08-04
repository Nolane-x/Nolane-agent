# Forge Studio 0.4 — UI system

## Product principle

**Tell Forge the outcome. Watch only what matters.**

The default surface has four destinations: Home, Task, Preview and Review. Settings is separate. Engineering controls are hidden behind the Advanced Drawer.

## Visual language

- Graphite background and layered neutral surfaces.
- Restrained purple accent inspired by Obsidian, not copied assets.
- Soft one-pixel separators and compact rounded cards.
- Dense enough for long-running work but no dashboard grid.
- System font stack; no remote font dependency.
- Motion only communicates active work, progress or panel state.
- Keyboard-first command palette and visible focus rings.

## Information hierarchy

1. Outcome and conversation.
2. Current phase and latest progress.
3. Preview, changes and tests.
4. Token/time/heartbeat.
5. Technical diagnostics on demand.

## Default controls

- New task.
- Project selector.
- Autopilot profile.
- Primary composer and attachment button.
- Pause/resume/retry/stop.
- Follow-up composer.
- Preview/Plan/Changes/Tests tabs.
- Review and rollback.

No MCP, provider, lease, worktree, receipt or raw event controls appear by default.

## Accessibility and performance

- Every interactive control has an accessible name.
- `aria-live` announces run state without flooding.
- Keyboard focus is visible.
- Reduced-motion is respected.
- Default eager shell stays below 100 KB in repository assets.
- Monaco/xterm and the legacy Workroom load only after Advanced opens.
- Event bursts are coalesced to one active refresh plus one queued refresh.
