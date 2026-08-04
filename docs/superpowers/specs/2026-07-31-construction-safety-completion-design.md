# Forge Studio 3.4.0 Construction Safety Completion Design

## Goal

Close the local-runtime completion gaps for long-horizon construction, semantic patch safety, independent verification, bounded causal intervention, and counterfactual phase governance without changing external gates or claiming comparative superiority.

## Scope

Promote exactly these 21 requirements from `partial` to `verified_source_test`:

- Cognitive intervention: `34.16`
- Long-horizon construction: `35.6`, `35.7`, `35.11`, `35.12`, `35.13`, `35.15`
- Patch intelligence: `36.4`, `36.5`, `36.6`, `36.11`, `36.14`, `36.16`
- Independent verification: `37.4`, `37.5`, `37.11`, `37.15`
- World-model and counterfactual governance: `46.9`, `46.11`, `46.13`, `46.16`

The release target is 1,017 verified, 70 partial, 63 external gate, and 0 not implemented.

## Architecture

### Construction Contract Runtime

A `ConstructionContractRuntime` compiles explicit contracts for type/interface/error/state/compatibility, creates vertical slices with parse/type/test checkpoints, revokes obsolete tasks after a signed replan, enforces bounded file and contract ownership, launches two or three real Git worktrees for high-risk alternatives, and restores exact mission state from a content-addressed capsule plus Git checkpoint.

### Semantic Change Safety Runtime

A `SemanticChangeSafetyRuntime` compares public API signatures, types, errors, defaults, events, and side effects; computes blast radius from caller/test/schema/runtime evidence; detects existing abstractions before new symbols are accepted; identifies schema/config/migration and rollback obligations; executes candidate patches in isolated worktrees under one verification contract; and requires an independent review receipt for public API, security, or multi-module contract changes.

### Independent Verification Runtime

An `IndependentVerificationRuntime` runs bounded temporary mutation probes, requires reviewer identity/provider separation above a risk threshold, validates browser/API journey receipts with artifact hashes, and stores hidden regression cases encrypted-at-rest behind an executor-blind interface.

### Causal and Counterfactual Runtime

A `CausalInterventionLab` changes exactly one declared variable in an isolated sandbox while holding all other declared variables constant. A `CounterfactualChangeRuntime` models API, dependency, state, test, and user-visible effects before patching; enforces `imagine -> verify -> execute` transitions; and records whether simulation improved or worsened the verified decision outcome.

## Safety and Evidence Rules

- No worktree candidate can be selected without the same verification-contract SHA-256.
- No external command or file mutation occurs outside registered temporary worktrees/sandboxes.
- Hidden regression payloads are never returned to the executor API before evaluation.
- Independent review requires a distinct reviewer identity and, when configured, a distinct provider.
- Simulation and causal intervention receipts never count as observed production evidence.
- Execution is blocked unless the verify phase has an observed receipt.
- Every release measurement is deterministic and content-addressed.
- The 63 external gates remain unchanged.

## Testing

Each runtime receives direct unit tests, integration tests over real temporary Git repositories/worktrees, negative tests for contract drift and evidence spoofing, and a mandatory release gate. Existing 3.1-3.3 retention gates must continue to pass.
