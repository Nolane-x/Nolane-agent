# Forge Studio 3.2.0 — Adversarial Weakness Matrix

| Area | Adversarial condition | Required behavior | Remaining boundary |
|---|---|---|---|
| Context learning | Outcome lacks a passed verification receipt | Ignore it for utility updates | No claim of global learning quality |
| Context ablation | Verifier fails or times out | Mark the card `inconclusive` | No automatic context deletion |
| Paged vectors | Page checksum or dimension is invalid | Fail closed | No OS-level `mmap` claim |
| Repository relations | Correlation resembles causality | Preserve `causalityProven: false` | No defect-location oracle |
| CFG/DFG | Dynamic call target is unresolved | Emit an ambiguous edge/flow | No fabricated target |
| Variable lineage | Branch, source hash, or compatibility proof drifts | Reject transition | No identity inference without evidence |
| Patch ablation | Workspace is not isolated or contract changes | Reject or mark inconclusive; always dispose | No apply, merge, or publish capability |
| Fabric lifecycle | Normal lexical/index path runs | Keep completion services unloaded | No eager application bootstrap wiring |
| Audit | Any requirement outside the declared 13 changes | Fail release gate | 115 partial and 63 external requirements remain |
