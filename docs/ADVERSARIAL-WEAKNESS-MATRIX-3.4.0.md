# Forge Studio 3.4.0 — Adversarial Weakness Matrix

| Area | Adversarial condition | Required behavior | Remaining boundary |
|---|---|---|---|
| Contract planning | Slice omits parse, type or test checkpoint | Reject plan | Checkpoint presence does not prove checkpoint quality |
| Replanning | Obsolete task remains active | Revoke with verification receipt | Human intent can still be specified incorrectly |
| Ownership | Two agents claim the same file or contract | Fail closed | Semantic conflicts outside declared ownership remain possible |
| Candidate isolation | Candidate is not a real worktree or changes verification contract | Reject candidate | Candidate generation quality is not certified |
| State recovery | Repository fingerprint, Git checkpoint or revisions drift | Require revalidation | Exact local restoration is not distributed disaster recovery |
| API compatibility | Signature/type/errors/default/events/side effects drift | Mark semantic breaking dimensions | Dynamic-language behavior can remain unobserved |
| Blast radius | Relation lacks citation | Reject edge rather than guess | Missing evidence can under-approximate impact |
| Migration | Schema/config changes lack migration or rollback | Block change | Rollback plan is not proof of production rollback success |
| Independent review | Reviewer shares executor identity/provider | Block high-risk approval | Organization-level independence remains external |
| Mutation probe | Mutant survives tests | Fail probe and restore bytes | A finite mutation set cannot prove complete test adequacy |
| Hidden regression | Executor attempts to read expected result | Store expected value only in encrypted vault | Encryption does not eliminate inference or contamination risk |
| Causal intervention | More than one variable changes or held constant drifts | Reject intervention | Sandbox observation is not production causality |
| Counterfactual flow | Execute is attempted before observed verification | Reject execution | Simulation accuracy remains bounded by evidence/model quality |
| Integration | Legacy fast path is used | Keep new runtimes unloaded | Lazy loading does not remove all memory costs after activation |
| Audit | Any item outside the declared 21 changes | Fail release gate | 70 partial and 63 external items remain |
