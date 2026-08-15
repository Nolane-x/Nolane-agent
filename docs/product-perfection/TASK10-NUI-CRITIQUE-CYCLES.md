# Task 10 — NUI Critique / Correction Cycles

## Review lineage

- NUI lifecycle: `using-nolane-ui` → `nolane-ui` → `challenging-ui-designs`.
- Evidence class: `ARTIFACT_WORK`.
- Generator/critic correlation: `CORRELATED` — the same assistant context is performing the critique, so this document does not claim epistemic independence.
- Baseline runtime evidence: GitHub Actions run `31883739924`, artifact `product-perfection-task10-candidate-v3` (`9246723909`).
- Baseline observed exact runtime candidate: `e78f8ff566e732b933a6be707855db4d15ca01f8` (local exact candidate created and verified in the workflow; promotion later raced with another workflow and was rejected).
- Cycle A corrected runtime evidence: run `31884489503`, artifact `product-perfection-task10-cycle-a` (`9246890872`).
- Cycle A exact observed and promoted revision: `4c4e524458aa03c956a47d71c3e05338fd99ddec`.
- Machine evidence is revision-bound. Any overlapping repair requires fresh re-observation.

## Cycle A — silhouette / hierarchy / optical density

### Finding `T10-CA-001`

- **domain:** responsive hierarchy / localization expansion
- **severity:** major
- **baseline evidence:** runtime screenshot state `settings-vi-compact` from run `31883739924`, artifact `9246723909`; baseline Settings stayed a desktop two-column shell at the 640px evidence viewport.
- **violated constraint:** Task 10 risk-driven responsive/localization matrix requires priority preservation at 640px; NUI responsive critique requires transformed navigation rather than desktop shrinkage.
- **user impact:** the category rail consumed a large share of the viewport, primary settings content became narrow, and Vietnamese save/reset copy was squeezed into cramped controls.
- **falsifier:** at 640px the settings shell structurally stacks navigation above content (or otherwise gives content at least 90% of shell width), category navigation remains reachable, Reset/Save labels remain un-clipped, and no horizontal page overflow is introduced.
- **causal owner discovered during repair:** `ui-v3/styles/responsive.css`, not page CSS. The final responsive authority had a `max-width:979px` two-column Settings rule and the next compact structural tier started at `639px`, leaving the canonical 640px evidence viewport in the wrong regime.
- **repair:** final responsive authority now recomposes Settings at `max-width:720px` into one content column, converts categories to a horizontal rail, stacks toolbar/actions, and preserves un-clipped action labels. Runtime `assertVietnameseResponsive` now measures `settingsStacked`, `contentShare`, and `actionsUnclipped` rather than accepting locale alone.
- **fresh evidence:** exact revision `4c4e524458aa03c956a47d71c3e05338fd99ddec`; run `31884489503`; artifact `9246890872`; runtime receipt `c98be2994b5f4d3ff8a3244f99dece011ed150e164630e3df944d66a3d016a35`; screenshot SHA-256 `02cd4d33761ae7fb026a672696cc6398626d19c609c1a7250acf5780d1580067`.
- **fresh assertions:** `settingsCompactHierarchy=PASS`, horizontal overflow `PASS`, serious/critical Axe `PASS`; correlated manual re-observation confirms the category rail is above full-width content and Reset/Saved labels are not clipped.
- **status:** CLOSED.

### Cycle A release recommendation

`NO_BLOCKER_FOUND`

The originally observed responsive/localization hierarchy defect is no longer reproduced on the exact corrected revision. This recommendation is limited to the Cycle A silhouette/hierarchy lens and does not close Cycle B.

## Cycle B — typography / material / residue / nocturne / localization / focus

### Finding `T10-CB-001`

- **domain:** action-state semantics / material hierarchy
- **severity:** major
- **evidence:** fresh Cycle A screenshot `settings-vi-compact` from run `31884489503`, artifact `9246890872`, exact revision `4c4e524458aa03c956a47d71c3e05338fd99ddec`; source `ui-v3/views/settings/settings-view.mjs` always gives the save control class `primary`, while `settings.css` renders `.settings-actions>button.primary` as an accent-filled CTA even when disabled and labelled `Saved` / `Đã lưu`.
- **violated constraint:** NUI material/state critique requires consequence and affordance hierarchy to reflect current actionability. A settled no-op state must not visually compete with an actionable primary command.
- **user impact:** the strongest accent in the Settings toolbar communicates “do this now” while the control is disabled and there is nothing to save. This weakens scan hierarchy, especially in Nocturne and localized compact layouts where the accent block becomes one of the most visually dominant objects.
- **falsifier:** the save control exposes explicit semantic state (`dirty|saving|saved`); only `dirty` receives the solid primary treatment; `saved` is neutral and disabled while remaining legible; `saving` has a pending treatment distinct from both settled and actionable states; EN/VI labels and controller behavior remain unchanged.
- **recommended repair:** derive a save-state attribute/class from existing `state.dirty` / `state.saving`; keep `dirty` primary, style `saved` as a neutral settled control and `saving` as a bounded pending treatment. Do not add a second Settings state store.
- **status:** OPEN — RED behavior/style contract required before repair.

### Cycle B release recommendation

`REPAIR_AND_RETEST`

Cycle A is closed, but the fresh corrected artifact still exposes a material/action-state mismatch in a primary configuration surface. Repair and re-render the saved/dirty/saving states before closing Task 10 critique.
