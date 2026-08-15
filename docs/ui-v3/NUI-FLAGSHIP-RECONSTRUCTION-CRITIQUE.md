# NUI Flagship Reconstruction — Render Critique Record

**Evidence class:** `ARTIFACT_WORK`  
**Design:** `docs/superpowers/specs/2026-08-15-nui-flagship-reconstruction-design.md`  
**Selected thesis:** Proofborne Instrument  
**Signature:** Evidence Spine / Trace

This record closes the two required NUI critique → correction → re-observation loops for the flagship reconstruction. It does not claim that NUI caused the improvement, and it does not promote external accessibility/performance/provider gates that are outside the receipts named below.

## Baseline

The pre-reconstruction runtime was coherent and usable, but the product still read too easily as a generic AI/SaaS desktop shell: Home used hero/composer/equal capability cards, Studio resembled a generic IDE, Control Plane was an admin dashboard inside the app shell, and many surfaces relied on repeated rounded raised cards. The strongest product-native mechanism was the existing mission Proofline.

The reconstruction changed composition, hierarchy, surface roles and signature distribution rather than merely recoloring the existing layout.

## Critique cycle 1 — silhouette, hierarchy and semantic contrast

### Observation

The first flagship runtime exposed three failures that source/build tests did not detect:

1. **Mission/Proofline:** flattening tinted panels onto the open Snow canvas left meaningful metadata on old `--text-muted` / accent roles. Axe reported serious contrast failures on mission eyebrow/detail text, task metadata and Execution Story secondary evidence.
2. **Studio:** the flattened editor empty state retained muted instructional copy and failed runtime contrast.
3. **Control Plane:** the small expert taxonomy eyebrow used the identity accent as text after the hero was flattened, causing another contrast failure.

These were material-semantics failures, not reasons to weaken Axe or put every surface back inside a card.

### Corrections

- Mission meaningful metadata was promoted locally to `--text-secondary`; accent remains a trace/rule role rather than tiny text.
- Studio empty-state instructional copy was promoted to `--text-secondary` without rebuilding a raised welcome card.
- Control Plane taxonomy text was promoted to `--text-secondary`; violet remains on active path/rule semantics.
- No global text token was darkened merely to silence the findings.
- No runtime accessibility rule was relaxed.

### Re-observation

Exact clean-head visual run `31865461689` on `51ee8991ee292cf3dcf3728dc725a90875216ddf` completed successfully on both Chromium source runtime and Windows runtime.

Observed hierarchy after correction:

- **Home:** prompt/objective → command aperture → capability/lineage; no equal four-card SaaS silhouette.
- **Mission:** objective/state P0 → Execution Story/Proofline P1 → recovery/intervention P2; grayscale hierarchy remains legible.
- **Skills:** master-detail capability catalogue reads as a tool surface rather than a marketplace grid.
- **Settings:** remains intentionally quiet; Evidence Trace is not forced into every preference row.
- **Studio:** mission lineage is exposed from the existing truthful `snapshot.missionId`; no synthetic receipt/state is created for appearance.

Cycle 1 status: **CLOSED by correction + successful runtime re-observation.**

## Critique cycle 2 — comparative taste, material restraint and coherence

### Observation

The cycle-1 full render was technically clean but still exposed taste/coherence debt:

1. **Control Plane** still read as a nested dashboard: outer rounded shell, rounded hero, four KPI cards and multiple adapter cards. This contradicted the selected system-map/calibration thesis even though accessibility was green.
2. **Onboarding** still used the older modal-card vocabulary: large rounded plate, lavender icon tile and repeated rounded selection tiles. The setup flow looked less authored than the new shell.
3. **Browser** already had the correct trust-boundary priority, but inherited some of the old expert-shell material around it.

### Corrections

- Control Plane outer shell was flattened and bounded with instrument rules.
- Expert navigation active state now uses trace/rule semantics instead of a filled dashboard item.
- Hero became an open ruled header rather than a raised card.
- KPI and adapter regions became one-pixel calibration bands / flat records rather than independent cards.
- Operational microcopy was explicitly held at `--text-secondary` so material flattening did not recreate contrast debt.
- Onboarding was reduced to one setup plate; internal selections became flatter instrument rows with a trace-based selected state.
- Onboarding step/choice icons became restrained circular markers with instrument rules rather than accent tiles.
- Browser kept its trust/session boundary as P0 while benefiting from the flatter expert shell.

### Re-observation

Exact clean-head visual run `31865945167` on `4ae18c9c954cb1fa92d9efd21236de8213e8b6ff` completed successfully on:

- Chromium source evidence — PASS;
- Windows UI runtime evidence — PASS;
- committed distribution verification — PASS on both jobs;
- runtime Axe serious/critical gate — PASS through all captured states.

Runtime artifact:

- `ui-runtime-visual`, artifact id `9242025353`, digest `sha256:88793429aa5591e6c3915e6364234a1a1474a3e2d3a9937f45d17e583760860a`.

Comparative render judgment:

- **Control Plane after > before** on material restraint, information grouping, domain fit and production maturity. The system now reads as calibration bands + records rather than a bento/admin card wall.
- **Onboarding after > before** on shell coherence and selection causality. It remains a modal setup plate because the task is modal, but no longer repeats the old lavender-card grammar internally.
- **Browser** retains explicit trust/session priority and does not acquire decorative spectacle merely to match expert mode.
- **Settings** remains intentionally quieter than Mission/Review/Control Plane, preserving the signature-to-quiet ratio.

Cycle 2 status: **CLOSED by correction + successful runtime re-observation.**

## Open observation — Projects whitespace

The captured Projects route contains a large upper negative-space region. Direct source inspection does not show a matching margin/padding rule large enough to explain it. The view-state bridge does persist workspace scroll state, but the runtime visual harness creates a fresh browser context for each state, so there is not yet enough evidence to assign this to scroll restoration.

This is recorded as an unresolved visual observation rather than patched by guesswork. It is not allowed to become an invented root cause or a blind CSS offset. Future work should reproduce it with layout/scroll diagnostics before mutation.

## Generic-transfer check

After hiding product naming, the reconstructed Mission/Review/Studio/Browser/Control Plane composition remains tied to agent supervision because the geometry and emphasis depend on mission state, tool boundaries, evidence lineage, review, permissions and recovery. The signature is not merely purple decoration or a generic timeline.

## Bounded non-claims

The critique record does **not** establish:

- independent screen-reader certification;
- labelled Windows-8GB empirical performance certification;
- provider-real certification outside existing receipts;
- release signing/installer/update completion outside their gates;
- a causal empirical claim that NUI improves every model or every UI task.

Missing external evidence remains `UNKNOWN` / `external_gate` under the existing acceptance ledger rules.
