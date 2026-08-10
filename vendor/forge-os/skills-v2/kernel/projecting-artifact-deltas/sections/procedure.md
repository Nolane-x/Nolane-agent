# Procedure

1. Resolve active artifact versions and requested dependency depth.
2. Compare content and envelope hashes with the checkpoint.
3. Emit changed fields, invalidations, and unchanged references separately.
4. Provide explicit fetch handles for omitted full bodies.

## Execution split

- Deterministic stages: scope, typed preconditions, coverage, evidence validation.
- Agent stages: contextual judgment and hypothesis formation.
- Reflection stages: contradiction, support, duplication, and actionability checks.
