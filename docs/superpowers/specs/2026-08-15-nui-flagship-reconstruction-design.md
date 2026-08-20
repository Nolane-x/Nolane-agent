# Nolane Agent — NUI Flagship Reconstruction Design

**Date:** 2026-08-15  
**Status:** Approved direction C / implementation-gated design  
**Evidence class:** `ARTIFACT_WORK`  
**Baseline:** `39c05216a553b577c53060716387a2a6919f0a03`  
**NUI source:** `Nolane-x/Nolane-UI-Intelligence@46780cdd58e41bea8338b2d27269d339c95e28e7` (v0.10.0 lineage)

## Product truth

Nolane Agent is a local-first desktop agent workspace. Its UI must express mission execution, tool boundaries, provenance, evidence, intervention, recovery and progressive expertise. The redesign may reconstruct shell composition, hierarchy, page geometry, type scale, density and material language, but must preserve capability semantics, permissions, evidence truth, mission state, routes, settings persistence, keyboard access and deterministic `ui-v3 -> ui-dist` generation.

Primary jobs: start/resume work quickly; understand what Nolane is doing and what is proved; move Everyday → Workspace → Studio → Expert without losing context; inspect code/browser/skills/runtime/evidence; intervene/review/recover safely; configure a powerful local agent without forced expert complexity.

Non-goals: no fabricated capabilities or metrics; no dark-neon cyberpunk reskin; no imitation of another product's trade dress; no backend-contract change for visual effect; no self-certification of accessibility/NUI efficacy/product completeness.

## NUI bootstrap checksum

- Surface: Electron desktop app; `ui-v3` source and deterministic `ui-dist`.
- Visual ambition: flagship / exceptional.
- Primary risk: misleading completion, hidden permission state, context loss, unsafe recovery, dense expert overload, accessibility regression.
- Modalities: keyboard + pointer; screen-reader evidence remains externally bounded.
- Platforms: Windows/macOS/Linux; compact desktop widths matter.
- Available evidence: full source tests, deterministic build, Chromium/Windows runtime screenshots, Axe, performance capture, external runner receipts.
- Unknown evidence: independent screen-reader certification, labelled Windows-8GB empirical certification, human blinded preference study.
- Hard constraints: preserve verified behavior/evidence contracts; missing evidence stays UNKNOWN/BLOCKED; never hand-edit `ui-dist` as source.

## Routed NUI owners

`using-nolane-ui`, `exploring-aesthetic-directions`, `deepening-signature-mechanisms`, `directing-visual-hierarchy`, `composing-layouts`, `crafting-typography`, `crafting-color`, `crafting-spacing-and-rhythm`, `crafting-depth-and-surfaces`, `architecting-design-tokens`, `architecting-component-systems`, `designing-desktop-professional-workspaces`, `adapting-responsive-layouts`, `designing-accessible-interfaces`, `designing-motion`, `preventing-generic-ui`, rendered-critique faculties, `binding-ui-evidence`, and `gating-ui-completion`.

Unrelated commerce/medical/financial/XR/automotive/game faculties are intentionally omitted.

## Runtime baseline critique

The exact-head runtime is coherent and usable, but authorship is uneven.

- **Home:** clear and low-friction, but visually reads as a polished general AI/SaaS landing surface: hero question + large rounded composer + four equal capability cards. Nolane's evidence/recovery model is nearly invisible.
- **Activity/Proofline:** strongest product-native surface, but still card-heavy and locally distinctive rather than a system-wide grammar.
- **Studio:** credible three-column editor, but visually close to a generic IDE and mission/evidence lineage is secondary.
- **Browser/Control Plane:** strong trust content, but giant headings + nested admin panels + second sidebar flatten hierarchy.
- **Skills:** good master-detail model, but generic library/list morphology.
- **Settings:** broad and credible, but visually closer to OS preferences than the rest of Nolane and too box-driven.

## Aesthetic divergence

### A — Proofborne Instrument — SELECTED
Nolane behaves like a precision instrument + working document. Use asymmetric work fields, rails, calibrated rules, open negative space and rare consequence plates instead of a grid of rounded cards. Typography is authored but operational. Signature is real evidence lineage.

### B — Spatial Mission Atlas
Mission/Studio/Browser/Review become persistent docked regions around a mission core. Strong expert continuity, but materially higher keyboard/focus and compact-layout risk. Deferred.

### C — Evidence Ledger / Archival Toolcraft
Receipts and immutable records dominate. Excellent audit density, but too severe for Everyday and weak as an inviting start surface. Borrow its record anatomy only in evidence/review contexts.

Direction A is selected because it best spans Everyday accessibility, Workspace supervision and Expert precision without borrowing another product shell.

## Selected thesis — Proofborne Instrument

Semantic sources: calibrated technical instruments; drafting/working documents; provenance chains; mission control as objective → action → evidence → intervention; local desktop tools with stable spatial memory.

Emotional target: controlled, intelligent, calm under complexity, precise without bureaucratic coldness, premium through proportion/restraint, trustworthy because unknown/blocked state remains visible.

Reject: uniform rounded-card grids, indiscriminate glass/blur, gradient blobs, neon-purple AI styling, giant marketing headings on expert pages, pills for every datum, decorative timelines and equal visual weight for all controls.

## Product-native signature — Evidence Spine / Trace

Causal chain:

`agent work has durable lineage` → `user needs to see origin/boundary/proof/recovery` → `typed state records expose provenance` → `a ruled trace/spine visualizes real transitions` → `Nolane feels inspectable and alive without ornamental motion`.

Trace grammar:
- intent = open node / quiet identity accent;
- action = solid node / primary ink;
- tool boundary = bracket/gate mark;
- evidence = double-rule / receipt marker;
- unknown = interrupted rule, never success styling;
- blocked = hard-stop marker + textual reason;
- recovery/branch = fork tied to checkpoint semantics;
- independently verified = explicit marker only when receipt truth allows it.

Signature rhythm:
- Primary: Mission/Activity/Review.
- Supporting: Studio context strip, Browser trust boundary, Projects lineage.
- Transformed: Skills provenance ticks, Control Plane system paths.
- Quiet/absent: Settings form rows, onboarding utility steps.

Removal test: removing the Trace must materially reduce provenance/boundary/recovery comprehension; if it only reduces decoration, the signature failed.

## Shell reconstruction

1. **Nolane rail:** retain global-mode authority but reduce visual mass. Active state uses a trace notch/semantic label rather than a large lavender tile alone.
2. **Context dock:** same project/conversation/running-mission semantics, visually treated as a working margin with less panel chrome and stronger active lineage.
3. **Command band:** route title, search/command, runtime truth and experience level become one calibrated horizontal instrument band.
4. **Work surface:** owns visual scale/contrast; shell chrome stays quiet.
5. **Expert index:** demote nested second-sidebar appearance into an in-surface outline; wide=sticky outline, compact=horizontal/overlay index.

No route is removed and keyboard landmarks must remain stable or improve.

## Page reconstruction

### Home — Mission Launch Surface
Replace marketing-like hero/cards with one dominant command aperture, attached runtime/trust strip, lineage rows for recent/running missions and command-like starting capabilities. First glance answers: where am I, what can Nolane do, what is running, what is trusted/blocked?

### Activity / Mission
Keep five-region Proofline architecture but reduce card saturation. Mission objective becomes a ruled mission sheet; Execution Story + Proofline form one continuous reading field; recovery becomes a consequence plate; receipt digests align to a technical baseline grid.

### Studio
Add persistent mission trace strip; flatten file/editor/agent pane boundaries; replace centered logo empty state with project/context-aware guidance; agent pane distinguishes suggestion/action/tool/verification/blocked through shared trace grammar. Terminal remains terminal-like.

### Browser
Make trust/session boundary P0. Reduce title saliency, make permissions/session state a calibrated boundary band, group allowed/denied structurally, and connect screenshot/artifact lineage back to mission evidence when available.

### Review
Render intent → change → test/evidence → reviewer decision as a proof-bearing trace. Unknown/unverified content cannot inherit success styling.

### Skills
Keep master-detail flow but use capability/provenance anatomy: origin, authority/readiness, applicability, dependencies/permissions and invocation boundary. Avoid bento/card wallpaper.

### Settings
Keep quiet. Active category owns the page with fewer enclosing boxes. Save/reset becomes a stable consequence bar tied to dirty scope. Appearance can preview the system without turning Settings into a showcase.

### Control Plane
Turn nested dashboard cards into a system map: expert outline instead of second shell, compact calibration band for metrics, source/freshness-path rows for provider/runtime/backend truth, smaller headings so system state wins attention.

## Typography, color and material

Two voices: sparse orientation grotesk and compact instrument sans/mono. Mono is reserved for hashes, ids, commands, paths, receipts and provenance.

Light becomes mineral-white/graphite with warmer neutral differentiation and less lavender wash. Nocturne becomes ink/graphite rather than blue-purple glow. Nolane violet remains identity accent but is rationed to active trace, focus and selected mission context.

Surface roles: `canvas`, `margin`, `rule`, `plate` (consequence only), `trace`, `evidence`, `overlay`. Default cards lose borders/radii where rule/alignment/spacing is sufficient.

## Motion

Motion describes causality only: new real trace event, branch/recovery continuity, mission-context preservation across mode changes. No floating/bouncing premium theater. Reduced-motion keeps the same information hierarchy.

## Responsive reconstruction

- >1180: full context dock + command band + multi-lane work surface.
- 981–1180: dock narrows; secondary metadata compresses; no tiny telemetry pane.
- ≤980: structural collapse; expert outline becomes compact nav; mission reading order becomes objective → intervention/recovery → story/trace.
- ≤640: no shrink-only three-column Studio; panes become explicit switches; Settings/Skills one main column; command band may become two rows; only intentional tab/filter strips may scroll horizontally.

## Accessibility/platform constraints

Preserve visible focus, logical tab order, state redundancy beyond color, target sizing, zoom/reflow/high-contrast durability and platform-readable controls. Do not claim independent screen-reader PASS without external evidence.

## Implementation architecture

Prefer a systemic visual layer + targeted semantic markup changes, not controller rewrites.

Primary source areas: `ui-v3/styles/tokens/*`, `styles/layout/*`, `styles/components/*`, `styles/pages/*`, `ui-v3/shell/*`, targeted `ui-v3/views/*`. `ui-v3/generated/*` is regenerated canonically; `ui-dist/*` is deterministic output and never hand-edited.

## Verification protocol

Static: existing full suite; new flagship shell/trace tests; deterministic distribution equality; quality/responsive contracts; route/action reachability.

Runtime captures: Home light+nocturne; Mission/Proofline; Studio; Browser trust state; Skills list+preview; Settings general+appearance; Control Plane overview; compact 980/640 for all key surfaces. Run Axe/runtime assertions and performance evidence on exact candidate SHA.

NUI critique requires at least two named cycles:
1. silhouette/hierarchy critique at reduced scale/grayscale;
2. taste/residue critique covering type rhythm, border/radius saturation, optical alignment, native chrome, density, nocturne parity and signature-to-quiet ratio.

Each cycle must produce correction + re-render.

## Acceptance gates

Promote only when exact candidate SHA passes CI/distribution checks; runtime visual evidence exists; responsive captures structurally recompose; no verified backend/evidence regression occurs; Evidence Trace is driven by real semantics; generic-transfer test still reads as mission/evidence/recovery software without branding; two critique loops are closed; performance contracts remain satisfied; external unknowns stay external/unknown.

## Delivery

After promotion: regenerate canonical UI/evidence artifacts; post-merge CI/external gates on final default head; create COMPLETE ZIP from exact final SHA with verification manifest/receipts; verify archive + SHA-256; persist a copy to ChatGPT Library.

## Completion boundary

This spec authorizes the flagship reconstruction. It does not authorize false claims that screen-reader, Windows-8GB empirical, provider-real, signing/release or human preference gates are complete without their own receipts.
