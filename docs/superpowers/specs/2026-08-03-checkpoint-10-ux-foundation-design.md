# Checkpoint 10 UX Foundation Design

## Status

Approved by the product owner on 2026-08-03. Implementation proceeds without additional approval prompts.

## Goal

Turn the checkpoint 10 UI from a mostly static surface into a production-wired, persistent, responsive two-level agent workspace that exposes the existing Nolane backend safely and adds a model-intelligence layer, a resizable shell, and an operational summary comparable to or more complete than modern coding agents.

## Product principles

1. **Backend truth, not decorative UI.** Every editable setting must load from and persist through a real service. Every process/source row must be derived from a live registry or explicit snapshot API.
2. **Two product levels.** Standard mode presents a calm, minimal workflow for ordinary users. Research mode exposes the full backend, provenance, routing, probes, resource controls, and evidence without creating a second product fork.
3. **Progressive disclosure.** Advanced controls remain available but do not crowd the standard path.
4. **Local-first and fail-closed.** Secrets remain in the credential vault; settings reject secret material; dangerous permissions require explicit controls; model discovery never silently writes credentials.
5. **Persistent ergonomics.** Panel sizes, collapsed state, selected settings category, density, and experience level persist locally and can be reset.
6. **Responsive without feature loss.** Narrow and short windows convert side panels to drawers/sheets; controls remain keyboard reachable; no capability is removed solely because the viewport is small.
7. **Accessible by default.** Semantic landmarks, labels, focus restoration, keyboard resize, reduced motion, minimum targets, contrast-safe tokens, and screen-reader status are required.
8. **Evidence before claims.** Release artifacts include test receipts and a Full Release Matrix. Existing non-claims remain locked unless new provider-real evidence supports them.

## Architecture

### 1. Settings domain

A schema-driven `SettingsCatalog` defines categories, fields, allowed values, scope, experience-level visibility, search aliases, validation, and help text. `SettingsService` continues to own layered persistence (`defaults`, `user`, `project`, `local`) and gains a catalog/snapshot API plus reset support. The browser uses a small API client and renders categories from the catalog, avoiding a hard-coded form disconnected from backend defaults.

The primary categories are:

- General
- Appearance
- Language & accessibility
- Notifications
- Keyboard shortcuts
- Permissions & autonomy
- Terminal & files
- Git & worktrees
- Browser & computer use
- Voice & media
- Memory & context
- Models & routing
- MCP, plugins & hooks
- Data, storage & privacy
- Updates
- Diagnostics
- Research controls (research mode only)

### 2. Experience levels

`experience.level` is `standard` or `research`. It is a normal persisted user setting. Standard mode hides research-only settings and advanced navigation entries but does not disable backend capabilities. Research mode reveals provenance, model probes, route scoring, resource limits, receipts, experimental systems, and raw diagnostics. A global switch appears in Settings and the shell command menu.

### 3. Model intelligence

`ModelProfileRegistry` stores normalized immutable profiles keyed by `provider/model`. Profiles separate:

- declared metadata (provider docs or user input),
- discovered metadata (provider model-list endpoints),
- probed capabilities (actual tests),
- observed runtime statistics (latency, success, cost),
- user overrides.

`ModelDiscoveryService` supports normalized adapters for OpenAI-compatible `/v1/models`, Anthropic model listing when available, Gemini `models.list`, xAI/Mistral/OpenRouter-compatible schemas, Ollama `/api/tags`, LM Studio, and custom JSON endpoints. It is extensible so the registry does not become stale when providers add models.

`ModelCapabilityProbeService` runs bounded, opt-in probes for text, streaming, structured output, tool calling, parallel tools, vision, cancellation, and context thresholds. Unknown is distinct from unsupported. Probe results include timestamp, model fingerprint where available, duration, and sanitized error.

The router consumes model profiles through a compatibility adapter. Profiles include tokenizer identity, context/output limits, modalities, tool behavior, reasoning controls, pricing, quotas, local resource requirements, lifecycle status, aliases, source URL, and review timestamp.

### 4. Output Summary

A top-bar Summary button opens a popover with three groups:

- Outputs: current workspace/output roots and recent generated artifacts.
- Background processes: live managed processes, terminal sessions, builds/tests, state, duration, and stop/reveal actions.
- Sources: MCP servers and other context sources, health, tool count, and manage action.

The backend exposes a single bounded `/api/ui/summary` snapshot assembled from registered services. It never returns unbounded process output or secrets.

### 5. Resizable shell

A reusable `ResizableRegionController` manages sidebar, artifact dock, bottom panel, and summary popover dimensions. Pointer drag, double-click reset, arrow-key resize, Home/End min/max, and Escape cancellation are supported. Values are clamped against viewport and stored in a local layout store. At responsive breakpoints regions become overlays while retaining their last desktop size.

### 6. Responsive strategy

The shell uses CSS grid with custom properties set by the layout controller. Four responsive classes are derived from measured container size rather than screen width alone: compact, narrow, standard, and wide. A separate short-height policy reduces chrome and makes settings navigation sticky/scrollable. Zoom and 125–200% DPI are supported through relative units and minimum content sizes.

### 7. Data flow

1. UI route loads catalog, effective settings, provenance, and project context.
2. Editing updates local draft state and validates immediately.
3. Save sends a scoped merge patch to `PUT /api/settings`.
4. Server validates through catalog, rejects secret-looking keys, persists atomically, and returns the new effective snapshot.
5. UI applies appearance/density/experience settings immediately and announces save status.
6. Model discovery/probes are explicit API actions; results update profile snapshots and settings options.
7. Summary polling is visibility-aware and pauses when hidden.

## Error handling

- Settings load failure renders a retryable inline error and retains safe defaults.
- Save conflicts show which scope changed and allow reload or overwrite.
- Unsupported settings values are rejected server-side with field paths.
- Model discovery failures are isolated per provider and never remove last-known profiles.
- Probe failures are recorded as `unknown/error`, not `unsupported`.
- Summary service omits unavailable subsystems and reports availability flags.
- Layout persistence corruption resets only layout state, not user settings.

## Testing

- Unit tests: catalog validation, settings persistence/reset, model normalization, discovery adapters, probe result classification, layout clamping.
- Route tests: Settings catalog/effective/update/reset, model profile/discovery/probe, UI summary.
- UI tests: standard/research visibility, searchable categories, form serialization, save state, responsive markup, resizer ARIA/keyboard behavior, summary rendering.
- Integration tests: backend-created settings are rendered by UI; model discovery result appears in profile view; managed process and MCP snapshots appear in summary.
- Accessibility/static audits: landmarks, labels, focus targets, reduced motion, no horizontal overflow contracts.
- Release gates: UX foundation verifier, UI build, node suite, syntax, runtime smoke, existing checkpoint 10 verifier, source reconstruction, archive integrity, and release artifact checks.

## Release outputs

The implementation produces:

- source ZIP,
- Git bundle,
- change-set patch and ZIP,
- release-evidence ZIP,
- verification report,
- checkpoint report,
- Full Release Matrix JSON and Markdown,
- SHA256SUMS and PRODUCT-SHA256SUMS,
- portable/update payload and platform artifacts when the existing toolchain can build them in the current environment.

Any platform artifact that cannot be freshly built in this environment is explicitly marked external-unverified rather than copied and claimed as new.
