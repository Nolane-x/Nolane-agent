# Projects Upper-Whitespace — Causal Closure Record

**Status:** CLOSED BY MEASUREMENT + TDD + RUNTIME RE-OBSERVATION  
**Program:** Nolane Product Perfection System v3  
**Catalog focus:** `PFX-PROJ-001`, `PFX-PROJ-002`, `PFX-PROJ-003`, `PFX-PROJ-005`

## Symptom

The Projects route previously rendered with a large unexplained upper blank region. The route header began hundreds of pixels below the topbar even though Projects page CSS did not contain a corresponding top margin/padding/transform.

The previous NUI flagship critique intentionally recorded this as unresolved instead of applying a speculative offset.

## Diagnostic method

A source-runtime Playwright diagnostic was added and run on GitHub Actions. It captured, for both 1440px and 980px viewports:

- fresh direct Projects entry;
- Home → Projects route roundtrip;
- `workspaceScrollTop` and document scroll;
- workspace/content/header/toolbar/first-record bounding boxes;
- computed layout properties;
- ancestor geometry;
- active focus and basic restore markers;
- screenshots.

### Before-fix evidence

Workflow run: `31871986973`  
Exact head: `88c709b11f0fbfde9bf9cc5a48f98a019deea6bb`  
Artifact: `product-perfection-projects-diagnostics` id `9243682471`  
Artifact digest: `sha256:5280bd3098c72b47a6c671c279668dc6e04d91fe1a7bf7042516ec86658b4c23`

Key observations:

| Case | workspace.top | projects.top | workspaceScrollTop |
|---|---:|---:|---:|
| fresh-1440 | 432.56px | 475.75px | 0 |
| fresh-980 | 452.97px | 482.36px | 0 |
| roundtrip-1440 | 432.56px | 475.75px | 0 |
| roundtrip-980 | 452.97px | 482.36px | 0 |

Fresh and roundtrip geometry was identical. The issue therefore was not inherited scroll restoration.

## Root cause

The owning defect was the **global shell grid**, not Projects.

`renderAppShell()` produces normal grid children in `.app-main` in this order:

1. `.app-topbar`;
2. `#route-status` (`position:absolute`, therefore not a normal grid item);
3. `#update-notice-root` (normal grid item, often visually empty);
4. `#workspace` (normal grid item).

The CSS declared only two explicit rows:

```css
grid-template-rows: var(--topbar-height) minmax(0, 1fr);
```

Therefore the empty `#update-notice-root` occupied the flexible second row and `#workspace` was placed into an implicit third row. The flexible empty row consumed the otherwise available height, producing the large blank band before every affected workspace route.

This explains the measured geometry without invoking any Projects-specific margin or scroll hypothesis.

## TDD correction

A regression test now requires:

```css
.app-main {
  grid-template-rows: var(--topbar-height) auto minmax(0, 1fr);
}

.app-shell[data-shell-mode="settings"] > .app-main {
  grid-template-rows: auto minmax(0, 1fr);
}
```

The one-shot repair workflow first proved the test RED against the old shell grid, then applied the causal correction, proved GREEN, rebuilt `ui-dist` canonically, ran shell/diagnostic tests and scope-guarded the mutation.

Repair workflow run: `31872128425` — SUCCESS.  
Resulting source/build commit: `eca1c0f61e0246fd1f02817b6a44533d4e80cb2f`.

The temporary self-mutating repair workflow was removed immediately after success.

## After-fix evidence

Workflow run: `31872271648`  
Exact observation head: `3d788fd90cc3cd7b32270aa5fa32dd0309b16e77`  
Artifact: `product-perfection-projects-diagnostics` id `9243761283`  
Artifact digest: `sha256:6eaccc8b85b14f678a2127b015303f600b073c03a3c3cdcd2d75d4f93a8502ce`

Key observations:

| Case | workspace.top | projects.top | workspaceScrollTop |
|---|---:|---:|---:|
| fresh-1440 | 58px | 101.19px | 0 |
| fresh-980 | 58px | 87.39px | 0 |
| roundtrip-1440 | 58px | 101.19px | 0 |
| roundtrip-980 | 58px | 87.39px | 0 |

The workspace now begins immediately after the 58px topbar. Projects content begins only by the intentional workspace padding. Fresh and route-roundtrip states remain identical.

## Closure statement

The prior upper whitespace was not an aesthetic-spacing preference. It was an implicit-grid-row architecture defect caused by the presence of the update notice root. The correct correction was made at the global shell owner.

Future agents MUST NOT reintroduce a Projects-specific negative margin/translate/top offset as a workaround for this historical issue. Any new Projects whitespace observation must be measured independently.

## Bounded non-claim

This record closes the measured shell-grid defect. It does not certify every Projects density/typography/state/responsive requirement in the micro-detail catalog. Those remain separate perfection work.
