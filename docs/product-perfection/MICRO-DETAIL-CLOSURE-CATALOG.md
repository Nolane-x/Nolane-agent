# Nolane Agent — Micro-Detail Closure Catalog

**Authority:** companion to `docs/superpowers/specs/2026-08-15-nolane-product-perfection-system-v3-design.md`  
**Purpose:** stable audit IDs for product/UI perfection work  
**Rule:** an item may be `PASS`, `FAIL`, `UNKNOWN`, `BLOCKED`, `NOT_APPLICABLE`, or `DEFERRED_WITH_REASON`. Never infer `PASS` from absence of a bug report.

This catalog is deliberately granular. It is not a demand to customize every native control. It is a demand that every material behavior have an intentional owner and evidence level.

---

## Evidence classes

- `SRC` — source contract/static validation.
- `INT` — integration test.
- `DOM` — real runtime DOM/state assertion.
- `VIS` — rendered screenshot/runtime visual inspection.
- `A11Y` — automated accessibility evidence.
- `PERF` — performance trace/budget evidence.
- `OS` — platform-runner evidence.
- `MANUAL` — independent/manual observation.
- `PROVIDER` — provider-real credentialed receipt.
- `RELEASE` — signed/packaged/release/update evidence.

Each audit record should name one or more evidence classes appropriate to risk.

---

# A. Global shell and spatial continuity

- `PFX-SHELL-001` Active global destination is distinguishable without color alone.
- `PFX-SHELL-002` Global destination hit targets remain usable at compact widths.
- `PFX-SHELL-003` Route title never competes visually with the primary work objective.
- `PFX-SHELL-004` Project/context identity remains visible when route changes.
- `PFX-SHELL-005` Running mission state survives navigation without becoming a decorative badge.
- `PFX-SHELL-006` Runtime/provider truth summary never implies provider availability from configuration alone.
- `PFX-SHELL-007` Experience switcher communicates current regime and preserves user context.
- `PFX-SHELL-008` Switching experience level does not reset scroll, project, mission or dirty state unexpectedly.
- `PFX-SHELL-009` Command/search invocation returns focus to a deterministic target when dismissed.
- `PFX-SHELL-010` Escape unwinds overlays in a deterministic inner-to-outer order.
- `PFX-SHELL-011` Window drag regions never swallow interactive controls.
- `PFX-SHELL-012` Shell resize never produces clipped rail labels or unreachable actions.
- `PFX-SHELL-013` Shell chrome is quieter than active work surfaces in both light and nocturne themes.
- `PFX-SHELL-014` Titlebar treatment is correct per Windows/macOS/Linux shell mode.
- `PFX-SHELL-015` App-level critical update/error state is visible but does not permanently dominate navigation.
- `PFX-SHELL-016` Global notification indicators expose count/status accessibly.
- `PFX-SHELL-017` Keyboard navigation does not trap focus in rail/context dock.
- `PFX-SHELL-018` Restored shell layout rejects impossible/outdated geometry safely.
- `PFX-SHELL-019` Shell at 125%, 150%, 175%, 200% zoom/reflow preserves primary actions.
- `PFX-SHELL-020` Fractional DPI does not create one-pixel seams between rail, dock and work canvas.

# B. Typography and text rendering

- `PFX-TYPE-001` Heading scale is mapped to information priority rather than route type alone.
- `PFX-TYPE-002` Small uppercase labels have adequate tracking and contrast.
- `PFX-TYPE-003` Mono is restricted to machine identifiers, code, paths, hashes, receipts and commands.
- `PFX-TYPE-004` Numeric telemetry uses tabular numerals where comparison/scan benefits.
- `PFX-TYPE-005` Vietnamese diacritics do not clip at line box boundaries.
- `PFX-TYPE-006` Mixed Vietnamese + English + code text maintains readable baseline/rhythm.
- `PFX-TYPE-007` Long provider/model names do not break layout or hide state.
- `PFX-TYPE-008` Long Windows paths and POSIX paths wrap/copy predictably.
- `PFX-TYPE-009` Hashes/IDs have intentional truncation with accessible/full-value retrieval.
- `PFX-TYPE-010` Ellipsis means content truncation, never uncertain state.
- `PFX-TYPE-011` Empty-state text does not exceed comfortable reading width.
- `PFX-TYPE-012` Error copy preserves actionable detail without raw stack noise in Everyday mode.
- `PFX-TYPE-013` Expert mode may expose raw detail without making it the primary label.
- `PFX-TYPE-014` Font fallback does not shift controls enough to break alignment.
- `PFX-TYPE-015` Text remains readable during font loading/fallback.
- `PFX-TYPE-016` Disabled text is still readable when meaning is required.
- `PFX-TYPE-017` Selected text contrast works in light/nocturne/forced-colors.
- `PFX-TYPE-018` Code/terminal text sizes remain readable at compact density.
- `PFX-TYPE-019` Truncated labels expose full value via a non-hover-only path.
- `PFX-TYPE-020` Copy terminology is consistent across Home, Mission, Review, Settings and Control Plane.

# C. Optical spacing, rules and surfaces

- `PFX-OPT-001` Icon + label groups are optically centered, not merely flex-centered.
- `PFX-OPT-002` Icon-only buttons have visually balanced glyph placement.
- `PFX-OPT-003` Nested rounded rectangles are removed unless semantic containment requires them.
- `PFX-OPT-004` Border/rule hierarchy distinguishes structure from consequence.
- `PFX-OPT-005` Parallel columns share meaningful baselines where scanning benefits.
- `PFX-OPT-006` Pane dividers align continuously across adjoining regions.
- `PFX-OPT-007` No double borders appear where nested surfaces meet.
- `PFX-OPT-008` Card/plate radii follow one semantic scale.
- `PFX-OPT-009` Popover/dialog radius relates correctly to trigger/shell material.
- `PFX-OPT-010` Empty states are vertically balanced relative to actual available workspace.
- `PFX-OPT-011` Scrollbar gutters do not shift alignment unexpectedly.
- `PFX-OPT-012` One-line and two-line rows maintain coherent vertical rhythm.
- `PFX-OPT-013` Dense expert rows do not collapse hit targets below intended constraints.
- `PFX-OPT-014` Group spacing exceeds intra-group spacing consistently.
- `PFX-OPT-015` Consequence plates visually dominate routine separators but not mission objective.
- `PFX-OPT-016` Evidence trace markers align to the text/event baseline they describe.
- `PFX-OPT-017` Empty placeholder glyphs do not look like disabled interactive controls.
- `PFX-OPT-018` Divider/rule colors remain perceptible in nocturne without creating a grid cage.
- `PFX-OPT-019` Layout remains stable when optional metadata appears/disappears.
- `PFX-OPT-020` Optical review at reduced scale does not reveal random density islands.

# D. Reusable interactive states

For each applicable shared component, verify the following:

- `PFX-STATE-001` Rest state.
- `PFX-STATE-002` Hover state.
- `PFX-STATE-003` Focus-visible state.
- `PFX-STATE-004` Active/pressed state.
- `PFX-STATE-005` Selected state.
- `PFX-STATE-006` Disabled state.
- `PFX-STATE-007` Readonly state.
- `PFX-STATE-008` Unavailable state distinct from disabled-by-user.
- `PFX-STATE-009` Loading/pending state.
- `PFX-STATE-010` Streaming/in-progress state.
- `PFX-STATE-011` Dirty/unsaved state.
- `PFX-STATE-012` Syncing state.
- `PFX-STATE-013` Stale state.
- `PFX-STATE-014` Offline/degraded state.
- `PFX-STATE-015` Blocked state.
- `PFX-STATE-016` Error state.
- `PFX-STATE-017` Retry state.
- `PFX-STATE-018` Recovered state.
- `PFX-STATE-019` Dragging state.
- `PFX-STATE-020` Valid drop target state.
- `PFX-STATE-021` Invalid drop target state.
- `PFX-STATE-022` Destructive-armed state.
- `PFX-STATE-023` Permission-waiting state.
- `PFX-STATE-024` External-change/conflict state.
- `PFX-STATE-025` State never depends on color alone.

# E. Keyboard, focus and modality

- `PFX-KEY-001` Primary product paths are reachable without pointer.
- `PFX-KEY-002` Tab order follows reading/action order.
- `PFX-KEY-003` Focus-visible is never clipped by overflow containers.
- `PFX-KEY-004` Modal opens with a deterministic focus target.
- `PFX-KEY-005` Modal closes and restores focus to the initiating context where valid.
- `PFX-KEY-006` Popover/menu closes with Escape without closing unrelated parent context first.
- `PFX-KEY-007` Enter/Space semantics match control type.
- `PFX-KEY-008` Roving tabindex is used for composite widgets where appropriate.
- `PFX-KEY-009` Keyboard shortcuts do not steal ordinary text editing unexpectedly.
- `PFX-KEY-010` Shortcut labels use platform-appropriate modifier notation.
- `PFX-KEY-011` Command palette/filter focus is deterministic after route switch.
- `PFX-KEY-012` Context menus have keyboard invocation and navigation.
- `PFX-KEY-013` Pane/splitter resize has keyboard path where accessibility requires it.
- `PFX-KEY-014` Drag-only actions have an alternate path when materially required.
- `PFX-KEY-015` Disabled/unavailable controls remain understandable to assistive tech.
- `PFX-KEY-016` Tooltip-only information has a focus/non-hover path.
- `PFX-KEY-017` Focus does not jump to document body after asynchronous rerender.
- `PFX-KEY-018` Route navigation chooses a consistent focus destination.
- `PFX-KEY-019` Browser/editor/terminal embedded surfaces have defined focus-entry/exit behavior.
- `PFX-KEY-020` No keyboard trap exists in nested overlays or panes.

# F. Motion and temporal behavior

- `PFX-MOTION-001` Motion communicates state/causality rather than “premium feel” alone.
- `PFX-MOTION-002` Reduced-motion mode preserves informational equivalence.
- `PFX-MOTION-003` Route transitions do not delay interaction unnecessarily.
- `PFX-MOTION-004` Streaming additions do not cause uncontrolled scroll jumps.
- `PFX-MOTION-005` New evidence/event appearance can be understood without animation.
- `PFX-MOTION-006` Interrupted transitions retarget cleanly.
- `PFX-MOTION-007` Pane open/close does not animate layout into illegibility.
- `PFX-MOTION-008` Loading indicator appears only after an intentional threshold.
- `PFX-MOTION-009` Short operations do not flash skeletons/spinners.
- `PFX-MOTION-010` Long operations expose meaningful progress/status where knowable.
- `PFX-MOTION-011` Cancel state acknowledges immediately.
- `PFX-MOTION-012` Retry replaces or links to prior failure instead of duplicating noise.
- `PFX-MOTION-013` Background work does not repeatedly steal attention.
- `PFX-MOTION-014` Completion animation never masks unverified/partial status.
- `PFX-MOTION-015` Hover transitions remain responsive under low-end performance conditions.

# G. Modern interface residue

- `PFX-RES-001` Scrollbar styling/visibility is intentional per platform and theme.
- `PFX-RES-002` Scrollbar remains usable with mouse and keyboard.
- `PFX-RES-003` Select/dropdown chrome is intentional and accessible.
- `PFX-RES-004` File input/picker behavior does not visually break the product shell.
- `PFX-RES-005` Date/time controls are intentional if present.
- `PFX-RES-006` Number/range controls are intentional if present.
- `PFX-RES-007` Browser autofill does not create illegible text/background combinations.
- `PFX-RES-008` Text selection color is legible across themes.
- `PFX-RES-009` Caret is visible in editable surfaces.
- `PFX-RES-010` Resize handles/cursors match actual affordance.
- `PFX-RES-011` Drag ghost communicates dragged object/context.
- `PFX-RES-012` Native validation UI does not conflict with custom error semantics.
- `PFX-RES-013` Context menu treatment is intentional and platform-appropriate.
- `PFX-RES-014` Tooltip timing avoids both instant noise and excessive delay.
- `PFX-RES-015` Cursor type reflects clickable, text, resize, drag and disabled states.
- `PFX-RES-016` Overscroll/bounce does not expose raw background seams.
- `PFX-RES-017` Native focus outline is either intentionally retained or replaced accessibly.
- `PFX-RES-018` Clipboard copy feedback is visible without toast spam.
- `PFX-RES-019` Window controls/drag regions remain correct with custom titlebar.
- `PFX-RES-020` Browser/editor embedded native chrome does not look accidental.

# H. Localization and content

- `PFX-CONTENT-001` English and Vietnamese category names map one-to-one semantically.
- `PFX-CONTENT-002` Action labels begin with clear verbs where applicable.
- `PFX-CONTENT-003` Destructive actions name the destroyed scope.
- `PFX-CONTENT-004` Confirmation copy explains consequence, not just “Are you sure?”.
- `PFX-CONTENT-005` Error copy identifies user-actionable recovery.
- `PFX-CONTENT-006` Empty state explains why empty + what to do next.
- `PFX-CONTENT-007` Loading text does not promise exact progress when unknown.
- `PFX-CONTENT-008` Unknown/blocked terminology is consistent product-wide.
- `PFX-CONTENT-009` Provider/model names remain canonical and un-translated.
- `PFX-CONTENT-010` CLI/tool/file terms use consistent technical vocabulary.
- `PFX-CONTENT-011` Vietnamese strings do not fall back to English unexpectedly.
- `PFX-CONTENT-012` Long Vietnamese strings are included in responsive capture.
- `PFX-CONTENT-013` Interpolated values cannot break grammar or layout.
- `PFX-CONTENT-014` Everyday copy avoids unexplained diagnostic jargon.
- `PFX-CONTENT-015` Expert copy can be precise without being cryptic.
- `PFX-CONTENT-016` Toasts are reserved for transient events, not persistent state.
- `PFX-CONTENT-017` Status badges do not duplicate adjacent text without added value.
- `PFX-CONTENT-018` Help text is not used to compensate for unclear primary labels.
- `PFX-CONTENT-019` Copy tone remains calm during failure and permission escalation.
- `PFX-CONTENT-020` Release/update copy matches real platform support.

# I. Agent execution and evidence semantics

- `PFX-AGENT-001` Planning/thinking is visually distinct from committed action.
- `PFX-AGENT-002` Queued work is distinct from running work.
- `PFX-AGENT-003` Parallel tasks expose relationship/ownership without overwhelming Everyday mode.
- `PFX-AGENT-004` Tool invocation identifies tool boundary.
- `PFX-AGENT-005` Permission request identifies requested capability and scope.
- `PFX-AGENT-006` Waiting on user differs from waiting on provider/tool.
- `PFX-AGENT-007` Provider unavailable differs from model unconfigured.
- `PFX-AGENT-008` Artifact created differs from artifact verified.
- `PFX-AGENT-009` Test pass/fail links to evidence/receipt where available.
- `PFX-AGENT-010` Partial completion cannot inherit full completion styling.
- `PFX-AGENT-011` Blocked mission exposes blocker + next valid action.
- `PFX-AGENT-012` Retry/replan retains relationship to prior failed attempt.
- `PFX-AGENT-013` Human intervention is visible in execution lineage.
- `PFX-AGENT-014` Independent review is visually distinct from generator self-review.
- `PFX-AGENT-015` Evidence freshness/staleness is inspectable.
- `PFX-AGENT-016` Unknown state is not rendered as neutral success.
- `PFX-AGENT-017` Recovery/time-travel identifies checkpoint and consequences.
- `PFX-AGENT-018` Completion receipt identifies exact mission/revision where applicable.
- `PFX-AGENT-019` Copy/export of evidence preserves identifiers without leaking secrets.
- `PFX-AGENT-020` Experience-level simplification never hides a blocker that changes safe action.

# J. Projects and persistence

- `PFX-PROJ-001` Projects route upper-whitespace anomaly is reproduced with measurements before mutation.
- `PFX-PROJ-002` Bounding boxes are recorded for shell header, project content root and first project record.
- `PFX-PROJ-003` ScrollTop is recorded before/after route entry.
- `PFX-PROJ-004` Restored workspace scroll state is identified as applied/not-applied by runtime evidence.
- `PFX-PROJ-005` Fresh browser context and restored-session context are compared.
- `PFX-PROJ-006` Project card/list first-row geometry is stable with zero/one/many projects.
- `PFX-PROJ-007` Long project names do not alter top spacing unexpectedly.
- `PFX-PROJ-008` Project path/repository truth is visible and copyable.
- `PFX-PROJ-009` Dirty repository state is visible when product data supports it.
- `PFX-PROJ-010` Resume action targets the correct mission/session.
- `PFX-PROJ-011` Project switch clears context that must not cross projects.
- `PFX-PROJ-012` Project switch preserves global settings that should cross projects.
- `PFX-PROJ-013` Deleted/unavailable project has an explicit recovery/remove path.
- `PFX-PROJ-014` Project empty state offers create/open/import paths according to supported capabilities.
- `PFX-PROJ-015` Project route behaves structurally at 1440/1180/980/640 widths.

# K. Mission / Proofline / Review

- `PFX-MISSION-001` Objective is P0 at all supported widths.
- `PFX-MISSION-002` Active intervention/recovery is reachable before low-priority history on compact layouts.
- `PFX-MISSION-003` Evidence Spine is driven by real execution semantics.
- `PFX-MISSION-004` Tool boundaries are visually/semantically distinguishable.
- `PFX-MISSION-005` Unknown evidence uses interrupted/non-success grammar.
- `PFX-MISSION-006` Blocked state uses hard-stop + textual reason.
- `PFX-MISSION-007` Recovery branch ties to a checkpoint/replay semantic.
- `PFX-MISSION-008` Receipt/hash text is copyable and not visually dominant.
- `PFX-MISSION-009` Streaming events do not force the user away from inspected history.
- `PFX-MISSION-010` “Jump to latest” behavior appears only when needed.
- `PFX-REVIEW-001` Review shows intent before diff/evidence detail.
- `PFX-REVIEW-002` Proposed vs observed result are distinct.
- `PFX-REVIEW-003` Reviewer decision scope is explicit.
- `PFX-REVIEW-004` Reject/request-change/approve actions have distinct consequences.
- `PFX-REVIEW-005` Unverified evidence cannot produce verified visual treatment.

# L. Studio / Workroom

- `PFX-STUDIO-001` Mission lineage remains visible while editing.
- `PFX-STUDIO-002` File tree/editor/agent panes have clear ownership and boundaries.
- `PFX-STUDIO-003` Pane collapse does not lose state.
- `PFX-STUDIO-004` Splitter min/max constraints prevent unusable panes.
- `PFX-STUDIO-005` Pane geometry persists intentionally per project/session scope.
- `PFX-STUDIO-006` Empty editor state uses project/context-aware guidance.
- `PFX-STUDIO-007` Agent suggestions/actions/tools/verification/blocked states use shared semantics.
- `PFX-STUDIO-008` Terminal remains visually recognizable as terminal without breaking product theme.
- `PFX-STUDIO-009` Code selection/focus is not stolen by streaming agent updates.
- `PFX-STUDIO-010` ≤640 layout switches panes rather than squeezing three columns.
- `PFX-STUDIO-011` Keyboard path exists between tree/editor/agent/terminal regions.
- `PFX-STUDIO-012` Diff/navigation preserves relevant scroll/selection.
- `PFX-STUDIO-013` Unsaved editor state is visible during mission navigation.
- `PFX-STUDIO-014` External file changes/conflicts have explicit handling.
- `PFX-STUDIO-015` Long filenames/paths do not collapse action buttons.

# M. Browser trust surface

- `PFX-BROWSER-001` Current origin/session trust state is P0.
- `PFX-BROWSER-002` External/untrusted page status is explicit.
- `PFX-BROWSER-003` Allowed and denied browser actions are distinguishable.
- `PFX-BROWSER-004` Permission escalation names target origin/action.
- `PFX-BROWSER-005` Screenshot/artifact lineage links to mission when available.
- `PFX-BROWSER-006` Navigation failure has retry/back/alternate action.
- `PFX-BROWSER-007` Browser loading does not imply agent progress completion.
- `PFX-BROWSER-008` Page content cannot visually impersonate Nolane chrome at trust boundary.
- `PFX-BROWSER-009` Focus transition between browser content and Nolane chrome is deterministic.
- `PFX-BROWSER-010` Dangerous browser actions require explicit authorization when policy requires it.

# N. Skills / Plugins / MCP

- `PFX-CAP-001` Origin/provenance is visible.
- `PFX-CAP-002` Installed vs enabled vs configured vs ready are distinct.
- `PFX-CAP-003` Requested permissions are visible before enable/install where available.
- `PFX-CAP-004` Dependencies and compatibility blockers are explicit.
- `PFX-CAP-005` Update state is distinct from runtime availability.
- `PFX-CAP-006` Remove/disable consequences are explicit.
- `PFX-CAP-007` Search/filter preserves keyboard focus and selection.
- `PFX-CAP-008` Master-detail preview behaves at compact widths.
- `PFX-CAP-009` Marketplace-like card decoration does not outweigh capability truth.
- `PFX-CAP-010` Invocation boundary is inspectable from mission/tool evidence.

# O. Settings and personalization

- `PFX-SET-001` Category navigation preserves active category predictably.
- `PFX-SET-002` Search reveals matching fields without losing their category context.
- `PFX-SET-003` Clearing search returns to prior meaningful category.
- `PFX-SET-004` Deep-link opens correct category/field.
- `PFX-SET-005` Dirty state is scoped to changed settings.
- `PFX-SET-006` Save/reset communicates changed scope.
- `PFX-SET-007` Immediate vs restart-required settings are distinguishable.
- `PFX-SET-008` Policy/locked setting explains why it cannot be changed.
- `PFX-SET-009` Language switch does not lose route/scroll/focus unnecessarily.
- `PFX-SET-010` Theme/accent switch does not create transient illegible states.
- `PFX-SET-011` Provider account/login state reflects backend truth.
- `PFX-SET-012` Sign-in/out actions have loading/error/retry states.
- `PFX-SET-013` Reset-to-default does not masquerade as unsaved discard.
- `PFX-SET-014` Settings rows avoid unnecessary enclosing boxes.
- `PFX-SET-015` Settings remains intentionally quieter than Mission/Review.

# P. Onboarding

- `PFX-ONB-001` Flow has ≤4 meaningful steps unless product truth requires more.
- `PFX-ONB-002` Each question changes immediate experience or critical setup.
- `PFX-ONB-003` Safe defaults exist.
- `PFX-ONB-004` Skip behavior is explicit.
- `PFX-ONB-005` Selection communicates consequence.
- `PFX-ONB-006` Keyboard and focus order are correct.
- `PFX-ONB-007` Back preserves previous choices.
- `PFX-ONB-008` Interrupted onboarding resumes/restarts intentionally.
- `PFX-ONB-009` Unsupported provider/model choices are not presented as ready.
- `PFX-ONB-010` Completion lands in a useful first workspace state.

# Q. Accessibility runtime matrix

- `PFX-A11Y-001` Axe serious/critical = zero for declared runtime capture states.
- `PFX-A11Y-002` Keyboard traversal covers primary paths.
- `PFX-A11Y-003` Focus-visible review covers all interactive component classes.
- `PFX-A11Y-004` Focus restoration is runtime-tested for dialogs/popovers/routes.
- `PFX-A11Y-005` Status/live-region behavior is runtime-tested for agent progress and errors where applicable.
- `PFX-A11Y-006` Reduced-motion capture/behavior exists for material motion.
- `PFX-A11Y-007` Forced-colors/high-contrast state is tested where runner/browser permits.
- `PFX-A11Y-008` Zoom/reflow captures include at least high zoom and compact width.
- `PFX-A11Y-009` Non-color status redundancy is inspected.
- `PFX-A11Y-010` Independent screen-reader certification remains `UNKNOWN/BLOCKED` until independently observed.

# R. Responsive matrix

For primary routes Home, Projects, Mission, Studio, Browser, Review, Skills, Settings, Control Plane:

- `PFX-RESP-001` 1440+ wide layout intentional.
- `PFX-RESP-002` 1180 layout intentional.
- `PFX-RESP-003` 980 structural collapse intentional.
- `PFX-RESP-004` 640 compact layout intentional.
- `PFX-RESP-005` Primary actions preserved at all widths.
- `PFX-RESP-006` No unintended horizontal page scrolling.
- `PFX-RESP-007` Metadata truncation has retrieval path.
- `PFX-RESP-008` Modal/popover stays within viewport.
- `PFX-RESP-009` Keyboard order follows recomposed reading order.
- `PFX-RESP-010` Experience-level switching remains usable at compact widths.

# S. Performance and stability

- `PFX-PERF-001` Route-switch p95 budget recorded.
- `PFX-PERF-002` Route-switch long-task budget recorded.
- `PFX-PERF-003` Input latency during agent streaming recorded.
- `PFX-PERF-004` Major-route DOM count budget recorded.
- `PFX-PERF-005` Progressive rendering threshold documented for large lists.
- `PFX-PERF-006` Idle CPU budget recorded.
- `PFX-PERF-007` Memory baseline/growth budget recorded.
- `PFX-PERF-008` Repeated route switching does not leak unbounded DOM/listeners.
- `PFX-PERF-009` Motion respects performance degradation path.
- `PFX-PERF-010` Labelled Windows 8 GB evidence remains external until measured on such a machine.

# T. Cross-platform desktop and release

- `PFX-OS-001` Windows titlebar/window behavior verified on Windows runner/runtime.
- `PFX-OS-002` macOS titlebar/window behavior verified on macOS runner/runtime where available.
- `PFX-OS-003` Linux window behavior verified on Linux runner/runtime where available.
- `PFX-OS-004` Platform keyboard modifier labels are correct.
- `PFX-OS-005` Path display/copy behavior is platform-correct.
- `PFX-REL-001` Windows NSIS artifact tied to exact release revision.
- `PFX-REL-002` macOS DMG artifact tied to exact release revision.
- `PFX-REL-003` macOS ZIP artifact tied to exact release revision.
- `PFX-REL-004` Linux AppImage artifact tied to exact release revision.
- `PFX-REL-005` Linux DEB artifact tied to exact release revision.
- `PFX-REL-006` Shared checksum/provenance manifest generated.
- `PFX-REL-007` Signing/notarization claim matches actual credentials/receipts.
- `PFX-REL-008` GitHub Release publication is gated by required verification.
- `PFX-REL-009` Update metadata references correct assets/version.
- `PFX-REL-010` Corrupt/untrusted update is rejected visibly.
- `PFX-REL-011` Update preserves user settings/data per declared guarantees.
- `PFX-REL-012` Failed update has an explicit recovery path.
- `PFX-REL-013` Windows native installer handoff is tested to the level claimed.
- `PFX-REL-014` macOS native update/install handoff remains bounded until verified.
- `PFX-REL-015` Linux native update/install handoff remains bounded until verified.

---

## Audit execution rule

A perfection milestone should publish a machine-readable matrix with at least:

```json
{
  "id": "PFX-SHELL-001",
  "status": "PASS",
  "surface": "global-shell",
  "experience": ["everyday", "workspace", "studio", "expert"],
  "evidence": [
    {"class": "DOM", "ref": "..."},
    {"class": "VIS", "ref": "..."}
  ],
  "revision": "<exact git sha>",
  "notes": "Active destination uses label + trace notch; not color only."
}
```

A future AI must not convert this catalog into a meaningless “all PASS” file. Evidence references must exist and match the exact tested revision or an explicitly valid ancestor/tree-equivalent revision.
