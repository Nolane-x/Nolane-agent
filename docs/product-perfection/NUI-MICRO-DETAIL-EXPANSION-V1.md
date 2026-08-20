# Nolane Agent — NUI Micro-detail Expansion / Release-Freeze Amendment

**Date:** 2026-08-15  
**Program:** Product Perfection System v3  
**Branch:** `codex/product-perfection-system-v3`  
**NUI authority:** `Nolane-x/Nolane-UI-Intelligence@46780cdd58e41bea8338b2d27269d339c95e28e7`  
**Evidence class:** `ARTIFACT_WORK`  
**Product thesis:** **Proofborne Instrument** with **Evidence Spine / Trace**  
**Scope:** additive product-detail closure before Task 12 release/update freeze; no backend authority expansion.

## 1. Why this amendment exists

Task 11 proves that the current flagship can be tested and measured. It does not imply that every consequential micro-state is already optimally expressed. This amendment raises the product-detail bar without reopening the visual thesis or creating a competing UI system.

The target is not “more decoration”. The target is more **useful perceptual resolution**: a user should understand what is active, blocked, waiting, proven, stale, recoverable, local, external, safe to retry, or ready for review with less interpretation cost.

## 2. NUI task profile

- surface: local-first Electron desktop AI-agent workspace;
- ambition: flagship / exceptional;
- dominant risk: misleading agent state, lost context, hidden authority, stale evidence, recovery ambiguity, dense expert overload;
- primary users: first-use operator, returning developer, expert supervisor;
- primary modalities: keyboard + pointer; accessibility state remains evidence-bounded;
- key environments: Windows/macOS/Linux, wide desktop, 980 structural collapse, ≤640 compact;
- themes/locales: light/nocturne/system, forced-colors/reduced-motion, English + Vietnamese;
- evidence: exact-revision source tests, deterministic `ui-v3 -> ui-dist`, Chromium/Windows visual evidence, performance evidence, external platform receipts;
- bounded unknowns: independent screen-reader certification, labelled Windows-8GB certification, provider-real gates without credentials, signing/notarization without receipts.

### Routed NUI owners

`modeling-component-states`, `designing-interactions`, `directing-visual-hierarchy`, `crafting-typography`, `crafting-spacing-and-rhythm`, `designing-empty-loading-error-states`, `designing-accessible-interfaces`, `adapting-responsive-layouts`, `adapting-external-ui-patterns`, `challenging-ui-designs`, `binding-ui-evidence`, `gating-ui-completion`.

### Omitted owners

Commerce, medical, automotive, game, XR, financial-market and unrelated media-specialist skills remain omitted because they do not change this product slice.

## 3. External mechanism adaptation: Codex → Nolane

External references are mechanism references, never trade-dress authority.

| External mechanism | Product job | Nolane-native translation | Foreign residue explicitly removed |
|---|---|---|---|
| threads grouped by project | move across parallel work without context loss | mission/thread rows grouped by consequence, with project context and Evidence Trace state | external colors, radii, typography, naming |
| review changes in context | shorten intent → diff → decision path | Review remains intent → observed change → evidence → decision | external diff styling and layout |
| worktree isolation | make parallel work safe and legible | project/worktree lineage appears only from real mission/git state | external branch badge styling |
| permission prompts | intervene exactly when authority changes | Needs You separates approval, permission, blocker and failure semantics | external modal/chip appearance |
| long-running agent supervision | scan many tasks quickly | quiet session spine with semantic state marker, project context and counts | external thread-list density defaults |
| unread/attention discovery | surface consequential pending work | attention is consequence-driven, not engagement-driven | consumer-chat unread-dot semantics |

Generic-transfer test: removing the Nolane name must still leave Evidence Spine/Trace, consequence-based grouping, evidence/recovery semantics and four experience regimes. If the shell could become a generic chat product by swapping a logo, this amendment fails.

## 4. AGI Cognitive System discipline used for this slice

The supplied Nolane AGI Cognitive System v4 is used as a **process scaffold**, not as a claim that the implementing model is AGI.

- hierarchical planning: each consequential micro-feature has postcondition, dependency and verifier;
- unknown-unknown search: inspect duplicate approvals, stale missions, missing projects, delayed state, long localization, deleted objects and concurrent updates;
- calibration: UI source/tests are not promoted into OS/manual/provider claims;
- capability evaluation: keep product usefulness, reliability, performance and external certification separate;
- completion: preserve BLOCKED/UNKNOWN rather than cosmetically turning uncertainty into success.

## 5. Attention hierarchy for the session/work supervision surface

### Everyday
1. P0: work that needs the user or is blocked;
2. P1: currently running work;
3. P2: ready-to-review work;
4. P3: recent completed/cancelled history;
5. P4: machine identifiers and low-value metadata on demand only.

### Workspace
Same ordering, with project context and concise execution state visible.

### Studio
Same semantics at denser rhythm; work context must not compete with file/editor focus.

### Expert
Higher density is permitted, but raw status names still do not replace human-readable meaning.

No group may become visually louder merely because it contains more rows.

## 6. Session/thread state algebra

Independent dimensions:

- interaction: rest / hover / focus / current;
- consequence: routine / attention / blocked / failure;
- lifecycle: queued / planning / running / testing / recovering / paused / review / complete / cancelled;
- authority: no request / input / approval / permission;
- context: project known / project missing / project deleted;
- data: current / stale / externally changed;
- environment: wide / compact / light / nocturne / forced-colors / reduced-motion;
- locale: English / Vietnamese / long project and mission names.

Invariants:

1. `blocked`, `failed`, `error`, `permission_required`, `awaiting_approval` and `needs_input` never look like routine completion.
2. Status never depends on color alone.
3. The same mission cannot appear twice because both a mission row and approval row exist.
4. Searching applies to approval rows and mission rows consistently.
5. A missing optional project label never removes the mission identity.
6. Human-readable status copy replaces raw backend enum copy.
7. Current/selected state, when wired, coexists with lifecycle state instead of replacing it.
8. Long mission/project names truncate without moving the status target.
9. Section counts are informational and remain quieter than consequence.
10. Reduced motion changes no information.

## 7. Immediate implementation slice

The first implementation in this amendment is the session supervision spine:

- deduplicate approval + mission rows by mission ID;
- classify blocker/failure as explicit attention instead of burying it in Recent;
- treat queued as running lifecycle;
- localize human-readable state labels in English and Vietnamese;
- apply the same search semantics to approvals and missions;
- expose per-section counts;
- show real project context when a mission already carries `projectId`;
- add non-color state geometry: attention diamond, running ring, review square, completion fill;
- keep status text visible as redundant semantics;
- provide optional `aria-current` support for the active mission;
- build full row accessible labels from mission + semantic status + project context;
- preserve recent virtualization and stable row identity;
- preserve the existing project picker and project shortcuts;
- use one quiet trace language rather than adding badge/card clutter.

## 8. Expansion obligations before release freeze

### A. Parallel-work supervision
1. distinguish queued vs running vs testing vs recovering;
2. distinguish waiting-for-user vs waiting-for-tool/provider where real state exists;
3. expose a blocker reason before a destructive recovery action;
4. preserve inspected history while live rows update;
5. provide “jump to latest” only after the user leaves the live edge;
6. keep retry/replan attached to the prior attempt;
7. show human intervention in lineage;
8. prevent duplicate approval/task representations;
9. expose project/worktree context only from authoritative state;
10. bound large-history rendering and search latency.

### B. Permission and approval
1. name requested capability and scope;
2. distinguish approval from permission grant;
3. distinguish one-shot from durable grant where available;
4. show origin/tool requesting authority;
5. state the consequence of deny;
6. preserve the request after navigation;
7. prevent double-submit while pending;
8. reconcile unknown outcome before retry;
9. expose revoked/expired authority;
10. keep authority unchanged when experience level changes.

### C. Review and evidence
1. retain intent above diff detail;
2. separate proposed change from observed result;
3. separate generator self-check from independent review;
4. expose stale evidence;
5. keep unverified evidence visually non-verified;
6. keep receipt/hash copyable;
7. expose test failure without dumping raw stack in Everyday;
8. preserve exact revision in Expert;
9. make decision scope explicit;
10. keep reject/request-change/approve consequences distinct.

### D. Model truth
1. distinguish configured provider from reachable provider;
2. distinguish model family from exact deployment;
3. show unknown context/output limits as unknown;
4. expose freshness of observed facts;
5. expose source/provenance conflict;
6. explain automatic routing in user language;
7. retain exact routing receipt for Expert;
8. differentiate runtime health from capability evidence;
9. disclose local-hardware relevance for benchmarks;
10. prevent price/service-limit claims without current source evidence.

### E. Time Travel and recovery
1. label checkpoint identity and exact mission/project scope;
2. show dirty-state coverage;
3. make compare the default safe inspection path;
4. require explicit overwrite confirmation;
5. state that current content is backed up before restore when true;
6. distinguish branch-from-checkpoint from in-place restore;
7. distinguish replay from rollback;
8. surface excluded sensitive/symlink content;
9. expose checkpoint age/freshness where material;
10. preserve recovery receipts after completion.

### F. Update and migration
1. distinguish update available/downloaded/staged/installable;
2. explain active-mission install block;
3. distinguish defer from ignore-version;
4. expose platform-specific install handoff truth;
5. never present macOS/Linux Windows semantics;
6. expose verification failure before install;
7. preserve onboarding completion;
8. preserve drafts/session/window state;
9. show recovery state after failed migration;
10. tie update evidence to exact version/revision.

### G. Empty/loading/error resilience
1. first-use empty differs from zero-result search;
2. filtered-empty differs from backend unavailable;
3. permission-hidden differs from no objects;
4. partial data keeps known-good content;
5. stale content remains usable only with explicit consequence;
6. fast local operations avoid spinner flash;
7. long operations expose meaningful phase rather than fake percentage;
8. action failure preserves unaffected work;
9. unknown commit outcome reconciles before retry;
10. retry remains idempotent for agent commands and destructive actions.

### H. Keyboard and focus
1. every primary session action has keyboard reachability;
2. focus survives async row rerender;
3. current row remains visible when focus moves into detail;
4. Escape unwinds nested overlays only one level at a time;
5. search clear restores a deterministic target;
6. truncated context has a non-hover retrieval path;
7. splitter resizing has keyboard semantics;
8. embedded browser/editor/terminal has defined focus entry/exit;
9. route transition moves focus consistently;
10. forced-colors retains current/attention/lifecycle distinction.

### I. Localization and geometry stress
1. Vietnamese status labels never clip;
2. mixed English model/tool names preserve baseline;
3. long Windows paths do not steal action width;
4. long POSIX paths wrap/copy predictably;
5. 3+ digit counts remain stable;
6. 200% zoom preserves primary actions;
7. compact width structurally recomposes;
8. optional project context appearing/disappearing causes no row jump;
9. fallback fonts preserve hit targets;
10. translated action labels retain consequence clarity.

### J. Privacy, provenance and export
1. redacted evidence says that it is redacted when material;
2. secret-looking values never leak into copy feedback;
3. external origin is visible for browser/tool/plugin evidence;
4. clipboard feedback is local and non-spammy;
5. exported evidence keeps exact identifiers;
6. exported evidence excludes credentials;
7. stale provenance cannot masquerade as current;
8. copied truncated IDs use the full underlying value;
9. artifact created differs from artifact verified;
10. screenshot/page-map provenance stays attached to mission when available.

## 9. Verification contract

A slice is not complete because source compiles.

Required gates after material UI mutation:

1. focused RED→GREEN source tests;
2. deterministic `npm run build:ui-v3`;
3. UI token + quality audits;
4. canonical evidence regeneration in dependency order;
5. `npm run validate`;
6. `npm run verify:ui-v3-release`;
7. product-perfection matrix verification;
8. Chromium runtime visual observation;
9. Windows runtime observation where the claim is platform-sensitive;
10. exact-head performance + Proofline + external platform receipts appropriate to the candidate.

Independent screen-reader, labelled Windows-8GB, provider-real and signing/notarization claims remain external until independently evidenced.

## 10. Release-freeze rule

Task 12 may begin only after this amendment's source is stabilized and its affected evidence is fresh. After release-freeze, cosmetic curiosity is not sufficient reason to mutate product UI; only causal defects, release truth gaps, accessibility failures or evidence-backed usability defects may reopen the surface.
