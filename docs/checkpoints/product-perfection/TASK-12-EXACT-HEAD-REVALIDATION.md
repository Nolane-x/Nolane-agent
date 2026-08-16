# Task 12 exact-head revalidation

This checkpoint intentionally creates a human/connector-authored candidate head after canonical generated output was committed by `github-actions[bot]` and GitHub marked pull-request workflows `action_required` before any jobs were created.

## Candidate state

Task 12 source work already present on this branch includes:

- authoritative desktop platform truth projected into update state;
- Windows-only verified NSIS/native installer handoff semantics;
- macOS/Linux fail-closed native handoff semantics;
- package-kind truth and unsupported-package blocking;
- evidence-bounded pre-update snapshot/migration/post-health state;
- NUI Evidence Spine update surface with platform-aware actions and forensic metadata;
- machine-readable release-platform capability truth;
- release-candidate gating contracts and canonical generated UI/evidence synchronization.

## Revalidation rule

This commit does not itself promote any runtime or external claim to PASS. Its purpose is to establish a non-bot exact PR head so GitHub can execute the real CI, visual, performance, Proofline and external gate families on the same candidate SHA.

Task 12F is closed only when the exact candidate has fresh required source/runtime/release evidence. UNKNOWN/BLOCKED external facts remain UNKNOWN/BLOCKED rather than being converted into success.

Task 13 merge must use expected-head verification and only proceeds after exact-head evidence is acceptable.
