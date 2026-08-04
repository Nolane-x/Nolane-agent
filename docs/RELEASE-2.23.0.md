# Forge Studio 2.23.0 release

## Cognitive Decision Kernel

This release adds a bounded cognitive control layer for uncertain or repeatedly failing tasks. It preserves the default fast path for simple work and never stores chain-of-thought or raw model payloads.

### Added

- Context Posterior Manager with entropy, evidence updates and durable-memory write suppression.
- Polyhypothesis Workspace with up to three active hypotheses, predictions, evidence and explicit falsification.
- Epistemic Action Selector that prefers high-information, low-cost and reversible probes.
- Structured Error Router with posterior attribution and subsystem owner masks.
- Agency Ledger and Episodic Binder for expected-versus-actual outcomes, controllability, rollback and causal receipts.
- Recovery Lease plus commit and stop gates.
- Lazy Cognitive Kernel integration in Decision Plane and Agent Loop.
- Required Full Release Matrix gate `cognitive-decision-kernel`.
