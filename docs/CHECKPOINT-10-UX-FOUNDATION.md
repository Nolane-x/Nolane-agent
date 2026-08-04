# Nolane Agent Checkpoint 10 UX Foundation

## Status

Checkpoint 10 UX Foundation completes the source-local product wiring for Settings, model intelligence, live activity summary, persistent panel resizing, and adaptive desktop behavior. It extends forensic recovery checkpoint 10; it does not replace or renumber the existing forensic checkpoint chain.

## Standard and Research experiences

Nolane uses one backend and one UI codebase with two progressive-disclosure levels:

- **Standard** keeps ordinary AI-assisted programming focused: common settings, permissions, terminal, Git, browser, memory, model selection, integrations, updates, and diagnostics.
- **Research** reveals routing diagnostics, capability probes, raw evidence controls, provider score decomposition, experimental systems, parallel-agent limits, and forensic evidence strictness.

The selected level is persisted as `experience.level`. Switching levels does not fork data, disable backend capability, or silently weaken safety policy.

## Production-wired Settings Center

The Settings Center is generated from `SettingsCatalog` and loads effective layered values from `SettingsService`. It supports user, project, and local-machine scope, provenance labels, server-side path validation, atomic persistence, scoped reset, search, immediate appearance preferences, and a live save/error status.

The catalog includes General, Appearance, Language & accessibility, Notifications, Keyboard shortcuts, Personalization, Permissions & autonomy, Terminal & files, Git & worktrees, Browser & computer use, Voice & media, Memory & context, Models & routing, MCP/plugins/hooks, Data/storage/privacy, Updates, Diagnostics, and Research controls.

Credential-shaped fields are excluded. Security-locked settings remain governed by backend policy.

## Model intelligence

`ModelProfileRegistry` separates declared, discovered, probed, observed, and user-override evidence. Provider connections can explicitly discover model lists and run bounded probes for text, tool use, structured output, and streaming. The UI distinguishes supported, unsupported, probe error, and unknown states.

The family seed catalog is intentionally pattern-based rather than an allegedly permanent list of every model ID. Provider discovery and future catalog refreshes are the authoritative mechanisms for new model IDs.

## Activity Summary

The top-bar Activity Summary presents bounded live snapshots of:

- Outputs and workspace roots.
- Background processes and terminal sessions.
- MCP and context sources.

Managed tools share one process registry. Stoppable processes can be terminated from the summary through a bounded backend endpoint. Polling pauses when the document is hidden.

## Resizable and adaptive shell

Sidebar and artifact-dock resizing supports pointer input and keyboard input, including arrows and Home/End limits. Sizes are clamped, persisted locally, and recovered safely from corrupt layout storage. Narrow windows turn panels into overlays rather than deleting capabilities. Short-height, safe-area, reduced-motion, forced-colors, and high-zoom contracts are present in source CSS.

## Verification

The required verifier is:

```text
npm run verify:checkpoint-10-ux-foundation
```

The verifier binds backend routes, UI lifecycle wiring, model profiles, live summary, shared process registry, resizable panels, responsive/accessibility contracts, tests, catalog integrity, and protected non-claims. It emits a deterministic SHA-256 receipt.

The **Full Release Matrix** includes the required gate `checkpoint-10-ux-foundation`, in addition to the original forensic checkpoint 10 gate and all retained release gates.

## Protected non-claims

This source-local completion does not claim provider-real certification, Windows external certification, screen-reader certification, external-repository generalization, comparative superiority, complete NolaneNative function parity, or model intelligence superiority. Those remain external or independent evidence gates.
