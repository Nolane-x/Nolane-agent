# Procedure

1. Resolve required and optional technique relations.
2. Compute the smallest closure that produces all target artifacts and evidence.
3. Group independent nodes for parallel execution and preserve join conditions.
4. Attach retry, rollback, and stop paths to the exact node that owns them.

## Execution split

- Deterministic stages: scope, typed preconditions, coverage, evidence validation.
- Agent stages: contextual judgment and hypothesis formation.
- Reflection stages: contradiction, support, duplication, and actionability checks.
