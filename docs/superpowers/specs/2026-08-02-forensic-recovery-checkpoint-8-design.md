# Forensic Recovery Checkpoint 8 Design

## Goal

Advance Nolane Agent from exact text-rewrite skills to bounded syntax-aware and constraint-proven skills that transfer across project-disjoint repositories, while extending long-horizon mission evidence and keeping every NolaneNative/frontier/external claim locked.

## Scope and non-claims

Checkpoint 8 is source-local. It does not claim external-repository generalization, complete NolaneNative parity, frontier-model equivalence, provider-real operation, Windows 8 GB certification, or general coding intelligence. The canonical NolaneNative archive remains unavailable. The new skill system is deliberately bounded to JavaScript token-tree codemods and finite-domain/Datalog constraints with explicit abstention outside scope.

Checkpoint 8 adds five programs:

1. **AST Skill Compiler v2** — induces typed JavaScript codemods from at least two verified recovery missions. Supported operations are program-scope identifier rename and import-source rewrite. String/comment preservation, balanced syntax, path scope, rollback and operation budgets are mandatory.
2. **Cross-project AST Transfer Lab** — verifies a compiled skill on project-disjoint Node packages copied into isolated workspaces. Transfer requires baseline pass, mutation fail, codemod repair pass, rollback restoration and tracked-source immutability.
3. **Constraint Skill Compiler** — compiles finite-domain SMT and bounded Datalog plans for test selection and resource admission. SAT/UNSAT/proof receipts are content-addressed; state/fact/iteration budgets fail closed.
4. **Mission Portfolio v2** — records at least four ordered missions across syntax repair and constraint planning, preserves best-known candidates, and binds process, cost, transfer and proof receipts.
5. **Promotion v4** — model/skill activation requires Checkpoint 7 transfer-process-cost evidence plus AST transfer or constraint-proof evidence, positive portfolio value, explicit approval and locked non-claims.

## AST skill architecture

An induction episode contains a public mission receipt, repository ID, source path, input/output hashes, a declared typed operation and verifier receipt. The compiler rejects hidden reasoning, duplicate mission receipts, mixed operations, ambiguous all-scope renames, unsupported languages, unsafe paths or stale hashes.

The emitted skill contains:

- `kind: ast-codemod`;
- language and path allowlist;
- typed operation list;
- reverse operations for rollback;
- parse obligations;
- source/test verifier obligations;
- soundness scope and known incompleteness;
- induction mission and repository lineage;
- content-addressed receipt.

No JavaScript source is executed by the compiler. Execution is delegated to `AstCodemodEngine` over text in an isolated copy.

## Constraint skill architecture

Two bounded skill kinds are supported:

- `finite-domain-smt`: variables with finite enumerated domains and eq/neq/lt/lte/gt/gte constraints;
- `bounded-datalog`: positive facts, stratified rules and a query.

The compiler validates typed schemas and emits immutable definitions. Execution uses existing adapters with explicit state, fact and iteration budgets. Every result includes proof/model/query receipts and records whether it was SAT, UNSAT or converged. No arbitrary code or shell is accepted.

## Mission portfolio

The portfolio includes:

- two AST recovery missions on distinct induction repositories;
- one AST transfer mission on a third repository;
- one SMT planning mission with both SAT and UNSAT cases;
- one Datalog query mission with safe negation and an unsafe-rule rejection.

Each mission has ordered steps, expected/actual effects, process reward, duration/cost, proof hashes and best-candidate state. Failed alternatives never replace verified candidates.

## Promotion v4

`ModelArtifactRegistry.promoteWithSolverEvidence()` and `VerifiedSkillRegistry.promote()` require:

- valid Checkpoint 7 evidence lineage;
- project-disjoint AST transfer receipt or constraint proof receipt;
- positive portfolio process value;
- lower matched-quality cost than fallback baseline;
- no safety regression;
- exact artifact/skill identity across receipts;
- explicit `approvedBy`.

Legacy v1–v3 promotions remain readable but cannot satisfy Checkpoint 8 readiness.

## Runtime and API

`SmallModelFoundationService` exposes preparation, promotion, status and execution for AST/constraint skills. Authenticated routes mirror these operations. Training/compilation and promotion are separate. Missing evidence, stale hashes, unsupported operations or out-of-scope paths fail closed.

## Release truth gate

Checkpoint 8 passes only when:

- all 1,372 local requirements remain assertion-verified and 88 external requirements remain external-unverified;
- at least two induction AST missions and one project-disjoint transfer pass;
- rollback restores the pre-skill hash and tracked source remains unchanged;
- SMT produces deterministic SAT and UNSAT proof receipts within budget;
- Datalog produces deterministic query answers and rejects unsafe/recursive negation;
- mission portfolio contains at least five missions with ordered steps and best-candidate preservation;
- promotion v4 receipts exist for the AST and constraint skill families;
- safe and unsafe execution remain separated;
- all NolaneNative, AGI, competitor-superiority, provider-real and Windows external claims remain false.
