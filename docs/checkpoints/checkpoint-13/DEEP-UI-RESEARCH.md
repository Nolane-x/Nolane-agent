# Checkpoint 13 — Deep UI/UX Research

## Problem statement

Checkpoint 12 exposed a powerful backend through a fragmented interface. Production captures showed several failure modes: empty-looking routes, expert controls appearing too early, inconsistent English/Vietnamese copy, low observability of agent work, and no coherent path from ordinary chat to specialist control.

The redesign treats UI depth as progressive disclosure rather than as separate products. The same runtime, mission state, permissions, evidence and model routing remain underneath every layer.

## Product principles

1. **Everyday first.** A new user lands in a calm chat surface and can ask, attach, mention context, invoke a command, or start a mission without learning internal terminology.
2. **Depth is additive.** Workspace, Studio and Expert reveal more control without removing the simpler surfaces.
3. **No invented state.** UI cards render real API responses, explicit empty states, or a visible unavailable/degraded state.
4. **Agent work stays observable.** Reading, commands, tools, tests, delegation, browser activity and approvals are represented as typed timeline events.
5. **Compatibility is contractual.** Historical navigation IDs, legacy experience aliases, Recovery UI and approved Control Plane domains remain reachable.
6. **Settings are a product surface.** Language, theme, accent, density, motion, accessibility and experience level are live previews with explicit persistence scope.
7. **Dark is the primary visual language, not the only one.** Nocturne, Obsidian, Graphite and Aurora are complemented by Snow, Paper and System.

## Competitive patterns studied

The implementation uses patterns common to current high-quality coding-agent products without copying their branding or layout:

- Progressive plan/build/review workflows and diff-oriented review.
- Persistent mission/thread navigation and visible background work.
- Context mentions, slash commands, tools and skills surfaced at the composer.
- A focused editor/terminal/diff workspace that loads only when requested.
- Explicit approvals, autonomy boundaries and evidence-backed completion.
- A settings architecture that separates everyday preferences from research controls.

Reference points used during design include the official documentation and public interfaces of Cursor, Claude Code and OpenAI Codex, plus established accessibility and design-system guidance. The resulting implementation is Nolane-specific: its defining elements are the Sovereign Agent Kernel, capability receipts, backend atlas and compatibility-preserving progressive shell.

## Information architecture

### Everyday

- Chat composer
- Projects
- Search
- Recent work
- Attachments
- `@` context picker
- `/` command picker
- Automatic model routing
- Theme and language settings

### Workspace

- Everything in Everyday
- Mission activity
- Task progress
- Human approvals
- Review queue
- Live agent event filters

### Studio

- Everything in Workspace
- File tree
- Editor host
- Changes and preview tabs
- Terminal/agent panel
- Repository search entry points

### Expert

- Everything in Studio
- Control Plane
- Sovereign Agent Kernel
- Runtime, evidence, security and governance
- Model intelligence
- Capability Atlas generated from server routes
- Labs, release and recovery controls

## Visual system

- A two-rail desktop shell separates global destinations from session history.
- Surfaces use low-contrast dark neutrals with a restrained spectral accent.
- Typography follows a clear hierarchy: eyebrow, display heading, supporting copy, operational metadata.
- Borders and elevation identify interaction boundaries without excessive card nesting.
- Responsive layouts collapse the session sidebar first, retain the global rail, then reduce multi-column content.
- All non-primitive colors are tokenized; token validation rejects missing variables, cycles and raw colors outside the primitive layer.

## Interaction contracts

- `@` opens real projects, models, providers and tools.
- `/` opens real commands plus the local Ask/Plan/Build/Verify intent set.
- Control Plane navigation must change both URL and mounted domain content.
- Switching an unrelated setting must not silently reset language or theme preview.
- Dynamic routes use path-scoped view caching; static routes retain lazy single-load caching.
- Recovery UI is not presented as the default, but remains available for specialist surfaces not yet migrated.

## Evidence boundaries

Static source audits do not replace screen-reader, Windows 8 GB performance, or independent visual certification. Checkpoint 13 therefore reports source-local and runtime-browser evidence separately and retains external certification gaps rather than marking them complete.
