# Forge Studio 2.24.0 release

## Long-Horizon Construction Engine

This release adds an executable construction control plane between cognitive decisions and filesystem mutation. It compiles bounded specifications, traces requirements to verification, enforces invariants, runs resumable plan state machines, measures semantic patch impact, compares isolated candidates and produces completion proof bundles.

### Added

- Specification Compiler with weighted criteria, non-goals, hard/negotiable constraints, interfaces, invariants and contradiction blocking.
- Requirement Traceability Ledger from criterion through decision, plan step, symbol and test to verification receipt.
- Invariant Ledger with owner, severity, verifier, source hash, supersession and stale-evidence blocking.
- Hierarchical Executable Plan State Machine with preconditions, ownership bounds, expected states, verification and revalidation.
- Atomic State Capsules and prospective obligations for bounded resume and future-state commitments.
- Goal Conflict Resolver that never weakens hard constraints.
- Semantic Patch Intelligence, dynamic budgets, impact-based verification and atomic patch authorization.
- Correctness-first candidate selection and receipt-bound Completion Proof Bundles.
- Lazy Construction Control Plane integration in Decision Plane and Agent Loop.
- Required Full Release Matrix gate `long-horizon-construction`.
