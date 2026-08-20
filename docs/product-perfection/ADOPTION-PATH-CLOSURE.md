# Adoption Path Micro-Detail Closure — Task 5

**Status:** CLOSED BY TDD + RUNTIME RE-OBSERVATION  
**Program:** Nolane Product Perfection System v3  
**Surfaces:** Onboarding, Home, Projects, Experience Switcher, compact adoption path

## Why this slice existed

After the flagship reconstruction and shell-grid correction, the adoption path was visually coherent but still contained small product-quality failures that a large shipped product should not tolerate:

- missing project/provider prerequisites disabled mission creation without a strong P0 recovery path;
- Home runtime failure exposed an error but no bounded Retry action;
- Projects search rerender could destroy focus/caret continuity;
- an empty search result was conflated with an actually empty project registry;
- Projects runtime failure had no Retry action;
- project trust labels could leak raw/unlocalized values;
- experience descriptions were vulnerable to single-line truncation;
- keyboard selection of a new experience could leave focus on a hidden option;
- Studio compact visual capture exposed one additional semantic-contrast debt in editor welcome shortcut labels.

The slice therefore targeted **recovery, state truth, focus continuity, localization and compact-runtime evidence**, not decorative restyling.

## Systemic corrections

### Home

- Introduced a bounded `home-readiness` prerequisite region below the composer.
- Missing project links directly to `#/projects` with `Add project` / `Thêm dự án`.
- Missing provider links to `#/settings?section=models` with a direct setup action.
- Selected-but-unready model receives an explicit review path instead of only disabling mission launch.
- Runtime failure receives a Retry action that reloads controller truth while preserving the objective draft.
- Readiness treatment uses instrument rules/rows rather than new card wallpaper.

### Projects

- Search input now carries `data-preserve-key="projects-search"` and reuses the existing shared `rerenderView(...,{preserve})` authority, preserving focus/value/selection instead of adding a parallel mechanism.
- Grid/activity view toggles receive stable preservation keys.
- Search with zero matches now renders `No matching projects` / `Không có dự án phù hợp` and a clear-search action rather than falsely saying the registry is empty.
- Truly empty registry retains `No projects yet` and an Add project recovery path.
- Runtime failure receives Retry.
- Trust labels are normalized/localized for English/Vietnamese rather than displaying backend vocabulary directly.

### Experience regimes

- Busy switcher exposes `aria-busy` as well as the disabled state.
- Keyboard selection restores focus to the visible trigger when the menu disappears.
- Experience descriptions wrap and remain available in the actual menu rather than relying on one-line ellipsis/hover.
- Shell row/control dimensions consume the four approved density regimes rather than leaving the density tokens unused.

### Studio compact contrast caught by adoption matrix

Responsive runtime evidence found `Quick open` / `Search` shortcut labels inheriting `--text-muted` on the open editor canvas. They were promoted locally to `--text-secondary`; no global text token or Axe rule was weakened.

## TDD evidence

The adoption contract `tests/ui-v3-adoption-perfection.test.mjs` locks:

- Home prerequisite recovery;
- Home Retry;
- search-empty vs registry-empty semantics;
- Projects Retry and Vietnamese trust label;
- Projects search focus/caret preservation through shared rerender authority.

Two historical regression tests were made semantic rather than formatting-dependent:

- project activity view assertion now tolerates additional attributes while still requiring `aria-pressed=true`;
- project-add ownership now asserts the actual Projects action/dispatch contract and absence of the legacy duplicate-listener pattern rather than counting an event name used legitimately by multiple surfaces.

Migration GREEN diagnostics showed:

- adoption perfection: 5/5 PASS;
- Home focused suite: 24/24 PASS;
- Projects/project-picker/project-switcher suites: PASS;
- onboarding suite: PASS;
- Studio welcome contrast regression: PASS;
- shell suite: PASS;
- UI token validation: PASS;
- canonical `ui-dist` build: PASS;
- `git diff --check`: PASS.

The resulting canonical adoption source/build commit is `b36059a6e820090eab02a44abde866302dd96621`; transport helpers were then removed.

## Runtime re-observation

Final clean-head re-observation workflow:

- run: `31873750921`;
- exact head: `cfb13c21502a03e38b95eb2b8e0290fcb5a32533`;
- artifact: `product-perfection-adoption-visual`, id `9244176098`;
- artifact digest: `sha256:01a907a4488e3e127e08e1ee71dab94c95408dd6275d67e535530cb7b88d0401`.

The run completed successfully through:

- canonical distribution verification;
- Chromium + Axe;
- English light Onboarding/Home/Home Experience Menu/Projects captures;
- full responsive matrix including 640px compact states;
- Vietnamese Nocturne Home/Home Experience Menu/Projects captures;
- artifact upload.

### Visual critique judgment

- **Home wide:** objective remains the strongest focal element; the composer is primary action; prerequisites read as operational recovery rows rather than cards; capability/recent-work regions remain downstream.
- **Home 640:** recomposes into one column without losing project/provider recovery actions or the composer.
- **Projects:** previous shell blank-band defect remains closed; registry header/search/empty state begin at the expected top geometry and remain understandable at compact width.
- **Onboarding:** remains one setup plate with controlled internal selection grammar.
- **Vietnamese Nocturne:** headings, prerequisite rows, empty-state language and Experience menu retain hierarchy/contrast; menu descriptions no longer truncate into inaccessible microtext.
- **No new serious/critical Axe blocker** remained in the completed re-observation run.

## Bounded observations

This slice does not certify every `PFX-*` item on Home/Projects. It closes the user-path/state/focus defects named above and their observed visual states. Matrix PASS promotion remains evidence-bound and must be performed through the canonical observation-binding mechanism introduced later in the program.

## Follow-on

Next perfection slice is Mission/Activity/Review, where execution-state truth, polling/focus continuity, evidence/review decision semantics and stale-snapshot behavior are the priority. Do not return to adoption styling unless a new measured regression appears.
