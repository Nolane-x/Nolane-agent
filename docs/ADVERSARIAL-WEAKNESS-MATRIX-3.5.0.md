# Forge Studio 3.5.0 — Adversarial Weakness Matrix

| Area | Adversarial condition | Required behavior | Remaining boundary |
|---|---|---|---|
| Task features | Unknown or raw uncontrolled feature enters policy key | Reject or canonicalize to bounded schema | Feature quality still depends on upstream observations |
| Held-out evaluation | Tuning and held-out task IDs overlap | Fail evaluation | Held-out representativeness is not universal benchmark proof |
| Candidate routing | Aggregate utility rises while a critical case regresses | Block promotion | Finite critical sets cannot cover all future tasks |
| Cohort canary | Pass, correction, or resource metric regresses | Disable candidate only | Canary does not automatically choose a replacement policy |
| Strategy learning | Outcome lacks verification receipt | Do not learn | Verification quality bounds learned policy quality |
| Patch survival | Observation is earlier than 7 days or lacks revert/rewrite evidence | Refuse long-term survival claim | 7–30 day local observation is not indefinite production survival |
| Domain trust | Reviewer success is applied to executor bucket | Keep role/domain/task buckets isolated | Sparse domains retain uncertainty |
| Trust freshness | Evidence becomes stale | Discount or report stale evidence | Decay schedule is a policy choice, not objective truth |
| Model switch | Capsule, capability or translation revision is invalid | Refuse switch | Capability declarations can still be incomplete |
| Trajectory calibration | One critical turn/tool stage is weak | Bound final confidence by weakest critical stage | Calibration does not prove semantic correctness |
| Teacher pair | Surface and structure tasks collapse to the same source | Reject pair | Generated challenge diversity remains bounded |
| Teacher oracle | Executor payload contains expected answer | Fail closed | Separation does not eliminate all contamination channels |
| Integration | Legacy fast path is used | Keep adaptive subsystem unloaded | Loaded subsystem still consumes local resources |
| Audit | Any item outside the declared 11 changes | Fail release gate | 59 partial and 63 external items remain |
