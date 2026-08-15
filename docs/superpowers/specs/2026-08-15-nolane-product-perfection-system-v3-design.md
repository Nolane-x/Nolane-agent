# Nolane Agent — Product Perfection System v3

**Date:** 2026-08-15  
**Status:** USER-APPROVED MASTER DESIGN  
**Evidence class:** `ARTIFACT_WORK`  
**Product:** Nolane Agent 5.x desktop workspace  
**Authority:** This specification supersedes “UI polish” as a standalone goal and extends the previously merged NUI flagship reconstruction.  
**Design cognition:** Nolane UI Intelligence (NUI) v0.10.0 lineage  
**Canonical implementation branch:** `codex/product-perfection-system-v3`

---

## 0. Why this specification exists

This document is the durable product contract for completing Nolane Agent as a production desktop AI-agent workspace with extreme micro-detail quality. It is intentionally written so that an AI agent with no conversation history can continue the project without rediscovering the user’s final product goal.

The required outcome is not merely “a beautiful UI.” Nolane must become a coherent, evidence-driven, cross-platform professional product whose functionality, interaction architecture, visual craft, trust model, accessibility, performance, packaging, release and update behavior form one system.

A future agent MUST treat this file as a primary product-design authority unless the user explicitly supersedes it.

---

## 1. Final product goal

Nolane Agent shall become a **Codex-class, evidence-driven, local-first AI Agent Desktop Workspace** that:

1. turns a goal/conversation into missions, tasks, governed tool calls, review, evidence and completion receipts;
2. exposes project/context/session continuity rather than behaving like a stateless chat app;
3. integrates model/provider truth, repositories, browser, terminal/editor/workroom, MCP, plugins, skills, permissions, evidence, review, recovery and update state;
4. offers four coherent experience regimes — `Everyday`, `Workspace`, `Studio`, `Expert` — over one underlying product model;
5. reaches flagship visual quality through NUI-driven product reasoning, divergent visual exploration, render critique, correction and evidence-bound release claims;
6. ships as a verified Electron product for Windows, macOS and Linux using GitHub Actions as the official build/release factory;
7. supports a safe update/recovery chain so users can move to the newest release without data loss or trust-boundary collapse;
8. never upgrades an `UNKNOWN`, `BLOCKED` or external requirement to `PASS` without real evidence.

The product is incomplete if any of the following is true:

- critical capability exists in backend/runtime but is unreachable or incomprehensible in UI;
- a high-value user path dead-ends, silently loses context or requires expert knowledge in Everyday mode;
- important states have accidental/default browser or OS treatment;
- responsive behavior merely squeezes desktop layouts;
- visual hierarchy is attractive but evidence/permission truth is obscured;
- a generated bundle, installer, update metadata or release asset cannot be tied to an exact verified revision;
- external/platform/provider claims are inferred rather than demonstrated.

---

## 2. Product principles

### 2.1 Professional instrument, not chat skin

Nolane is a working environment for supervised autonomous execution. Chat is one interaction modality, not the product architecture.

Every significant view should help answer one or more of:

- What is my objective?
- What context/project/session am I in?
- What is Nolane doing now?
- Which model/provider/tool boundary is active?
- What changed?
- What evidence exists?
- What is uncertain, blocked or unverified?
- What can I intervene in safely?
- Can I undo, recover or resume?
- What will survive restart/update?

### 2.2 Broad-before-narrow completeness

Do not define the product by the first obvious set of screens. Discover the capability envelope, then disposition each capability as `REQUIRED`, `EXPECTED`, `OPTIONAL`, `EXCLUDED` or `UNKNOWN`.

### 2.3 Build success is not design success

Source tests, a successful bundle and an Axe pass are evidence classes, not proof of finished UX. High-ambition work requires rendered observation and human/independent critique where claims demand it.

### 2.4 Product truth outranks aesthetics

Visual treatment must never manufacture certainty, success, permission, provider availability, freshness or verification state.

### 2.5 Micro-detail is systemic

Perfection is not achieved by manually polishing thousands of isolated pixels. Every micro-detail must belong to a reusable decision system: spacing role, type role, state grammar, focus behavior, content rule, motion semantic, platform rule, evidence state, error/recovery contract or responsive transformation.

### 2.6 Signature-to-quiet ratio

The NUI flagship signature — `Proofborne Instrument` with `Evidence Spine / Trace` — remains primary in mission/evidence/review contexts, supporting in Studio/Browser/Projects/Control Plane, transformed in capability/provenance surfaces and intentionally quiet in routine Settings/form regions.

---

## 3. Experience architecture

The approved product uses four experience regimes over one canonical data/action model.

### 3.1 Everyday

**Purpose:** confidence, clarity, fast completion.

Requirements:

- one dominant objective/action at first glance;
- limited simultaneous chrome;
- descriptive labels instead of jargon where practical;
- high-consequence state always visible even when advanced detail is hidden;
- permission requests explain reason + consequence + scope;
- errors offer recovery, not raw implementation details;
- no capability is silently removed if its consequence matters to the user.

### 3.2 Workspace

**Purpose:** persistent project/context supervision.

Requirements:

- project/session/mission continuity visible;
- recent/running work, artifacts and evidence accessible without entering Expert;
- moderate density;
- search/command surfaces are discoverable;
- panes may exist but remain task-oriented rather than infrastructure-oriented.

### 3.3 Studio

**Purpose:** professional execution workbench.

Requirements:

- persistent multi-pane workspace where useful;
- keyboard-first command model;
- editor/terminal/browser/agent/evidence relationships are explicit;
- spatial state persists intentionally;
- mission lineage is not lost when moving among files/tools;
- high information density without generic IDE mimicry.

### 3.4 Expert

**Purpose:** diagnostic, provenance, configuration and runtime authority.

Requirements:

- provider/model/runtime truth;
- adapters, permissions, evidence, freshness and diagnostic depth;
- compact calibration/system-map treatment rather than dashboard-card wallpaper;
- advanced control remains understandable and auditable;
- dangerous controls have stronger consequence architecture.

### 3.5 Regime switching contract

Switching experience level MUST NOT:

- alter the meaning of existing state;
- drop unsaved/dirty information;
- reset project/session context;
- fabricate or hide critical evidence truth;
- produce unreachable actions needed to recover current work.

It MAY change disclosure, density, default layout, terminology detail, shortcut emphasis and navigation grouping.

---

## 4. Product-wide micro-detail closure graph

Every material surface and reusable component shall be reviewed against the following planes. The goal is not to customize every native control; it is to eliminate accidental behavior and unowned design decisions.

### 4.1 Optical geometry plane

Audit:

- baseline alignment;
- cap-height and icon optical centering;
- perceived vs mathematical centering;
- asymmetric padding when glyph geometry requires it;
- border/rule continuity;
- one-pixel seams;
- clipped focus rings;
- inconsistent radii;
- nested-radii math;
- text-to-icon gap;
- icon-to-hit-target gap;
- empty-state vertical balance;
- scroll gutter alignment;
- pane-divider alignment;
- title/action optical balance;
- truncation edge cases;
- line-wrap cliffs;
- orphaned labels;
- long hash/path behavior;
- fractional-DPI artifacts.

### 4.2 Typography plane

Define and verify:

- orientation/heading voice;
- body/instruction voice;
- label/value hierarchy;
- mono usage only for semantic machine identifiers;
- tabular numerals for telemetry/timers/counts where comparison matters;
- minimum readable text sizes;
- line-height by density regime;
- maximum comfortable line lengths;
- ellipsis and truncation semantics;
- mixed Vietnamese/English/code typography;
- Vietnamese diacritic clipping;
- fallback-font behavior;
- font-loading stability;
- uppercase micro-label tracking;
- punctuation/case conventions;
- code/path/hash wrapping and copying.

### 4.3 State plane

For every interactive object where applicable, explicitly own:

`rest → hover → focus-visible → active/pressed → selected → disabled → readonly → unavailable → loading/pending → streaming → stale → dirty → syncing → offline/degraded → blocked → error → retrying → recovered`.

Additional professional-tool states:

- dragging;
- drop target valid/invalid;
- resize active;
- unsaved;
- conflict;
- external change;
- detached session;
- permission waiting;
- tool waiting;
- provider unavailable;
- evidence unverified;
- evidence independently verified;
- destructive action armed;
- destructive action committed.

No state may rely on color alone for meaning.

### 4.4 Pointer/keyboard/modality plane

Review:

- click target and hit slop;
- hover discoverability;
- pointer cursor correctness;
- keyboard reachability;
- tab order;
- roving tabindex where appropriate;
- Enter vs Space semantics;
- Escape unwind order;
- click-outside behavior;
- shortcut discoverability;
- shortcut collision;
- platform modifier differences;
- focus restoration after modal/popover/navigation;
- menu/submenu keyboard behavior;
- drag keyboard equivalent where required;
- touchpad scroll/zoom conflicts;
- context-menu invocation;
- text-selection interference;
- copy/paste affordances.

### 4.5 Temporal behavior plane

Specify meaningful behavior at:

- immediate response (<100 ms perceived acknowledgement);
- short work (100–500 ms);
- noticeable work (>500 ms);
- long work (>2 s);
- streaming/continuous work;
- background work;
- stale/reconnect/retry.

For each, decide:

- skeleton vs progress vs inline status;
- when loading UI appears;
- whether layout reserves space;
- whether input remains responsive;
- interruption/cancel semantics;
- transition continuity;
- reduced-motion equivalent;
- timeout escalation;
- stale-state communication.

### 4.6 Agent-execution plane

Own the visual/interaction semantics for:

- thinking/planning;
- queued task;
- running task;
- parallel task;
- tool invocation;
- permission request;
- external wait;
- provider wait;
- artifact creation;
- evidence arrival;
- test failure;
- partial completion;
- blocked state;
- retry/replan;
- human intervention;
- review requested;
- verification received;
- mission completed;
- completion rejected;
- recovery/time-travel/replay.

### 4.7 Workspace continuity plane

Verify:

- project switching;
- mission switching;
- session switching;
- tab/pane restoration;
- scroll restoration;
- editor selection/cursor restoration where intended;
- collapsed/expanded pane persistence;
- splitter constraints;
- window-size restoration;
- safe reset of stale layout state;
- no cross-project context contamination;
- no stale command target after navigation;
- focus returns to a sensible target after route changes.

### 4.8 Information architecture plane

For each surface, identify:

- P0: must be understood/actionable immediately;
- P1: primary supporting context;
- P2: progressive detail;
- expert-only detail;
- contextual vs global actions;
- duplicate command ownership;
- dead-end paths;
- breadcrumb/context requirements;
- searchability;
- empty-state next action;
- error-state next action;
- deep-link behavior;
- destructive-path escape.

### 4.9 Modern residue plane

Explicitly inspect accidental platform/browser residue:

- scrollbars;
- native select rendering;
- file inputs;
- date/time controls;
- number/range controls;
- autofill;
- focus rings;
- text selection;
- caret;
- resize handles;
- drag ghosts;
- native validation UI;
- context menus;
- tooltips/popovers;
- cursors;
- overscroll/bounce;
- default outlines;
- window drag regions;
- titlebar controls;
- clipboard feedback;
- OS dialog mismatches.

Customization is allowed only when it preserves or improves usability/accessibility.

### 4.10 Failure/recovery plane

Every consequential failure state should answer:

- what failed;
- what succeeded before failure;
- what did not execute;
- whether data/state is safe;
- whether retry is idempotent;
- retry scope;
- alternate path;
- rollback/undo availability;
- logs/evidence availability;
- whether user action is required;
- whether work can resume after restart/update.

### 4.11 Accessibility plane

Author and verify:

- semantic landmarks;
- heading order;
- accessible names/descriptions;
- focus visibility;
- focus order;
- focus restoration;
- keyboard equivalence;
- status/live regions;
- error association;
- non-color state redundancy;
- text and non-text contrast;
- zoom/reflow;
- high-contrast/forced-colors resilience;
- reduced-motion equivalence;
- readable target sizing;
- cognitive load and irreversible action clarity;
- screen-reader semantics where independently testable.

Automated tools are not an independent screen-reader certification.

### 4.12 Platform plane

Own differences across Windows/macOS/Linux:

- titlebar/window controls;
- menu behavior;
- keyboard modifiers;
- filesystem/path display;
- installer/update conventions;
- native dialogs;
- accessibility technologies;
- DPI/scaling;
- system theme integration;
- file associations;
- app lifecycle;
- tray/background behavior if present;
- notification conventions;
- signing/notarization/trust messaging.

### 4.13 Performance-perception plane

Measure and design:

- route-switch latency;
- input latency;
- long tasks;
- main-thread pressure;
- DOM size;
- list scaling;
- progressive rendering;
- virtualization thresholds;
- memory growth;
- idle CPU;
- animation cost;
- screenshot/media cost;
- startup time;
- perceived responsiveness;
- background-work impact.

Do not optimize by hiding essential truth or breaking accessibility.

### 4.14 Trust/evidence plane

Every relevant surface should distinguish:

- configured vs actually available;
- local vs remote/cloud;
- selected model vs executing model;
- requested permission vs granted permission;
- claimed result vs test evidence;
- generated artifact vs independently reviewed artifact;
- fresh evidence vs stale evidence;
- success vs unknown vs blocked;
- signed/trusted update vs unsigned/unverified artifact.

### 4.15 Localization/content plane

Review both English and Vietnamese for:

- terminology consistency;
- verb-first action naming;
- destructive wording;
- scope clarity;
- error specificity;
- empty-state usefulness;
- sentence length;
- variable interpolation;
- punctuation/capitalization;
- model/provider/CLI names;
- plural/number handling where relevant;
- line expansion;
- translation fallback leakage;
- mixed-language UI;
- copy tone by experience regime.

### 4.16 Release-quality plane

For each material route/state, assign required evidence class:

- source contract;
- integration test;
- runtime DOM assertion;
- runtime visual capture;
- accessibility automation;
- performance trace;
- platform runner receipt;
- independent/manual certification;
- provider-real receipt.

High-risk claims may require more than one class.

---

## 5. Surface-by-surface target architecture

### 5.1 Global shell

Must own:

- app identity without decorative excess;
- project/context identity;
- current route/mode;
- running mission signal;
- runtime/provider truth summary;
- experience level;
- global command/search;
- update/critical status when actionable.

Shell should remain quieter than the active work surface.

### 5.2 Home / Mission Launch Surface

Must answer within seconds:

- where am I;
- what can I ask Nolane to do;
- what is already running/recent;
- what project/context will be used;
- what is blocked or unavailable;
- how to resume existing work.

Avoid marketing hero composition, equal bento-card grids and duplicate starter actions.

### 5.3 Projects

Projects must feel like persistent workspaces, not a file-picker page.

Required anatomy:

- project identity;
- repository/path truth;
- recent missions/sessions;
- dirty/uncommitted state where applicable;
- active model/provider context if scoped;
- artifacts/evidence lineage;
- resume/open/create flows;
- explicit empty and unavailable states.

**Mandatory unresolved-debt closure:** reproduce and diagnose the previously observed upper whitespace before changing CSS. Instrument actual bounding boxes, scroll state, restored view state and route transition state. No speculative offset patch.

### 5.4 Mission / Activity / Proofline

Keep Proofline as the flagship truth surface.

Required hierarchy:

`objective/state → active work/intervention → execution story/evidence trace → recovery/branches → receipts`.

Unknown/blocked/unverified must never borrow success styling.

### 5.5 Studio / Workroom

Must operate as a professional workbench:

- project/file context;
- mission lineage;
- editor/terminal/agent relationship;
- persistent pane geometry;
- keyboard command model;
- tool/evidence boundaries;
- actionable empty states;
- safe pane collapse at compact widths;
- no shrink-only three-column layout.

### 5.6 Browser

Trust/session boundary is P0.

Must expose:

- current origin/session;
- whether page is external/untrusted;
- permitted/denied actions;
- browser-control ownership;
- artifact/screenshot lineage;
- mission relationship;
- sensitive action confirmation;
- recovery when navigation/tooling fails.

### 5.7 Review

Must represent:

`intent → proposed change → observed result/tests → evidence → reviewer decision → next state`.

Decision buttons must communicate scope and consequence.

### 5.8 Skills / Plugins / MCP

Avoid “marketplace wallpaper.”

Show:

- origin/provenance;
- authority/readiness;
- capability scope;
- dependencies;
- requested permissions;
- install/enable/configure state;
- failures and compatibility;
- invocation boundary;
- update/removal consequence.

### 5.9 Settings

Settings remains quiet and structurally clear.

Required:

- category architecture;
- search;
- deep-link behavior;
- scoped dirty state;
- save/reset consequence;
- immediate vs restart-required settings;
- policy/locked settings;
- provider-account state;
- language/theme updates without route/scroll loss;
- keyboard and focus preservation.

### 5.10 Control Plane / Expert

Must read like a system map/calibration instrument, not an admin dashboard.

Show:

- runtime/provider/adapters truth;
- freshness;
- permissions;
- evidence health;
- diagnostics;
- capability readiness;
- bounded recovery actions.

### 5.11 Onboarding

One coherent setup plate, not a slideshow of marketing cards.

Must:

- stay within four meaningful steps unless product truth requires otherwise;
- ask only what changes the immediate experience;
- avoid forced local/cloud architecture questions unless required;
- allow safe skip/defaults;
- preview consequence of choices;
- support keyboard/focus;
- preserve progress across interruption where reasonable.

### 5.12 Update / release UI

Must distinguish:

- update available;
- download/progress;
- verification;
- ready to install;
- restart required;
- failed verification;
- install failure;
- rollback/recovery;
- platform-specific limitations.

Never show “secure/signed” unless the corresponding signature/provenance is actually verified.

---

## 6. Design-system architecture

### 6.1 Token authority

Use semantic token tiers. Raw colors/spacing/radii may only exist in primitive/token definition zones or approved platform-special cases.

Required token groups:

- color primitives;
- semantic text;
- canvas/margin/plate/overlay;
- rule/border;
- trace/evidence state;
- focus;
- semantic success/warning/error/unknown/blocked;
- spacing scale;
- radius scale;
- typography scale;
- motion durations/easing;
- elevation/shadow only where semantically justified;
- density regime overrides.

### 6.2 Component-state contracts

Every shared component must have an explicit state matrix and accessibility contract. A reusable component is not “done” because one screenshot looks correct.

### 6.3 Density system

Density is not one global compact toggle. It is governed by experience regime and surface role.

- Everyday: comfortable and explanatory.
- Workspace: balanced.
- Studio: compact but readable.
- Expert: high density with strong grouping and keyboard paths.

### 6.4 Radius/border/material restraint

Avoid nested rounded containers. Prefer spacing, alignment, rules and typographic hierarchy before adding a plate/card.

A plate is justified primarily by consequence, containment, modal separation or strong semantic grouping.

### 6.5 Motion system

Motion must explain causality, continuity, reordering, reveal, state change or attention transfer. Decorative premium motion alone is insufficient.

All material motion requires reduced-motion equivalence.

---

## 7. Responsive architecture

Target range: 640 px desktop-class compact through 1440+ wide desktop, with structural recomposition.

### >1180

- full context dock;
- multi-lane work surfaces;
- persistent expert outline when helpful.

### 981–1180

- narrowed context;
- secondary metadata compresses;
- avoid telemetry sidebars too narrow to read.

### ≤980

- structural collapse;
- explicit pane switching;
- expert index becomes compact navigation;
- mission reading order prioritizes objective/intervention/evidence.

### ≤640

- no three-column squeeze;
- main action and context remain reachable;
- horizontal scrolling only for intentional tab/filter/code/data surfaces;
- route header may reflow to two rows;
- modal width/padding remain usable.

Responsive tests must verify capability preservation, not just absence of overflow.

---

## 8. Accessibility completion model

Accessibility has three evidence layers:

1. **Source/contract:** semantics, labels, focus logic, reduced-motion branches.
2. **Runtime automation:** Axe, keyboard traversal assertions, contrast, zoom/reflow/forced-colors where automated.
3. **Independent/platform evidence:** real screen reader and machine-labelled platform observations when required.

Layer 1+2 MUST NOT be marketed as independent layer 3 certification.

---

## 9. Performance completion model

Performance budgets must exist for at least:

- cold/warm startup;
- route switch p95;
- input responsiveness during streaming;
- long tasks;
- DOM size on major routes;
- idle CPU;
- memory baseline/growth;
- progressive list rendering;
- visual capture stability;
- update/restart critical path where measurable.

Performance improvements may not remove evidence/trust information or reduce accessibility.

---

## 10. Product completion and evidence architecture

### 10.1 Canonical product ledger

Maintain separation between:

- source-implemented behavior;
- wired/reachable behavior;
- runtime-observed behavior;
- platform/provider-real behavior;
- independent certification.

### 10.2 Completion precedence

Aesthetic quality cannot override a product-closure failure. Product completeness cannot override an accessibility/trust hard blocker. Test success cannot override missing external evidence.

### 10.3 Current bounded external classes

At minimum preserve explicit non-claims around:

- independent screen-reader certification;
- labelled Windows 8 GB empirical baseline;
- provider-real dogfooding where credentials/environment are not present;
- signing/notarization/update handoff not backed by receipts;
- claims that NUI universally improves every model/task.

---

## 11. GitHub Actions as official product factory

GitHub Actions is the authority for exact-revision cross-platform verification and release packaging.

Required lifecycle:

`source candidate → exact-SHA CI → runtime visual/performance → external/platform receipts → merge → post-merge verification → release candidate → Windows/macOS/Linux packaging → checksums/provenance/signing/notarization gates → GitHub Release → update metadata → update/recovery smoke evidence`.

Do not use local packaging as the final release authority when a GitHub runner workflow exists for the target platform.

---

## 12. Electron release target

Final desktop deliverables:

- Windows: NSIS target and verified update/install handoff;
- macOS: DMG + ZIP, signing/notarization policy and verified native installation/update handoff before claiming parity;
- Linux: AppImage + DEB and verified installation/update policy before claiming parity;
- shared checksums/provenance tied to exact release revision.

Release UI and documentation must reflect real platform differences rather than pretending identical capabilities where they do not yet exist.

---

## 13. Auto-update and recovery target

A completed update system should demonstrate:

- discovery of newer release;
- authenticity/provenance verification;
- controlled download;
- retry/resume behavior;
- install/restart handoff;
- preservation of user data/settings/project state;
- post-update health verification;
- rollback/recovery strategy for failed update where supported;
- clear behavior when the update is unsigned, corrupted or incompatible.

No-data-loss replay is a hard product requirement where the architecture claims it.

---

## 14. NUI execution protocol for this project

For every material perfection slice:

1. build/update task-profile checksum;
2. record routed NUI owners and omitted owners;
3. identify product truth and affected capability graph;
4. define falsifiable user-visible failure;
5. write RED test/diagnostic where automation can represent the failure;
6. implement systemic correction;
7. render real runtime state;
8. run critique on hierarchy, typography, spacing, density, material, residue, accessibility and platform behavior;
9. correct and re-render;
10. refresh evidence/ledger only after design stabilizes;
11. verify exact candidate SHA;
12. preserve bounded non-claims.

Do not load all 174 NUI skills indiscriminately. Route the smallest sufficient specialist set.

---

## 15. Perfection slice order

### Phase A — Durable specification and audit infrastructure

- persist this master spec;
- persist micro-detail checklist/catalog;
- persist implementation plan;
- persist AI continuation checkpoint;
- add machine-readable audit matrix so coverage can be tracked without relying on prose alone.

### Phase B — Reproduce and close known runtime debt

- Projects whitespace root cause;
- any current overflow/residue/focus/layout defects revealed by full capture;
- stale visual-state restoration defects;
- cross-theme/nocturne parity issues.

### Phase C — Shared micro-system hardening

- tokens;
- typography;
- focus;
- controls;
- popovers/tooltips/menus;
- scrollbars/selection/caret;
- state matrices;
- density regimes;
- motion/reduced motion;
- content/copy conventions.

### Phase D — Surface closure

Audit and repair in product-flow order:

`Onboarding → Home → Projects → Mission/Activity → Studio → Browser → Review → Skills/Plugins/MCP → Settings → Control Plane → Update/Recovery`.

### Phase E — Accessibility/performance/runtime matrix

- desktop widths;
- themes;
- EN/VI;
- keyboard;
- reduced motion;
- forced colors/high contrast where supported;
- runtime visual;
- performance;
- cross-platform.

### Phase F — External/platform closure

Use GitHub-hosted/self-hosted/credentialed evidence only where it truly proves the gate.

### Phase G — Electron release and update completion

Build/package/release only after product/UI gates are stable enough that packaging does not hide active design churn.

---

## 16. Required durable artifacts

The following files form the minimum continuation set:

- `docs/superpowers/specs/2026-08-15-nolane-product-perfection-system-v3-design.md` — this master design;
- `docs/product-perfection/MICRO-DETAIL-CLOSURE-CATALOG.md` — concrete micro-detail audit inventory;
- `docs/superpowers/plans/2026-08-15-nolane-product-perfection-system-v3.md` — implementation plan;
- `docs/checkpoints/product-perfection/RESUME-CANONICAL.md` — zero-context continuation contract;
- machine-readable coverage/evidence artifacts added by implementation tasks.

At every completed milestone, produce a complete ZIP and persist a copy to ChatGPT Library.

---

## 17. Non-goals and anti-patterns

Do NOT:

- copy Codex trade dress or brand-specific visual identity;
- add feature breadth merely to make Nolane look bigger;
- replace evidence truth with confidence-looking UI;
- add card/bento containers as the default solution to grouping;
- use giant headings to simulate hierarchy;
- globally darken text/colors only to silence a local contrast failure;
- suppress failing accessibility/performance tests to ship;
- hand-edit `ui-dist` instead of rebuilding canonically;
- mark screen-reader/provider/signing/update gates PASS without corresponding evidence;
- “fix” unexplained layout defects with arbitrary margins before reproducing root cause;
- make Everyday mode a crippled version of Expert;
- make Expert mode a random pile of diagnostics.

---

## 18. Definition of done

This product-perfection initiative is complete only when:

1. all required product capabilities are intentionally dispositioned and reachable;
2. all material reusable components have owned state/accessibility contracts;
3. all primary product routes have runtime-observed visual states across the required theme/density/responsive matrix;
4. known layout/residue/focus/content inconsistencies have causal fixes or explicit bounded exceptions;
5. Everyday/Workspace/Studio/Expert behave as coherent regimes over one data/action model;
6. NUI critique cycles are closed with correction + re-observation, not producer self-certification;
7. performance budgets remain satisfied on supported evidence environments;
8. canonical ledgers show no hidden not-implemented/unwired/unmapped work within declared scope;
9. external gates remain explicit until real evidence exists;
10. exact-revision GitHub Actions produce and verify Windows/macOS/Linux release artifacts;
11. update/recovery behavior is proved to the level claimed by each platform;
12. final merged revision passes post-merge verification;
13. a complete project/evidence ZIP is generated, integrity-checked and stored in ChatGPT Library;
14. `RESUME-CANONICAL.md` accurately tells a fresh AI what is complete, what remains, which evidence is authoritative and what it must never falsely claim.

---

## 19. User-approved design decision

The user explicitly approved retaining the four-level architecture:

`Everyday → Workspace → Studio → Expert`

with each level redesigned as a **genuinely distinct density/interaction regime**, not the same UI with buttons merely hidden or shown.

This decision is binding unless explicitly superseded by the user.

---

## 20. Final guiding sentence

> **Nolane should feel as if every visible pixel, hidden state, keyboard path, error, recovery, permission, transition, platform edge and release artifact has an owner — while still remaining one coherent, calm product rather than a pile of individually polished parts.**
