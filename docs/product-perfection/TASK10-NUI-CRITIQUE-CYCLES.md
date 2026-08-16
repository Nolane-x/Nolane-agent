# Task 10 — NUI Critique / Correction Cycles

## Review lineage

- NUI lifecycle: `using-nolane-ui` → `nolane-ui` → `challenging-ui-designs`.
- Evidence class: `ARTIFACT_WORK`.
- Generator/critic correlation: `CORRELATED` — the same assistant context performed the critique, so this document does not claim epistemic independence.
- Baseline runtime evidence: GitHub Actions run `31883739924`, artifact `product-perfection-task10-candidate-v3` (`9246723909`).
- Baseline observed exact runtime candidate: `e78f8ff566e732b933a6be707855db4d15ca01f8`.
- Cycle A corrected runtime evidence: run `31884489503`, artifact `product-perfection-task10-cycle-a` (`9246890872`).
- Cycle A exact observed and promoted revision: `4c4e524458aa03c956a47d71c3e05338fd99ddec`.
- Cycle B source repair exact revision: `ac4492ed3c3e892febcad55b63e1f2155c2953c0`.
- Cycle B fresh visual re-observation: run `31884915018`, artifact `product-perfection-task10-cycle-b-visual-reobserve` (`9247001653`), artifact digest `sha256:e2cff47fadc3b4bb67ecf2ad9d10558e72976ebfeb00fa931d02c6a413dc7d86`.
- Machine evidence is revision-bound. Any overlapping repair requires fresh re-observation.

## Cycle A — silhouette / hierarchy / optical density

### Finding `T10-CA-001`

- **domain:** responsive hierarchy / localization expansion
- **severity:** major
- **baseline evidence:** runtime screenshot state `settings-vi-compact` from run `31883739924`, artifact `9246723909`; baseline Settings stayed a desktop two-column shell at the 640px evidence viewport.
- **violated constraint:** Task 10 risk-driven responsive/localization matrix requires priority preservation at 640px; NUI responsive critique requires transformed navigation rather than desktop shrinkage.
- **user impact:** the category rail consumed a large share of the viewport, primary settings content became narrow, and Vietnamese save/reset copy was squeezed into cramped controls.
- **falsifier:** at 640px the settings shell structurally stacks navigation above content (or otherwise gives content at least 90% of shell width), category navigation remains reachable, Reset/Save labels remain un-clipped, and no horizontal page overflow is introduced.
- **causal owner:** `ui-v3/styles/responsive.css`, not page CSS. The final responsive authority had a `max-width:979px` two-column Settings rule and the next compact structural tier started at `639px`, leaving the canonical 640px evidence viewport in the wrong regime.
- **repair:** final responsive authority recomposes Settings at `max-width:720px` into one content column, converts categories to a horizontal rail, stacks toolbar/actions, and preserves un-clipped action labels. Runtime `assertVietnameseResponsive` measures `settingsStacked`, `contentShare`, and `actionsUnclipped`.
- **fresh evidence:** exact revision `4c4e524458aa03c956a47d71c3e05338fd99ddec`; run `31884489503`; artifact `9246890872`; runtime receipt `c98be2994b5f4d3ff8a3244f99dece011ed150e164630e3df944d66a3d016a35`; screenshot SHA-256 `02cd4d33761ae7fb026a672696cc6398626d19c609c1a7250acf5780d1580067`.
- **fresh assertions:** `settingsCompactHierarchy=PASS`, horizontal overflow `PASS`, serious/critical Axe `PASS`.
- **status:** CLOSED.

### Cycle A release recommendation

`NO_BLOCKER_FOUND`

The originally observed responsive/localization hierarchy defect is no longer reproduced on the exact corrected revision. This recommendation is limited to the Cycle A silhouette/hierarchy lens.

## Cycle B — typography / material / residue / nocturne / localization / focus

### Finding `T10-CB-001`

- **domain:** action-state semantics / material hierarchy
- **severity:** major
- **baseline evidence:** fresh Cycle A screenshot `settings-vi-compact` from run `31884489503`, artifact `9246890872`, exact revision `4c4e524458aa03c956a47d71c3e05338fd99ddec`; the save control remained visually primary even when disabled and settled.
- **violated constraint:** NUI material/state critique requires consequence and affordance hierarchy to reflect current actionability. A settled no-op state must not visually compete with an actionable primary command.
- **user impact:** the strongest accent in the Settings toolbar communicated “do this now” while there was nothing to save, weakening scan hierarchy in Nocturne and compact localized layouts.
- **falsifier:** the save control exposes explicit semantic state (`dirty|saving|saved`); only `dirty` receives solid primary treatment; `saved` is neutral + disabled; `saving` is visually pending and distinct; EN/VI labels and controller behavior remain unchanged.
- **repair:** Settings derives `data-settings-save-state` from the existing `dirty` / `saving` state and conditionally applies the primary class. `settings.css` owns bounded `dirty`, `saving`, and `saved` material treatments without adding another state store.
- **source verification:** exact repair revision `ac4492ed3c3e892febcad55b63e1f2155c2953c0`; focused settings/controller/compact/accessibility tests, token validation, static UI quality audit and deterministic `ui-dist` build passed in the repair workflow.
- **fresh runtime re-observation:** run `31884915018` completed successfully while checking out exact revision `ac4492ed3c3e892febcad55b63e1f2155c2953c0`. The 640px Nocturne evidence explicitly captured both visible `saved` and `dirty` toolbar states, required `saved` to be disabled + non-primary, required `dirty` to be enabled + primary + materially stronger, required both controls to be inside the viewport, and ran serious/critical Axe checks.
- **artifact:** `9247001653`, digest `sha256:e2cff47fadc3b4bb67ecf2ad9d10558e72976ebfeb00fa931d02c6a413dc7d86`.
- **status:** CLOSED.

### Cycle B release recommendation

`NO_BLOCKER_FOUND`

The previously open action-state/material mismatch is no longer reproduced on the exact corrected revision under the bounded Cycle B runtime checks. This does not imply independent screen-reader certification or universal visual perfection outside the observed states.

## Task 10 closure

Both required NUI critique loops are closed with source correction followed by fresh runtime re-observation. Task 10 is complete for its declared risk-driven visual matrix. External certification boundaries remain unchanged and flow into Task 11+.
