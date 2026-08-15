# NUI Flagship Visual Synthesis v1 — Nolane Agent

Upstream cognition source: `Nolane-x/Nolane-UI-Intelligence@46780cdd58e41bea8338b2d27269d339c95e28e7`.

Evidence class: `ARTIFACT_WORK`. Materiality: `material`. Visual ambition: `flagship`.

The task is not “make the dashboard prettier”. The product job is to let a person supervise long-running agent work, understand what changed, see what has been proved, intervene safely, and recover without losing lineage. The generator cannot mark this work VERIFIED; independent evidence remains required after critique.

## Task contract

- Product surface: Nolane Agent desktop mission workspace across Electron on Windows, macOS and Linux.
- Primary job: supervise missions, inspect evidence, recover from failure, and steer tool/provider activity without confusing model claims with proof.
- Primary risks: lost work, misleading progress, invisible permission changes, provenance loss, unsafe recovery, dense expert-state overload.
- Modalities: keyboard, pointer, desktop; compact width must remain structurally usable.
- Host evidence available now: source inspection, Chromium runtime, Axe, screenshots, Windows runtime capture.
- Evidence still UNKNOWN: independent screen-reader run; macOS-native assistive technology behavior; human empirical preference validation.
- Authority: host sandbox, approvals, tool policy and permissions remain authoritative. UI cognition cannot expand them.

## Baseline critique

The pre-change runtime receipt for PR #7 shows a coherent light surface system, but four product-level weaknesses remain:

1. Home reads as a competent general LLM landing page: large question headline, composer and generic capability cards. The product-specific trust/evidence model is mostly invisible until deeper routes.
2. Workroom reads as a conventional IDE split: files/editor/agent. Mission state, evidence lineage and recovery are adjacent concepts rather than a continuous operating model.
3. Control Plane creates a second navigation system inside the first and presents expert data as an admin dashboard. This dilutes the hierarchy of the main agent workspace.
4. Browser correctly exposes permission/session boundary information, but the oversized editorial title competes with the state that actually determines whether browsing is safe and possible.

These observations are from the generated screenshots and source structure; they are not user-preference claims.

## Divergence

### Direction A — Mission Control / Flight Deck

**Thesis.** The mission is a live operation. The primary composition is a mission objective and progress band, a continuous chronological action/evidence trace, and a recovery/intervention deck that remains spatially stable while the mission evolves.

**Information architecture.** Mission state spans the top. Execution Story and the live event ledger share the main reading lane. Time Travel, checkpoint comparison and recovery occupy a persistent secondary lane. Review and Studio are explicit transitions from the mission, not competing top-level dashboards.

**Signature.** A continuous “Proofline” connects intention → agent action → tool boundary → artifact/evidence → intervention/recovery. Proofline is implemented by real event/receipt semantics, never as an ornamental glowing timeline.

**Strengths.** Strongest fit for the supervision job; turns evidence and recovery into first-class structure; can reuse the existing activity ledger and Time Travel semantics; degrades naturally to one column.

**Risks.** Can become a dense operations dashboard if every metric receives equal emphasis. Sticky recovery can steal space on medium widths. Needs restraint around color and animation.

### Direction B — Spatial Agent Studio

**Thesis.** The workspace is a spatial canvas of task rooms: mission, code, browser, review and evidence are resizable regions around a persistent agent focus object.

**Information architecture.** The user moves between spatially stable zones rather than routes. Workroom editor/terminal becomes one zone; browser and review can dock beside it; mission context floats as a shared control layer.

**Signature.** Spatial continuity between agent activity and artifacts, with explicit docking provenance.

**Strengths.** Powerful for expert multi-surface work; can make Studio and Browser feel like one system rather than separate products.

**Risks.** High implementation and accessibility complexity; spatial memory can break under compact widths; keyboard navigation and focus restoration become substantially harder; risks rebuilding an IDE before the mission model is visually solved.

### Direction C — Evidence-first Toolcraft

**Thesis.** The durable ledger is the product. Every action is presented as a compact structured record paired with provenance, policy result and evidence receipt. The surface behaves more like an instrument panel/logbook than a conversation UI.

**Information architecture.** Evidence and policy records are primary; mission narrative is derived from them. Filters, receipts, approval gates and comparison controls dominate.

**Signature.** Receipt-backed “toolcraft blocks” that expose exactly what is known, unknown, blocked or independently verified.

**Strengths.** Highest trust density; strongest fit for audits, release work and expert debugging; naturally resists fake completion.

**Risks.** Too severe for everyday users; can feel like telemetry rather than collaboration; weak emotional hierarchy for starting and steering a mission.

## Selected architecture — Proofline Mission Cockpit

Direction A is selected as the base because it changes the information architecture around the actual product job without requiring a risky rewrite of mission/time-travel semantics. It absorbs one mechanism from Direction C: receipts and policy/evidence records are visually treated as proof-bearing controls rather than footnotes. Direction B is deliberately deferred to a later Studio/Browser convergence milestone because it needs independent keyboard/focus research.

The selected architecture uses five named regions:

1. **Mission header** — objective, state and task progress. It answers “what is Nolane trying to do and how far has it actually progressed?”
2. **Execution Story** — compressed phase-level account. It answers “what has happened at a useful human scale?”
3. **Proofline** — event/evidence trace. It answers “what did the agent/tool/runtime actually do?”
4. **Recovery deck** — Time Travel, checkpoint comparison, replay/branch/restore. It answers “what can I safely do if I disagree or something failed?”
5. **Inter-surface transitions** — Review and Studio. They stay attached to the mission instead of becoming detached modes with lost context.

The style implementation is intentionally a layer on top of existing semantic classes. It does not fork controllers, replace API payloads, or infer verification from presentation.

## Attention hierarchy

1. Selected mission objective and current state.
2. Live Proofline / phase evidence.
3. Recovery and intervention capability.
4. Secondary statistics and filters.
5. Receipt digests, expanded only when requested.

Status color is semantic and sparse. Accent is used to maintain continuity of the Proofline and active state; it is not a blanket neon theme. Typography uses scale and spacing before color. Motion is nonessential and removed under reduced-motion preference.

## Generic-transfer resistance

If the labels “Nolane”, “agent” and “mission” were replaced with generic SaaS labels, the composition should stop making sense because its core geometry depends on agent-specific relations: chronological tool events, evidence receipts, mission task progress, checkpoints, replay/branch/restore, and independent review. The right rail is not a generic analytics sidebar; it is a recovery authority surface. The center line is not a decorative timeline; it is a proof-bearing execution ledger.

This is the domain-linked signature required by the NUI flagship gate.

## Responsive structural evidence

Desktop (>980 px): mission spans the composition; Execution Story + Proofline use the primary lane; recovery stays sticky in the secondary lane.

Medium/compact (≤980 px): the system becomes a single reading order: mission → story → recovery → controls → Proofline. Sticky recovery is removed so it cannot trap scroll or cover evidence.

Small (≤640 px): task cards become one column, mission controls stack, progress metadata wraps, the Proofline node shrinks, and filters remain horizontally scrollable. This is a structural reflow, not a scaled-down desktop screenshot.

The runtime evidence harness captures both the selected desktop architecture at 1440×1000 and the 820×1000 pressure point below the 980 px structural breakpoint. The harness creates a real mission through the application API, exercises Time Travel when the host can create a checkpoint, asserts the semantic Proofline regions, checks keyboard focus on a recovery control, rejects horizontal overflow, runs Axe for serious/critical findings, and records unsupported screen-reader evidence as `UNKNOWN`.

Dedicated evidence gates additionally force the Proofline ledger into the viewport, open a real evidence receipt, exercise default/compact/nocturne rendering, and capture the unselected mission state independently on Ubuntu and Windows rather than inferring it from source CSS.

## Critique cycle 1 — pre-render challenge

**Observed problem.** The initial Flight Deck concept over-weighted a persistent recovery rail. On widths near 1000 px it would reduce the Proofline to a narrow telemetry column and make evidence harder to read.

**Correction.** The recovery deck is bounded with a clamped width, the main lane remains `minmax(0, 1fr)`, and the entire architecture collapses at 980 px. Empty/unselected mission states explicitly allow toolbar and activity content to span the full width instead of leaving a dead recovery column.

**State.** Closed at specification level and subsequently exercised by runtime evidence.

## Critique cycle 2 — post-render challenge

**Required observation.** Compare desktop and compact runtime screenshots after the architecture is rendered. Check: objective dominance, Proofline readability, sticky recovery behavior, receipt discoverability, horizontal overflow, focus visibility, empty mission state, dark/nocturne compatibility and whether the surface still looks like a generic admin dashboard.

**Correction rule.** Any observed failure reopens the earliest affected architecture or system decision. Do not merely hide the evidence in CSS or call the screenshot acceptable.

**Observed evidence and corrections.**

- Main Chromium runtime visual evidence on run `31808894665` passed on Ubuntu and Windows after canonical `ui-dist` parity. Desktop and compact Proofline states retained objective-first hierarchy, bounded recovery, keyboard-focus evidence, no horizontal overflow, and no serious/critical Axe finding.
- The first general screenshots did not force the internally scrolling Proofline ledger into view. That gap reopened the evidence design instead of being accepted by inference. A dedicated ledger gate now scrolls `.activity-filament` into the viewport, opens an evidence receipt, checks event/receipt discoverability and overflow, and captures desktop, compact and nocturne states. Run `31808894675` passed after low-contrast evidence text was corrected through semantic tokens while event-state color remained structural rather than decorative.
- The empty/unselected mission state was also not accepted from CSS alone. A dedicated cross-platform gate now asserts that no mission spotlight or recovery deck is fabricated, that toolbar and ledger span the full activity lane, that the state has no horizontal overflow, and that Axe has no serious/critical finding. Run `31808894687` passed on Ubuntu and Windows. Linux artifact digest: `sha256:4ada202bd6366a29e8b60db9060690b78aae65733b4359da9f08db8c8a7e6bf3`; Windows artifact digest: `sha256:55557b70f048f34286ed5ac8ffedf6e080b12ee20fa4233752668b54cf7fad58`.
- Manual inspection of the emitted runtime images found the selected mission objective remains the dominant authority, the recovery lane stays secondary, compact mode preserves the intended reading order, receipts remain legible when opened, the nocturne state keeps sparse semantic accent rather than becoming a neon telemetry dashboard, and the unselected state removes the dead recovery column instead of leaving an empty two-lane shell.

**Bounded verification record.** Canonical sync run `31808889885` passed with 2639 tests across 894/894 Node test files, deterministic UI regeneration, native-core conformance regeneration, requirement evidence regeneration, master-ledger regeneration and mutation whitelist enforcement. At that checkpoint the master acceptance ledger contained 1460 canonical items: 1372 `verified` and 88 `external_gate`; native-core conformance contained 115 contracts: 100 verified and 15 external, with `completeParityClaimAllowed: false`.

**State.** CLOSED as a post-render critique cycle. The selected flagship architecture has reached the NUI `CRITIQUED` evidence ceiling for this producer. This closure does **not** self-transition the work to `VERIFIED`, does not close release gates, and does not establish empirical superiority.

## Completion boundary

A passing source test proves the architecture contract is represented in code. Passing Chromium/Axe/screenshot gates prove bounded runtime properties. They do not authorize generator self-certification.

Independent screen-reader evidence remains `UNKNOWN`. macOS-native assistive-technology behavior and human empirical preference validation remain unobserved. The master ledger still carries external gates and native-core parity explicitly disallows a complete-parity claim. Release state therefore remains governed by the independent completion and external-gate system rather than by this UI critique document.
