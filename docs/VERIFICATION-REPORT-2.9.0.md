# Forge Studio 2.9.0 verification contract

A 2.9.0 release is valid only when the complete Full Release Matrix runs from gate 1 on a clean committed tree and every required gate passes.

## Git completion governance gate

`git-completion-governance` must prove:

- authenticated, task- and project-bound checkpoint and final commit transactions;
- expected-HEAD and idempotency enforcement;
- configured remote metadata capture;
- selective staging constrained by allowed and denied paths;
- secret and generated-artifact rejection before commit;
- conventional bounded commit-message validation or generation;
- passing test receipts for final completion and explicit checkpoint verification-pending state;
- durable residual-risk evidence, content-addressed receipts, evidence records, and events;
- mission-level tracking of builder/integrator worktree changes;
- duplicate-file ownership detection;
- non-mutating pairwise `git merge-tree` conflict evidence;
- accepted diff-review coverage before integration readiness;
- integration preflight before approval and branch mutation;
- conflict-resolution receipts only after a prior conflict becomes clean and verified tests pass;
- authenticated bounded API routes with no raw Git argv or repository-location input;
- a lazy-loaded Git Governance Center;
- exact item-level audit movement for the fifteen Git/worktree requirements;
- inclusion in source reconstruction and release packaging.

## Non-claims

The gate must retain explicit boundaries: no remote push or hosted pull-request mutation, no automatic semantic conflict resolution, no claim that a clean textual merge proves correctness, no force-push or history rewrite, and no raw Git command surface over HTTP.

## Inherited gates

All prior gates remain required, including remaining-completion/native runtime boundaries, code relationship intelligence, local worktree handoff, local resource sandbox, AST intelligence, semantic/dependency intelligence, mission governance, ForgeOS validation, SDK tests, Windows packaging, fresh-source reconstruction, and archive integrity.

Every partial or external-gated requirement must appear exactly once in `docs/REMAINING-GAPS-2.9.0.md` and the machine-readable remaining-gaps report.
