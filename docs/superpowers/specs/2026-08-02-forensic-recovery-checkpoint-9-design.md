# Nolane Agent Forensic Recovery Checkpoint 9 Design

## Goal

Extend Checkpoint 8 from single-file lexical codemods and bounded example proofs to a source-local, type-aware multi-file refactor workflow plus deterministic property-based solver verification, while keeping every NolaneNative/frontier/external claim locked.

## Scope

Checkpoint 9 adds four bounded capabilities:

1. A JavaScript module graph that resolves named exports/imports and rejects ambiguous bindings.
2. A multi-file refactor engine that renames one exported symbol across its declaration, named imports, and bound references without touching comments, strings, unrelated locals, or property keys.
3. A transfer laboratory with two induction projects and one held-out project, using baseline → mutation failure → repair → verification → rollback receipts across multiple files.
4. A deterministic property verifier that generates finite SMT and bounded Datalog cases from seeded public inputs and compares solver output with independent reference enumeration/fixed-point implementations.

## Architecture

`ModuleSymbolGraph` parses a constrained ES-module subset into immutable module, export, import, and binding records. `MultiFileRefactorEngine` consumes a verified graph and an exact rename operation, emits a content-addressed patch set, and never writes source itself. `Checkpoint9RefactorLab` applies patches only inside temporary workspaces and records verifier outcomes, best-candidate preservation, rollback, and unchanged tracked-source hashes.

`SolverPropertyVerifier` uses deterministic seeds, bounded domains, and an implementation-independent reference evaluator. It verifies both positive and negative cases, records counterexamples, and fails closed when budgets, proof hashes, or public-state constraints are violated.

`Checkpoint9Portfolio` combines three refactor missions and two property-verification families. Promotion v5 requires explicit approval, held-out transfer, property evidence, positive process value, bounded cost, and no safety regression.

## Safety and non-claims

- No shell strings.
- No writes outside declared project roots.
- No symlink or traversal targets.
- No hidden chain-of-thought storage.
- No model or skill promotion without explicit approval.
- No claim of general coding intelligence, external repository generalization, NolaneNative parity, competitor superiority, provider-real certification, or Windows external certification.

## Release criteria

- Multi-file held-out transfer passes and rollback restores every file hash.
- Unrelated local bindings, comments, strings, and object property keys remain unchanged.
- SMT and Datalog property suites have zero counterexamples across all declared seeds.
- Master Ledger remains 1,372 local assertion-verified, 0 local unbound, 88 external-unverified.
- Full Release Matrix increases to 156 required gates and passes from a clean immutable commit.
