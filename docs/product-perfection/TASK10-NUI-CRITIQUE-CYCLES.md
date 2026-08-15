# Task 10 — NUI Critique / Correction Cycles

## Review lineage

- NUI lifecycle: `using-nolane-ui` → `nolane-ui` → `challenging-ui-designs`.
- Evidence class: `ARTIFACT_WORK`.
- Generator/critic correlation: `CORRELATED` — the same assistant context is performing the critique, so this document does not claim epistemic independence.
- Runtime evidence source: GitHub Actions run `31883739924`, artifact `product-perfection-task10-candidate-v3` (`9246723909`).
- Observed exact runtime candidate: `e78f8ff566e732b933a6be707855db4d15ca01f8` (local exact candidate created and verified in the workflow; promotion later raced with another workflow and was rejected).
- Machine evidence from that run remains valid for the observed candidate only. Any overlapping repair requires fresh re-observation.

## Cycle A — silhouette / hierarchy / optical density

### Finding `T10-CA-001`

- **domain:** responsive hierarchy / localization expansion
- **severity:** major
- **evidence:** runtime screenshot state `settings-vi-compact` from run `31883739924`, artifact `9246723909`; source owner `ui-v3/styles/pages/settings.css` keeps `.settings-center` as `minmax(240px,334px) minmax(0,1fr)` without a compact shell recomposition.
- **violated constraint:** Task 10 risk-driven responsive/localization matrix requires priority preservation at 640px; NUI responsive critique requires transformed navigation rather than desktop shrinkage.
- **user impact:** at 640px the category rail consumes a large share of the viewport, the primary settings content becomes narrow, and Vietnamese save/reset copy is squeezed into cramped controls. The user loses comfortable scanning and action clarity on a primary configuration surface.
- **falsifier:** at 640px the settings shell structurally stacks navigation above content (or otherwise gives content at least 90% of shell width), category navigation remains reachable, and Reset/Save labels remain un-clipped without horizontal page overflow.
- **recommended repair:** recompose the Settings shell at the compact breakpoint into one content column; convert category navigation into a horizontally scrollable compact rail; stack the toolbar/action cluster and keep action labels on one line. Preserve the existing Settings state/controller and category semantics.
- **status:** OPEN — RED regression required before source correction.

### Cycle A release recommendation

`REPAIR_AND_RETEST`

The runtime matrix is machine-clean for Axe/overflow, but the compact Settings hierarchy still violates the visual/responsive product contract. Do not close Task 10 until the repaired state is freshly rendered and re-observed.

## Cycle B — typography / material / residue / nocturne / localization / focus

Not started. It must inspect the Cycle-A-corrected candidate so that overlapping evidence is not stale.
