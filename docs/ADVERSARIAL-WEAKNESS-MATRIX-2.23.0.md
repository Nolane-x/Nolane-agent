# Forge Studio 2.23.0 — adversarial weakness matrix

| Area | 2.23 response | Remaining weakness | Next action |
|---|---|---|---|
| Premature task interpretation | Context posterior with entropy and memory gate | Context likelihoods are deterministic and not calibrated from long-term outcomes | Add trajectory calibration and held-out replay |
| First-hypothesis lock-in | Three-hypothesis population with explicit falsification | Hypothesis generation quality still depends on the provider | Add causal probes and independent candidate generation |
| Expensive exploration | Information-gain/resource action scoring | Cost normalization is policy-configured, not learned | Shadow contextual-bandit learning from verified outcomes |
| Global reset after local failure | Structured error posterior and owner mask | Attribution templates are bounded heuristics | Calibrate attribution against causal episodes |
| False tool success | Expected/actual agency delta | No universal automatic classifier for every tool | Add action-model probes and adapter-specific verifiers |
| Repeated failed strategy | Recovery lease fingerprint ban | Semantically equivalent strategies can evade a lexical fingerprint | Add structural strategy signatures |
| Unsafe completion | Commit and stop gates | Full invariant ledger and executable plan state machine remain incomplete | Build Long-Horizon Construction Engine |
| Private reasoning leakage | Recursive forbidden-field guard and public receipts only | External providers can still expose unsafe content before ingestion | Extend boundary sanitization and red-team suites |
