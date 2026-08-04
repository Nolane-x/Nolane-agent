# Forge Studio 2.9.0 release notes

## Git completion governance

Forge Studio 2.9.0 adds an evidence-bound Git completion transaction and a mission-level multi-agent collision map. The release does not turn commit creation into an unbounded shell surface and does not add remote push or pull-request mutation.

## Governed checkpoint and final commits

`GitCompletionGovernanceService` now requires an authenticated principal, task-scoped paths, an expected HEAD, an idempotency key, bounded residual-risk evidence, and passing test receipts for final commits. It reads configured remotes, applies allowed/denied path rules, rejects secret findings and generated artifacts, stages only the approved path set, validates or generates a conventional one-line message, commits through `GitGateway`, and stores a content-addressed receipt, evidence record, and durable event.

Checkpoint commits may explicitly record `verificationPending=true`; they are not represented as final verified completion.

## Multi-agent collision and review governance

The service records each managed builder/integrator worktree's branch, base/head, cleanliness, changed paths, and snapshot hash. It detects files changed by multiple agents and runs pairwise `git merge-tree` analysis without mutating candidate worktrees. Integration readiness remains false when a worktree is dirty, a merge-tree conflict exists, or any changed path lacks an accepted diff-review decision.

`WorktreeIntegrationService` consumes the collision-map receipt before requesting integration approval and fails closed when preflight is not ready.

## Verified conflict resolution

Forge Studio does not claim a conflict is resolved merely because a user says so. A conflict-resolution receipt can be recorded only when:

- the supplied prior collision receipt contains a real conflict for the task pair;
- a fresh `git merge-tree` projection is clean;
- the involved worktrees are clean;
- all related changed paths have accepted review evidence;
- at least one passing test receipt is supplied.

## Authenticated API and Git Governance Center

Authenticated endpoints expose bounded commit, checkpoint, collision-map, conflict-resolution, and read operations. They do not accept a repository root, workspace root, raw Git argv, or shell command from the HTTP body.

The lazy-loaded Git Governance Center displays remotes, commit/checkpoint receipts, test evidence, residual risks, changed files, overlaps, merge-tree conflicts, and diff-review readiness.

## Audit movement

The following items move to `verified_source_test`:

- 26.4 — Đọc remote
- 26.11 — Tạo checkpoint commit
- 26.15 — Commit thay đổi agent
- 26.16 — Viết commit message
- 26.17 — Stage file chọn lọc
- 26.18 — Không stage file bí mật
- 26.19 — Không commit artifact dư thừa
- 26.25 — Giải quyết conflict
- 26.26 — Hiển thị conflict cho người dùng
- 26.33 — Ghi test đã chạy
- 26.34 — Ghi rủi ro còn lại
- 27.6 — Theo dõi thay đổi giữa các agent
- 27.7 — Phát hiện file bị nhiều agent sửa
- 27.8 — Phát hiện conflict sớm
- 27.10 — Review từng diff trước merge

The audit target is 658 verified, 76 partial, 56 external-gated, and 0 not implemented out of 790.
